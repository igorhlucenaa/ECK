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
  addDoc,
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
import { isGlobalAssessmentTemplate } from 'src/app/utils/assessment-templates.util';
import { DuplicateAssessmentDialogComponent } from './duplicate-assessment-dialog.component';

interface Assessment {
  id: string;
  name: string;
  createdBy: { name: string };
  createdAt: Date;
  responsesCount?: number;
  clientId?: string;
  clientName?: string;
  isGlobalTemplate?: boolean;
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

  get canManageAssessments(): boolean {
    return this.userRole === 'admin_master';
  }

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
        (!f.client ||
          data.clientId === f.client ||
          data.isGlobalTemplate === true) &&
        (!this.clientId ||
          data.clientId === this.clientId ||
          data.isGlobalTemplate === true);
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
      const docMap = new Map<string, DocumentData>();

      const pushDocs = (
        docs: { id: string; data: () => DocumentData }[]
      ) => {
        docs.forEach((document) => {
          if (!docMap.has(document.id)) {
            docMap.set(document.id, { ...document.data(), __id: document.id });
          }
        });
      };

      if (this.clientId) {
        const [clientSnap, globalSnap] = await Promise.all([
          getDocs(
            query(assessmentsCollection, where('clientId', '==', this.clientId))
          ),
          getDocs(
            query(assessmentsCollection, where('isGlobalTemplate', '==', true))
          ),
        ]);
        pushDocs(clientSnap.docs);
        pushDocs(globalSnap.docs);
      } else if (this.userRole === 'admin_client' && this.userClientIds.length > 0) {
        for (let i = 0; i < this.userClientIds.length; i += 10) {
          const chunk = this.userClientIds.slice(i, i + 10);
          const snap = await getDocs(
            query(assessmentsCollection, where('clientId', 'in', chunk))
          );
          pushDocs(snap.docs);
        }
        const globalSnap = await getDocs(
          query(assessmentsCollection, where('isGlobalTemplate', '==', true))
        );
        pushDocs(globalSnap.docs);
      } else {
        const snapshot = await getDocs(assessmentsCollection);
        pushDocs(snapshot.docs);
      }

      const assessments: Assessment[] = await Promise.all(
        [...docMap.entries()].map(async ([id, data]) => {
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
              `createdAt inválido para assessment ${id}, usando data atual.`
            );
          }

          const isGlobal = isGlobalAssessmentTemplate(data as Record<string, unknown>);
          const assessment: Assessment = {
            id,
            name: data['name'] || 'Sem Nome',
            createdBy: data['createdBy'] || { name: 'Desconhecido' },
            createdAt: createdAtDate,
            clientId: data['clientId'],
            isGlobalTemplate: isGlobal,
            projectId: data['projectId'], // Mantido por compatibilidade, mas não será usado
          };

          // Contar respostas
          assessment.responsesCount = await this.countRespondedParticipants(
            assessment.id
          );

          // Buscar nome do cliente
          if (isGlobal) {
            assessment.clientName = this.translate.instant('assessments.global.badge');
          } else if (assessment.clientId) {
            const clientDoc = await getDoc(
              doc(this.firestore, 'clients', assessment.clientId)
            );
            assessment.clientName = clientDoc.exists()
              ? clientDoc.data()['companyName'] || 'Desconhecido'
              : 'Desconhecido';
          } else {
            assessment.clientName = this.translate.instant('Sem Cliente');
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
      this.snackBar.open(this.translate.instant('Erro ao carregar avaliações.'), this.translate.instant('Fechar'), {
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
      this.snackBar.open(this.translate.instant('Erro ao carregar clientes.'), this.translate.instant('Fechar'), { duration: 3000 });
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
      this.snackBar.open(this.translate.instant('Erro ao carregar projetos.'), this.translate.instant('Fechar'), {
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
      this.snackBar.open(this.translate.instant('Erro ao carregar Modelos de e-mail.'), this.translate.instant('Fechar'), {
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
        this.translate.instant('Erro ao contar participantes respondentes.'),
        this.translate.instant('Fechar'),
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
      this.snackBar.open(this.translate.instant('Erro ao abrir modal de envio.'), this.translate.instant('Fechar'), {
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
        this.snackBar.open(this.translate.instant('Modelo de e-mail não encontrado.'), this.translate.instant('Fechar'), {
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
        const participantSnap = await getDoc(doc(this.firestore, 'participants', participant.id));
        const participantData = participantSnap.data() || {};

        await setDoc(assessmentLinkDoc, {
          assessmentId: assessmentId,
          participantId: participant.id,
          clientId: participantData['clientId'] ?? null,
          projectId: participantData['projectId'] ?? null,
          avaliadoId: participantData['avaliadoId'] ?? null,
          sentAt: new Date(),
          status: 'pending',
          emailTemplate: templateId,
          participantEmail: participant.email,
          creditReserved: false,
        });
      }

      this.snackBar.open(
        this.translate.instant(`Avaliação enviada para ${participants.length} participantes!`),
        this.translate.instant('Fechar'),
        { duration: 3000 }
      );
    } catch (error: any) {
      console.error('Erro ao enviar links de avaliação:', error);
      this.snackBar.open(
        this.translate.instant(`Erro ao enviar links de avaliação: ${error.message}`),
        this.translate.instant('Fechar'),
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
          this.translate.instant('Nenhum participante encontrado para este cliente.'),
          this.translate.instant('Fechar'),
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
        this.translate.instant('Erro ao carregar participantes respondentes.'),
        this.translate.instant('Fechar'),
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

  async duplicateAssessmentForClient(item: Assessment): Promise<void> {
    if (!this.canManageAssessments || !item?.id) return;
    const dialogRef = this.dialog.open(DuplicateAssessmentDialogComponent, {
      width: '440px',
      maxWidth: '95vw',
      data: {
        sourceName: item.name,
        clients: this.clients,
      },
    });
    const targetClientId = await dialogRef.afterClosed().toPromise();
    if (!targetClientId) return;

    try {
      const sourceSnap = await getDoc(doc(this.firestore, 'assessments', item.id));
      if (!sourceSnap.exists()) {
        this.snackBar.open(
          this.translate.instant('assessments.duplicate.notFound'),
          this.translate.instant('Fechar'),
          { duration: 3000 }
        );
        return;
      }
      const src = sourceSnap.data();
      const clientName =
        this.clients.find((c) => c.id === targetClientId)?.companyName || '';
      const currentUser = await this.authService.getCurrentUser();
      await addDoc(collection(this.firestore, 'assessments'), {
        name: `${src['name'] || item.name} (${clientName})`.trim(),
        description: src['description'] || '',
        clientId: targetClientId,
        isGlobalTemplate: false,
        competencyIds: src['competencyIds'] || [],
        mixQuestions: src['mixQuestions'] ?? true,
        competencyGroupId: null,
        surveyJSON: src['surveyJSON'] || {},
        theme: src['theme'] || null,
        createdBy: currentUser
          ? {
              name: currentUser.name,
              email: currentUser.email,
              role: currentUser.role,
            }
          : src['createdBy'] || { name: 'Desconhecido' },
        createdAt: new Date(),
      });
      this.snackBar.open(
        this.translate.instant('assessments.duplicate.success'),
        this.translate.instant('Fechar'),
        { duration: 3500 }
      );
      await this.loadAssessments();
      this.buildCreators();
      this.applyFilters();
    } catch (error) {
      console.error('Erro ao duplicar formulário:', error);
      this.snackBar.open(
        this.translate.instant('assessments.duplicate.error'),
        this.translate.instant('Fechar'),
        { duration: 4000 }
      );
    }
  }

  createNewAssessment(): void {
    this.router.navigate(['/assessments/new']);
  }

  editAssessment(id: string): void {
    this.router.navigate([`/assessments/${id}/edit`]);
  }

  async deleteAssessment(id: string): Promise<void> {
    const nome = this.dataSource.data.find((a: any) => a.id === id)?.name || id;

    // Bloquear exclusão se houver respostas completadas
    const completedLinksSnap = await getDocs(query(
      collection(this.firestore, 'assessmentLinks'),
      where('assessmentId', '==', id),
      where('status', '==', 'completed')
    ));
    if (!completedLinksSnap.empty) {
      this.snackBar.open(
        `Não é possível excluir: há ${completedLinksSnap.size} resposta(s) registrada(s) para este formulário.`,
        'Fechar',
        { duration: 5000 }
      );
      return;
    }

    const confirmado = await this.confirmDialog.confirmDelete(nome);
    if (!confirmado) return;
    try {
      const assessmentDocRef = doc(this.firestore, `assessments/${id}`);
      await deleteDoc(assessmentDocRef);
      this.dataSource.data = this.dataSource.data.filter(
        (item) => item.id !== id
      );
      this.snackBar.open(this.translate.instant('Avaliação excluída com sucesso.'), this.translate.instant('Fechar'), {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao excluir avaliação:', error);
      this.snackBar.open(this.translate.instant('Erro ao excluir avaliação.'), this.translate.instant('Fechar'), {
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
      this.snackBar.open(this.translate.instant('Erro ao carregar pré-visualização.'), this.translate.instant('Fechar'), { duration: 3000 });
    }
  }

  goBack(): void {
    this.location.back();
  }
}
