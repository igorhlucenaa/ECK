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
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { AssessmentPreviewComponent } from '../assessment-preview/assessment-preview.component';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { ParticipantResponsesModalComponent } from './participant-responses-modal/participant-responses-modal.component';

interface Assessment {
  id: string;
  name: string;
  createdBy: { name: string };
  createdAt: Date;
  responsesCount?: number; // Mantido como propriedade opcional
  // Outros campos, se necessário
}

interface Participant {
  id: string;
  name: string;
  email: string;
  sentAt?: Date; // Data de envio do e-mail
  completedAt?: Date; // Data de resposta do usuário
  // Outros campos, se necessário
}

@Component({
  selector: 'app-assessment-list',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  templateUrl: './assessment-list.component.html',
  styleUrls: ['./assessment-list.component.scss'],
})
export class AssessmentListComponent implements OnInit {
  displayedColumns: string[] = [
    'name',
    'createdBy',
    'createdAt',
    'responses',
    'actions',
  ]; // Adicionei 'responses'
  dataSource = new MatTableDataSource<any>([]);
  searchValue: string = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private router: Router,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog // Injetar o MatDialog
  ) {}

  ngOnInit(): void {
    this.loadAssessments();
  }

  async loadAssessments(): Promise<void> {
    try {
      const assessmentsCollection = collection(this.firestore, 'assessments');
      const snapshot = await getDocs(assessmentsCollection);

      const assessments: any = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Para cada avaliação, contar o número de participantes que responderam
      for (const assessment of assessments) {
        assessment.responsesCount = await this.countRespondedParticipants(
          assessment.id
        );
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

  async countRespondedParticipants(assessmentId: string): Promise<number> {
    try {
      const assessmentLinksQuery = query(
        collection(this.firestore, 'assessmentLinks'),
        where('assessmentId', '==', assessmentId)
      );
      const snapshot = await getDocs(assessmentLinksQuery);

      // Filtrar localmente os documentos com status 'completed'
      const completedLinks = snapshot.docs.filter(
        (doc) => doc.data()['status'] === 'completed'
      );
      console.log(
        `Contando respostas para assessmentId ${assessmentId}:`,
        completedLinks.length,
        completedLinks
      ); // Log detalhado
      return completedLinks.length; // Retorna a quantidade de participantes que responderam
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
      // Buscar todos os links para esta avaliação, independentemente do status
      const assessmentLinksQuery = query(
        collection(this.firestore, 'assessmentLinks'),
        where('assessmentId', '==', assessmentId)
      );
      const linksSnapshot = await getDocs(assessmentLinksQuery);

      console.log(
        `Links encontrados para assessmentId ${assessmentId}:`,
        linksSnapshot.docs
      ); // Log para depuração

      // Filtrar localmente os links com status 'completed'
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
        ); // Log para depuração

        // Tentar buscar pelo campo 'id' ou outro identificador único (ex.: 'documentId' se for o ID do documento)
        const participantDoc = await getDocs(
          query(
            collection(this.firestore, 'participants'),
            where('id', '==', participantId) // Tentei buscar pelo 'id', ajuste se necessário
          )
        );
        const participantData = participantDoc.docs[0]?.data();
        console.log(
          `Dados do participante para id ${participantId}:`,
          participantData
        ); // Log para depuração

        if (participantData) {
          participants.push({
            id: participantId,
            name: participantData['name'] || 'Desconhecido',
            email: participantData['email'] || 'Sem e-mail',
            sentAt: linkData['sentAt']
              ? linkData['sentAt'].toDate()
              : undefined, // Data de envio do e-mail
            completedAt: linkData['completedAt']
              ? linkData['completedAt'].toDate()
              : undefined, // Data de resposta
          });
        } else {
          console.warn(
            `Participante não encontrado para id ${participantId}. Verificando pelo document ID...`
          );
          // Tentar buscar pelo document ID diretamente, se 'id' não for o campo correto
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

      console.log('Participantes encontrados para o modal:', participants); // Log para depuração

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

      // Abrir o modal com os participantes respondentes
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

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value
      .trim()
      .toLowerCase();
    this.searchValue = filterValue;
    this.dataSource.filter = filterValue;

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
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
    console.log(assessment);
    this.dialog.open(AssessmentPreviewComponent, {
      width: '600px',
      data: assessment, // Passar os dados da avaliação selecionada para o modal
    });
  }
}
