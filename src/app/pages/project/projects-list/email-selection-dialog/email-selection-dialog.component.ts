import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  arrayUnion,
} from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { MatTableDataSource } from '@angular/material/table';
import { EmailService } from './email.service';
import { FormsModule } from '@angular/forms';
import { serverTimestamp } from '@angular/fire/firestore'; // Para usar serverTimestamp no cliente

@Component({
  selector: 'app-email-selection-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: './email-selection-dialog.component.html',
  styleUrls: ['./email-selection-dialog.component.scss'],
})
export class EmailSelectionDialogComponent implements OnInit {
  emailType: any;
  selectedAssessmentId: string | any = null; // Armazenar o ID da avaliação selecionada
  assessments: any[] = []; // Array para armazenar as avaliações disponíveis
  dataSource = new MatTableDataSource<any>([]);
  selectedParticipants = new Set<string>();
  isLoading = signal(false);
  searchValue = signal('');

  displayedColumns: string[] = [
    'select',
    'name',
    'email',
    'category',
    'status',
    'deliveryStatus',
    'isLinkExpired',
    'linkValidityDate',
  ];

  // Armazenar os dados originais para restaurar filtros
  private originalData: any[] = [];

  constructor(
    private dialogRef: MatDialogRef<EmailSelectionDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: { projectId: string; templateId: string; emailType: string },
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private emailService: EmailService // Injetando o EmailService
  ) {}

  ngOnInit(): void {
    this.emailType = this.data.emailType;
    this.loadParticipants();
    this.loadAssessments(); // Carregar as avaliações disponíveis
    console.log('data =====> ', this.data);
  }

  async loadParticipants() {
    this.isLoading.set(true);
    this.dataSource.data = [];

    const participantsCollection = collection(this.firestore, 'participants');
    const snapshot = await getDocs(participantsCollection);

    const currentDate = new Date('2025-02-20'); // Data atual (20 de fevereiro de 2025)
    const participants = snapshot.docs.map((doc) => {
      const data = doc.data();
      const assessmentLink = data['assessmentLinks']?.find(
        (link: any) => link.assessmentId === this.selectedAssessmentId
      );
      const isExpired = assessmentLink?.validityDate
        ? new Date(assessmentLink.validityDate.seconds * 1000) < currentDate
        : false;
      const deliveryStatus = assessmentLink?.deliveryStatus || 'pending';

      return {
        id: doc.id,
        name: data['name'],
        email: data['email'],
        category: data['category'] || 'outros',
        status:
          this.getAssessmentStatus(
            data['assessments'],
            this.selectedAssessmentId
          ) || 'pending',
        deliveryStatus: deliveryStatus,
        isLinkExpired: isExpired,
        linkValidityDate: assessmentLink?.validityDate
          ? new Date(
              assessmentLink.validityDate.seconds * 1000
            ).toLocaleDateString()
          : null,
        selected: false,
      };
    });

    this.originalData = participants; // Armazenar os dados originais
    this.dataSource.data = participants;
    this.dataSource.filterPredicate = this.customFilterPredicate.bind(this); // Definir filtro personalizado
    this.isLoading.set(false);
  }

  async loadAssessments() {
    const assessmentsCollection = collection(this.firestore, 'assessments');
    const snapshot = await getDocs(assessmentsCollection);

    this.assessments = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data()['name'], // Supondo que cada avaliação tenha um campo "name"
    }));
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value
      .trim()
      .toLowerCase();
    this.searchValue.set(filterValue);
    this.dataSource.filter = filterValue;
  }

  customFilterPredicate(data: any, filter: string): boolean {
    const searchStr = (filter || '').toLowerCase();
    return (
      data.name.toLowerCase().includes(searchStr) ||
      data.email.toLowerCase().includes(searchStr) ||
      data.category.toLowerCase().includes(searchStr) ||
      (data.relationshipType
        ? data.relationshipType.toLowerCase().includes(searchStr)
        : false) || // Se relationshipType não existir, ignora
      data.status.toLowerCase().includes(searchStr) ||
      data.deliveryStatus.toLowerCase().includes(searchStr) ||
      (data.isLinkExpired ? 'sim' : 'não').toLowerCase().includes(searchStr) ||
      (data.linkValidityDate
        ? data.linkValidityDate.toLowerCase().includes(searchStr)
        : false)
    );
  }

  filterByCategory(category: string) {
    // Renomeado de filterByRelationship para filterByCategory
    if (!category) {
      this.dataSource.data = [...this.originalData]; // Restaurar todos os dados originais
      this.dataSource.filter = ''; // Limpar o filtro do dataSource
    } else {
      this.dataSource.data = this.originalData.filter(
        (p) => p.category.toLowerCase() === category.toLowerCase()
      );
    }
  }

  filterByStatus(status: string) {
    if (!status) {
      this.dataSource.data = [...this.originalData]; // Restaurar todos os dados originais
      this.dataSource.filter = ''; // Limpar o filtro do dataSource
    } else {
      this.dataSource.data = this.originalData.filter(
        (p) => p.status.toLowerCase() === status.toLowerCase()
      );
    }
  }

  filterByDeliveryStatus(status: string) {
    if (!status) {
      this.dataSource.data = [...this.originalData]; // Restaurar todos os dados originais
      this.dataSource.filter = ''; // Limpar o filtro do dataSource
    } else {
      this.dataSource.data = this.originalData.filter(
        (p) => p.deliveryStatus.toLowerCase() === status.toLowerCase()
      );
    }
  }

  filterByLinkExpired(expired: string) {
    if (!expired) {
      this.dataSource.data = [...this.originalData]; // Restaurar todos os dados originais
      this.dataSource.filter = ''; // Limpar o filtro do dataSource
    } else {
      const isExpired = expired.toLowerCase() === 'true';
      this.dataSource.data = this.originalData.filter(
        (p) => p.isLinkExpired === isExpired
      );
    }
  }

  toggleSelection(participant: any) {
    if (this.selectedParticipants.has(participant.email)) {
      this.selectedParticipants.delete(participant.email);
    } else {
      this.selectedParticipants.add(participant.email);
    }
  }

  selectAll(event: any) {
    if (event.checked) {
      this.selectedParticipants = new Set(
        this.dataSource.data.map((p) => p.email)
      );
    } else {
      this.selectedParticipants.clear();
    }
  }

  areAllSelected(): boolean {
    return (
      this.dataSource.data.length > 0 &&
      this.selectedParticipants.size === this.dataSource.data.length
    );
  }

  async sendEmails() {
    if (this.selectedParticipants.size === 0) {
      this.snackBar.open('Selecione ao menos um destinatário.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    if (!this.selectedAssessmentId && this.emailType === 'convite') {
      this.snackBar.open('Selecione uma avaliação.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    this.isLoading.set(true);

    try {
      // Enviar e-mails para os participantes selecionados
      const currentDate = new Date('2025-02-20'); // Data atual (20 de fevereiro de 2025)
      for (const email of this.selectedParticipants) {
        const participant = this.dataSource.data.find((p) => p.email === email);
        if (participant) {
          // Enviar e-mail usando o serviço
          await this.emailService
            .sendEmail(
              participant.email,
              this.data.templateId,
              participant.id,
              this.selectedAssessmentId // Passando o ID da avaliação selecionada
            )
            .toPromise(); // Convertendo Observable para Promise para usar await

          // Atualizar o participante no Firestore para incluir o assessmentId
          const participantRef = doc(
            this.firestore,
            'participants',
            participant.id
          );
          await updateDoc(participantRef, {
            assessments: arrayUnion(this.selectedAssessmentId), // Adiciona o assessmentId à lista de assessments
            status: 'pending', // Atualiza o status para pendente (pode ser ajustado)
            lastEmailSentAt: serverTimestamp(), // Rastrear o envio
          });

          this.snackBar.open(
            'E-mail enviado para ' + participant.name,
            'Fechar',
            { duration: 3000 }
          );
        }
      }

      this.dialogRef.close();
    } catch (error) {
      console.error(
        'Erro ao enviar e-mails ou atualizar participantes:',
        error
      );
      this.snackBar.open(
        'Erro ao enviar e-mails ou atualizar participantes.',
        'Fechar',
        {
          duration: 3000,
        }
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  close() {
    this.dialogRef.close();
  }

  private getAssessmentStatus(
    assessments: any[],
    assessmentId: string | null
  ): string | null {
    if (!assessments || !assessmentId) return null;
    const assessment = assessments.find((a) => a.assessmentId === assessmentId);
    return assessment?.status || 'pending';
  }
}
