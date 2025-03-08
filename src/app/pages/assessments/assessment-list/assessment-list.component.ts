import { MatDialog } from '@angular/material/dialog';
import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  Firestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  getDoc,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { AssessmentPreviewComponent } from '../assessment-preview/assessment-preview.component';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { ParticipantResponsesModalComponent } from './participant-responses-modal/participant-responses-modal.component';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

interface Assessment {
  id: string;
  name: string;
  createdBy: { name: string };
  createdAt: Date;
  responsesCount?: number;
  clientId?: string;
  clientName?: string;
}

interface Participant {
  id: string;
  name: string;
  email: string;
  sentAt?: Date;
  completedAt?: Date;
}

interface Client {
  id: string;
  companyName: string;
}

@Component({
  selector: 'app-assessment-list',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './assessment-list.component.html',
  styleUrls: ['./assessment-list.component.scss'],
})
export class AssessmentListComponent implements OnInit {
  displayedColumns: string[] = [
    'clientName',
    'name',
    'createdBy',
    'createdAt',
    // 'responses',
    'actions',
  ];
  dataSource = new MatTableDataSource<any>([]);
  searchValue: string = '';
  clientFilter = new FormControl(''); // FormControl para o filtro de cliente
  clients: Client[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private router: Router,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    // Definir o valor inicial do clientFilter como 'Todos' ('')
    this.clientFilter.setValue('');
  }

  ngOnInit(): void {
    // Configurar o filterPredicate antes de carregar os dados
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const filterObj = JSON.parse(filter);
      const textMatch = data.name.toLowerCase().includes(filterObj.text);
      const clientMatch =
        !filterObj.client || data.clientId === filterObj.client;
      return textMatch && clientMatch;
    };

    // Carregar os dados de forma assíncrona e aplicar o filtro inicial
    Promise.all([this.loadClients(), this.loadAssessments()]).then(() => {
      this.applyFilters();
    });
  }

  async loadAssessments(): Promise<void> {
    try {
      const assessmentsCollection = collection(this.firestore, 'assessments');
      const snapshot = await getDocs(assessmentsCollection);

      const assessments: any = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      for (const assessment of assessments) {
        assessment.responsesCount = await this.countRespondedParticipants(
          assessment.id
        );

        if (assessment.clientId) {
          const clientDoc = await getDoc(
            doc(this.firestore, 'clients', assessment.clientId)
          );
          if (clientDoc.exists()) {
            assessment.clientName =
              clientDoc.data()['companyName'] || 'Desconhecido';
          } else {
            assessment.clientName = 'Desconhecido';
            console.warn(
              `Cliente com ID ${assessment.clientId} não encontrado.`
            );
          }
        } else {
          assessment.clientName = 'Sem Cliente';
          console.warn(
            `Avaliação ${assessment.id} não possui clientId associado.`
          );
        }
      }

      this.dataSource.data = assessments;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      this.snackBar.open('Erro ao carregar avaliações.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadClients(): Promise<void> {
    try {
      const clientsCollection = collection(this.firestore, 'clients');
      const snapshot = await getDocs(clientsCollection);
      this.clients = snapshot.docs.map((doc) => ({
        id: doc.id,
        companyName: doc.data()['companyName'] || 'Sem Nome',
      }));
      this.clients.unshift({ id: '', companyName: 'Todos' });
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open('Erro ao carregar clientes.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async countRespondedParticipants(assessmentId: string): Promise<number> {
    try {
      const assessmentLinksQuery = query(
        collection(this.firestore, 'assessmentLinks'),
        where('assessmentId', '==', assessmentId)
      );
      const snapshot = await getDocs(assessmentLinksQuery);

      const completedLinks = snapshot.docs.filter(
        (doc) => doc.data()['status'] === 'completed'
      );
      console.log(
        `Contando respostas para assessmentId ${assessmentId}:`,
        completedLinks.length,
        completedLinks
      );
      return completedLinks.length;
    } catch (error) {
      console.error('Erro ao contar participantes respondentes:', error);
      this.snackBar.open(
        'Erro ao contar participantes respondentes.',
        'Fechar',
        {
          duration: 3000,
        }
      );
      return 0;
    }
  }

  async showRespondedParticipants(assessmentId: string): Promise<void> {
    try {
      const assessmentLinksQuery = query(
        collection(this.firestore, 'assessmentLinks'),
        where('assessmentId', '==', assessmentId)
      );
      const linksSnapshot = await getDocs(assessmentLinksQuery);

      console.log(
        `Links encontrados para assessmentId ${assessmentId}:`,
        linksSnapshot.docs
      );

      const completedLinks = linksSnapshot.docs.filter(
        (doc) => doc.data()['status'] === 'completed'
      );

      const participants: Participant[] = [];
      for (const doc of completedLinks) {
        const linkData = doc.data();
        const participantId = linkData['participantId'];
        console.log(
          `Dados do link para participantId ${participantId}:`,
          linkData
        );

        const participantDoc = await getDocs(
          query(
            collection(this.firestore, 'participants'),
            where('id', '==', participantId)
          )
        );
        const participantData = participantDoc.docs[0]?.data();
        console.log(
          `Dados do participante para id ${participantId}:`,
          participantData
        );

        if (participantData) {
          participants.push({
            id: participantId,
            name: participantData['name'] || 'Desconhecido',
            email: participantData['email'] || 'Sem e-mail',
            sentAt: linkData['sentAt']
              ? linkData['sentAt'].toDate()
              : undefined,
            completedAt: linkData['completedAt']
              ? linkData['completedAt'].toDate()
              : undefined,
          });
        } else {
          console.warn(
            `Participante não encontrado para id ${participantId}. Verificando pelo document ID...`
          );
          const participantDocById = await getDocs(
            collection(this.firestore, 'participants')
          ).then((snapshot) => {
            return snapshot.docs.find((doc) => doc.id === participantId);
          });
          const participantDataById = participantDocById?.data();
          if (participantDataById) {
            console.log(
              `Participante encontrado pelo document ID ${participantId}:`,
              participantDataById
            );
            participants.push({
              id: participantId,
              name: participantDataById['name'] || 'Desconhecido',
              email: participantDataById['email'] || 'Sem e-mail',
              sentAt: linkData['sentAt']
                ? linkData['sentAt'].toDate()
                : undefined,
              completedAt: linkData['completedAt']
                ? linkData['completedAt'].toDate()
                : undefined,
            });
          } else {
            console.error(
              `Nenhum participante encontrado para participantId ${participantId} em 'participants'.`
            );
          }
        }
      }

      
      if (participants.length === 0) {
        console.warn(
          'Nenhum participante respondente encontrado para esta avaliação.'
        );
        this.snackBar.open(
          'Nenhum participante respondente encontrado.',
          'Fechar',
          {
            duration: 3000,
          }
        );
        return;
      }

      this.dialog.open(ParticipantResponsesModalComponent, {
        width: '75%',
        data: {
          participants,
          assessmentName:
            this.dataSource.data.find((a) => a.id === assessmentId)?.name ||
            'Avaliação',
          assessmentId: assessmentId,
        },
      });
    } catch (error) {
      console.error('Erro ao carregar participantes respondentes:', error);
      this.snackBar.open(
        'Erro ao carregar participantes respondentes.',
        'Fechar',
        {
          duration: 3000,
        }
      );
    }
  }

  applyFilters(): void {
    const textFilter = this.searchValue.trim().toLowerCase();
    const clientFilterValue = this.clientFilter.value || '';

    this.dataSource.filter = JSON.stringify({
      text: textFilter,
      client: clientFilterValue,
    });

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.searchValue = filterValue;
    this.applyFilters();
  }

  onClientFilterChange(): void {
    this.applyFilters();
  }

  createNewAssessment(): void {
    this.router.navigate(['/assessments/new']);
  }

  editAssessment(id: string): void {
    this.router.navigate([`/assessments/${id}/edit`]);
  }

  async deleteAssessment(id: string): Promise<void> {
    try {
      const confirmDelete = confirm(
        'Tem certeza de que deseja excluir esta avaliação?'
      );
      if (!confirmDelete) return;

      const assessmentDocRef = doc(this.firestore, `assessments/${id}`);
      await deleteDoc(assessmentDocRef);

      this.dataSource.data = this.dataSource.data.filter(
        (item) => item.id !== id
      );
      this.snackBar.open('Avaliação excluída com sucesso.', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao excluir avaliação:', error);
      this.snackBar.open('Erro ao excluir avaliação.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  previewAssessment(assessment: any): void {
        this.dialog.open(AssessmentPreviewComponent, {
      width: '600px',
      data: assessment,
    });
  }
}
