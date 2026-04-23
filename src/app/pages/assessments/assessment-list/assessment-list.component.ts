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
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';
import { ConfirmDialogService } from 'src/app/shared/confirm-dialog/confirm-dialog.service';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

interface Assessment {
  id: string;
  name: string;
  createdBy: { name: string };
  createdAt: Date;
  responsesCount?: number;
  clientId?: string;
  clientName?: string;
  projectId?: string;
  projectName?: string; // Mantido por compatibilidade, mas não será usado
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
  imports: [MaterialModule, CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, AppPageHeaderComponent],
  templateUrl: './assessment-list.component.html',
  styleUrls: ['./assessment-list.component.scss'],
})
export class AssessmentListComponent implements OnInit {
  displayedColumns: string[] = [
    'clientName',
    // 'projectName', // Removido, pois não será mais usado
    'name',
    'createdBy',
    'createdAt',
    'responses',
    'actions',
  ];
  dataSource = new MatTableDataSource<any>([]);
  searchValue: string = '';
  clientFilterValue: string = '';
  creatorFilter: string = '';
  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  clients: Client[] = [];
  clientsFiltered: Client[] = [];
  clientSearchCtrl = new FormControl('');
  creators: string[] = [];
  projects: Project[] = [];
  clientId: string | null = null;
  userClientIds: string[] = [];
  userRole: string = '';
  mailTemplates: MailTemplate[] = [];

  get hasActiveFilters(): boolean {
    return !!(this.searchValue || this.clientFilterValue || this.creatorFilter || this.dateFrom || this.dateTo);
  }

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private router: Router,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private location: Location,
    private translate: TranslateService,
    private confirmDialog: ConfirmDialogService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      if (!filter) return true;
      const f = JSON.parse(filter);

      const textMatch = !f.text || data.name.toLowerCase().includes(f.text);
      const clientMatch =
        (!f.client || data.clientId === f.client) &&
        (!this.clientId || data.clientId === this.clientId);
      const creatorMatch = !f.creator ||
        (data.createdBy?.name || '').toLowerCase().includes(f.creator);

      let dateFromMatch = true;
      if (f.dateFrom) {
        const from = new Date(f.dateFrom);
        from.setHours(0, 0, 0, 0);
        dateFromMatch = data.createdAt >= from;
      }
      let dateToMatch = true;
      if (f.dateTo) {
        const to = new Date(f.dateTo);
        to.setHours(23, 59, 59, 999);
        dateToMatch = data.createdAt <= to;
      }

      return textMatch && clientMatch && creatorMatch && dateFromMatch && dateToMatch;
    };

    this.clientId = this.route.snapshot.paramMap.get('id');
    this.authService.getCurrentUserRole().then(async (role) => {
      this.userRole = role || '';
      this.userClientIds = await this.authService.getCurrentUserClientIds();
      Promise.all([
        this.loadClients(),
        this.loadProjects(),
        this.loadAssessments(),
        this.loadMailTemplates(),
      ]).then(() => {
        this.clientsFiltered = [...this.clients];
        this.clientSearchCtrl.valueChanges.subscribe(s => {
          const q = (s || '').toLowerCase();
          this.clientsFiltered = this.clients.filter(c => c.companyName.toLowerCase().includes(q));
        });
        this.buildCreators();
        this.applyFilters();
      });
    });
  }

  private buildCreators(): void {
    const names = new Set<string>();
    this.dataSource.data.forEach((a: any) => {
      const name = a.createdBy?.name;
      if (name && name !== 'Desconhecido') names.add(name);
    });
    this.creators = Array.from(names).sort();
  }

  async loadAssessments(): Promise<void> {
    try {
      const assessmentsCollection = collection(this.firestore, 'assessments');
      let q:
        | CollectionReference<DocumentData, DocumentData>
        | Query<DocumentData, DocumentData> = assessmentsCollection;

      if (this.clientId) {
        q = query(assessmentsCollection, where('clientId', '==', this.clientId));
      } else if (this.userRole === 'admin_client' && this.userClientIds.length > 0) {
        q = query(assessmentsCollection, where('clientId', 'in', this.userClientIds));
      }

      const snapshot = await getDocs(q);

      const assessments: Assessment[] = await Promise.all(
        snapshot.docs.map(async (document) => {
          const data = document.data();
          let createdAtDate: Date;

          if (data['createdAt'] instanceof Timestamp) {
            createdAtDate = data['createdAt'].toDate();
          } else if (data['createdAt'] instanceof Date) {
            createdAtDate = data['createdAt'];
          } else if (typeof data['createdAt'] === 'string') {
            createdAtDate = new Date(data['createdAt']);
          } else {
            createdAtDate = new Date();
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
            projectId: data['projectId'], // Mantido por compatibilidade, mas não será usado
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
            assessment.clientName = 'Sem Cliente';
          }

          // Removido o bloco de busca de projectName, pois não será mais usado

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

  resetClientSearch(): void {
    this.clientSearchCtrl.setValue('', { emitEvent: false });
    this.clientsFiltered = [...this.clients];
  }

  async loadClients(): Promise<void> {
    try {
      if (this.userRole === 'admin_client' && this.userClientIds.length > 0) {
        const docs = await Promise.all(
          this.userClientIds.map(id => getDoc(doc(this.firestore, 'clients', id)))
        );
        this.clients = docs
          .filter(d => d.exists())
          .map(d => ({ id: d.id, companyName: d.data()!['companyName'] || 'Sem Nome' }));
      } else {
        const snapshot = await getDocs(collection(this.firestore, 'clients'));
        this.clients = snapshot.docs.map((d) => ({
          id: d.id,
          companyName: d.data()['companyName'] || 'Sem Nome',
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open('Erro ao carregar clientes.', 'Fechar', { duration: 3000 });
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
      console.error('Erro ao carregar Modelos de e-mail:', error);
      this.snackBar.open('Erro ao carregar Modelos de e-mail.', 'Fechar', {
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

  async sendAssessment(
    assessmentId: string,
    clientId: string | null
  ): Promise<void> {
    try {
      const dialogRef = this.dialog.open(SendAssessmentModalComponent, {
        width: '80%',
        data: {
          assessmentId: assessmentId,
          clientId: clientId || this.clientId, // Usa clientId da rota como fallback
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
        this.snackBar.open('Modelo de e-mail não encontrado.', 'Fechar', {
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
        (await import('src/enviroments/environment')).environment.functions.sendEmailUrl,
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
      if (!this.clientId) {
        throw new Error('Nenhum clientId fornecido.'); // Alterado de projectId para clientId
      }

      const participantsQuery = query(
        collection(this.firestore, 'participants'),
        where('clientId', '==', this.clientId) // Alterado de projectId para clientId
      );
      const participantsSnapshot = await getDocs(participantsQuery);

      const participants: Participant[] = [];
      for (const participantDoc of participantsSnapshot.docs) {
        const participantData = participantDoc.data();
        const participantId = participantDoc.id;

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
          'Nenhum participante encontrado para este cliente.',
          'Fechar',
          { duration: 3000 }
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
        { duration: 3000 }
      );
    }
  }

  applyFilters(): void {
    this.dataSource.filter = JSON.stringify({
      text: this.searchValue.trim().toLowerCase(),
      client: this.clientFilterValue,
      creator: this.creatorFilter.trim().toLowerCase(),
      dateFrom: this.dateFrom ? this.dateFrom.toISOString() : null,
      dateTo: this.dateTo ? this.dateTo.toISOString() : null,
    });

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  clearFilters(): void {
    this.searchValue = '';
    this.clientFilterValue = '';
    this.creatorFilter = '';
    this.dateFrom = null;
    this.dateTo = null;
    this.applyFilters();
  }

  createNewAssessment(): void {
    this.router.navigate(['/assessments/new']);
  }

  editAssessment(id: string): void {
    this.router.navigate([`/assessments/${id}/edit`]);
  }

  async deleteAssessment(id: string): Promise<void> {
    const nome = this.dataSource.data.find((a: any) => a.id === id)?.name || id;
    const confirmado = await this.confirmDialog.confirmDelete(nome);
    if (!confirmado) return;
    try {

      const assessmentDocRef = doc(this.firestore, `assessments/${id}`);
      await deleteDoc(assessmentDocRef);

      // Removido o updateDoc do projectId, pois não é mais relevante

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

  async previewAssessment(assessment: any): Promise<void> {
    try {
      const assessmentDoc = await getDoc(doc(this.firestore, 'assessments', assessment.id));
      const surveyJSON = assessmentDoc.exists() ? assessmentDoc.data()['surveyJSON'] : null;
      this.dialog.open(AssessmentPreviewComponent, {
        width: '860px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        panelClass: 'assessment-preview-dialog',
        data: { ...assessment, surveyJSON },
      });
    } catch (error) {
      console.error('Erro ao carregar preview:', error);
      this.snackBar.open('Erro ao carregar pré-visualização.', 'Fechar', { duration: 3000 });
    }
  }

  goBack(): void {
    this.location.back();
  }
}
