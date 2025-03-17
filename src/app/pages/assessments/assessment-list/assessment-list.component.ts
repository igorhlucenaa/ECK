import { MatDialog } from '@angular/material/dialog';
import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  setDoc,
  CollectionReference,
  DocumentData,
  Query,
  updateDoc,
  Timestamp,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { AssessmentPreviewComponent } from '../assessment-preview/assessment-preview.component';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule, Location } from '@angular/common';
import { ParticipantResponsesModalComponent } from './participant-responses-modal/participant-responses-modal.component';
import { SendAssessmentModalComponent } from './send-assessment-modal/send-assessment-modal.component';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

interface Assessment {
  id: string;
  name: string;
  createdBy: { name: string };
  createdAt: Date;
  responsesCount?: number;
  clientId?: string;
  clientName?: string;
  projectId?: string;
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

interface Project {
  id: string;
  name: string;
  clientId: string;
}

interface MailTemplate {
  id: string;
  name: string;
  content: string;
  emailType: string;
  subject: string;
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
    'responses',
    'actions',
  ];
  dataSource = new MatTableDataSource<any>([]);
  searchValue: string = '';
  clientFilter = new FormControl(''); // FormControl para o filtro de cliente
  clients: Client[] = [];
  projects: Project[] = []; // Lista de projetos para inferir o clientId
  projectId: string | null = null; // Armazena o projectId da URL
  mailTemplates: MailTemplate[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private router: Router,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private location: Location
  ) {
    this.clientFilter.setValue('');
  }

  ngOnInit(): void {
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const filterObj = JSON.parse(filter);
      const textMatch = data.name.toLowerCase().includes(filterObj.text);
      const clientMatch =
        (!filterObj.client || data.clientId === filterObj.client) &&
        (!this.projectId || data.projectId === this.projectId);
      return textMatch && clientMatch;
    };

    this.projectId = this.route.snapshot.paramMap.get('id'); // Corrigido para 'projectId'
    console.log('Project ID:', this.projectId); // Log para depuração
    Promise.all([
      this.loadClients(),
      this.loadProjects(),
      this.loadAssessments(),
      this.loadMailTemplates(),
    ]).then(() => {
      this.applyFilters();
    });
  }

  async loadAssessments(): Promise<void> {
    try {
      const assessmentsCollection = collection(this.firestore, 'assessments');
      let q:
        | CollectionReference<DocumentData, DocumentData>
        | Query<DocumentData, DocumentData> = assessmentsCollection;

      if (this.projectId) {
        q = query(
          assessmentsCollection,
          where('projectId', '==', this.projectId)
        );
      }

      const snapshot = await getDocs(q);

      const assessments: Assessment[] = await Promise.all(
        snapshot.docs.map(async (document) => {
          const data = document.data();
          let createdAtDate: Date;

          // Verificar e converter createdAt
          if (data['createdAt'] instanceof Timestamp) {
            createdAtDate = data['createdAt'].toDate();
          } else if (data['createdAt'] instanceof Date) {
            createdAtDate = data['createdAt'];
          } else if (typeof data['createdAt'] === 'string') {
            createdAtDate = new Date(data['createdAt']);
          } else {
            createdAtDate = new Date(); // Valor padrão se inválido
            console.warn(
              `createdAt inválido para assessment ${document.id}, usando data atual.`
            );
          }

          const assessment: Assessment = {
            id: document.id,
            name: data['name'] || 'Sem Nome',
            createdBy: data['createdBy'] || { name: 'Desconhecido' },
            createdAt: createdAtDate,
            clientId: data['clientId'],
            projectId: data['projectId'],
          };

          // Contar respostas
          assessment.responsesCount = await this.countRespondedParticipants(
            assessment.id
          );

          // Buscar nome do cliente
          if (assessment.clientId) {
            const clientDoc = await getDoc(
              doc(this.firestore, 'clients', assessment.clientId)
            );
            assessment.clientName = clientDoc.exists()
              ? clientDoc.data()['companyName'] || 'Desconhecido'
              : 'Desconhecido';
          } else {
            // Tentar inferir o clientId a partir do projectId
            if (assessment.projectId) {
              const project = this.projects.find(
                (p) => p.id === assessment.projectId
              );
              if (project && project.clientId) {
                assessment.clientId = project.clientId;
                const clientDoc = await getDoc(
                  doc(this.firestore, 'clients', project.clientId)
                );
                assessment.clientName = clientDoc.exists()
                  ? clientDoc.data()['companyName'] || 'Desconhecido'
                  : 'Desconhecido';
              } else {
                assessment.clientName = 'Sem Cliente';
              }
            } else {
              assessment.clientName = 'Sem Cliente';
            }
          }

          return assessment;
        })
      );

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

  async loadProjects(): Promise<void> {
    try {
      const projectsCollection = collection(this.firestore, 'projects');
      const snapshot = await getDocs(projectsCollection);
      this.projects = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Sem Nome',
        clientId: doc.data()['clientId'] || 'Desconhecido',
      }));
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      this.snackBar.open('Erro ao carregar projetos.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadMailTemplates(): Promise<void> {
    try {
      const templatesCollection = collection(this.firestore, 'mailTemplates');
      const snapshot = await getDocs(templatesCollection);
      this.mailTemplates = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Sem Nome',
        content: doc.data()['content'] || '',
        emailType: doc.data()['emailType'] || '',
        subject: doc.data()['subject'] || '',
      }));
    } catch (error) {
      console.error('Erro ao carregar templates de e-mail:', error);
      this.snackBar.open('Erro ao carregar templates de e-mail.', 'Fechar', {
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

  async sendAssessment(assessmentId: string, clientId: any): Promise<void> {
    try {
      const dialogRef = this.dialog.open(SendAssessmentModalComponent, {
        width: '80%',
        data: {
          assessmentId: assessmentId,
          projectId: this.projectId, // Passa o projectId corretamente
          clientId: clientId,
        },
      });

      dialogRef
        .afterClosed()
        .subscribe(
          async (result: {
            selectedTemplate?: string;
            selectedParticipants?: Participant[];
          }) => {
            if (
              result?.selectedTemplate &&
              result?.selectedParticipants?.length
            ) {
              await this.sendAssessmentLinks(
                assessmentId,
                result.selectedTemplate,
                result.selectedParticipants
              );
            }
          }
        );
    } catch (error) {
      console.error('Erro ao abrir modal de envio:', error);
      this.snackBar.open('Erro ao abrir modal de envio.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async sendAssessmentLinks(
    assessmentId: string,
    templateId: string,
    participants: Participant[]
  ): Promise<void> {
    try {
      const template = this.mailTemplates.find((t) => t.id === templateId);
      if (!template) {
        this.snackBar.open('Template de e-mail não encontrado.', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      for (const participant of participants) {
        const emailRequest = {
          email: participant.email,
          templateId: templateId,
          participantId: participant.id,
          assessmentId: assessmentId,
        };

        const response = await fetch(
          'https://us-central1-pwa-workana.cloudfunctions.net/sendEmail',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailRequest),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Erro ao enviar e-mail para ${
              participant.email
            }: ${await response.text()}`
          );
        }

        const assessmentLinkDoc = doc(
          collection(this.firestore, 'assessmentLinks')
        );
        await setDoc(assessmentLinkDoc, {
          assessmentId: assessmentId,
          participantId: participant.id,
          sentAt: new Date(),
          status: 'pending',
          emailTemplate: templateId,
          participantEmail: participant.email,
        });
      }

      this.snackBar.open(
        `Avaliação enviada para ${participants.length} participantes!`,
        'Fechar',
        { duration: 3000 }
      );
    } catch (error: any) {
      console.error('Erro ao enviar links de avaliação:', error);
      this.snackBar.open(
        `Erro ao enviar links de avaliação: ${error.message}`,
        'Fechar',
        { duration: 3000 }
      );
    }
  }

  async showRespondedParticipants(assessmentId: string): Promise<void> {
    try {
      // Passo 1: Buscar todos os participantes associados ao projectId
      if (!this.projectId) {
        throw new Error('Nenhum projectId fornecido.');
      }

      const participantsQuery = query(
        collection(this.firestore, 'participants'),
        where('projectId', '==', this.projectId)
      );
      const participantsSnapshot = await getDocs(participantsQuery);

      const participants: Participant[] = [];
      for (const participantDoc of participantsSnapshot.docs) {
        const participantData = participantDoc.data();
        const participantId = participantDoc.id;

        // Verificar status no assessmentLinks
        const assessmentLinksQuery = query(
          collection(this.firestore, 'assessmentLinks'),
          where('assessmentId', '==', assessmentId),
          where('participantId', '==', participantId)
        );
        const linksSnapshot = await getDocs(assessmentLinksQuery);
        const linkData = linksSnapshot.docs[0]?.data() || {};

        participants.push({
          id: participantId,
          name: participantData['name'] || 'Desconhecido',
          email: participantData['email'] || 'Sem e-mail',
          sentAt: linkData['sentAt']
            ? (linkData['sentAt'] as Timestamp).toDate()
            : undefined,
          completedAt:
            linkData['status'] === 'completed' && linkData['completedAt']
              ? (linkData['completedAt'] as Timestamp).toDate()
              : undefined,
        });
      }

      if (participants.length === 0) {
        this.snackBar.open(
          'Nenhum participante encontrado para este projeto.',
          'Fechar',
          { duration: 3000 }
        );
        return;
      }

      // Passo 2: Abrir o modal com os participantes e seus status
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
        { duration: 3000 }
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

      // Remover a referência do assessmentId no projeto associado
      if (this.projectId) {
        const projectRef = doc(this.firestore, 'projects', this.projectId);
        await updateDoc(projectRef, { assessmentId: null });
      }

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

  goBack(): void {
    this.location.back();
  }
}
