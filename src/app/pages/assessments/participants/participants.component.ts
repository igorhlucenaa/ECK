import {
  Component,
  OnInit,
  ViewChild,
  Inject,
  Optional,
  AfterViewInit,
} from '@angular/core';
import {
  Firestore,
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteField,
  where,
  addDoc,
  deleteDoc,
  writeBatch,
  arrayUnion,
  runTransaction,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import * as XLSX from 'xlsx';
import {
  MatDialog,
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { FormBuilder, Validators } from '@angular/forms';
import { ParticipantsConfirmationDialogComponent } from './participants-confirmation-dialog/participants-confirmation-dialog.component';
import { EditParticipantDialogComponent } from './edit-participant-dialog/edit-participant-dialog.component';
import { ConfirmDialogComponent } from '../../clients/clients-list/confirm-dialog/confirm-dialog.component';
import { AddParticipantModalComponent } from '../../project/add-participant-modal/add-participant-modal.component';
import { RelatorioPreviewDialogComponent } from '../../project/participants-modal/relatorio-preview-dialog.component';
import { SendHistoryDialogComponent } from './send-history-dialog/send-history-dialog.component';
import { ReportGenerationModalComponent } from '../../project/report-generation-modal/report-generation-modal.component';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { ProjectService } from 'src/app/services/project.service';
import { ParticipantValidationService } from 'src/app/services/participant-validation.service';
import { ParticipantCreditService } from 'src/app/services/participant-credit.service';
import { HasPermissionDirective } from 'src/app/directives/has-permission.directive';
import { hasPermission, AppRole } from 'src/app/config/permissions.config';
import { Auth, sendPasswordResetEmail, ActionCodeSettings } from '@angular/fire/auth';
import { FirebaseApp } from '@angular/fire/app';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';

interface ModalData {
  projectId?: string;
  clientId?: string;
  templateId?: string;
  emailType?: string;
}

interface UnifiedParticipant {
  id: string;
  name: string;
  email: string;
  assessmentId?: string;
  sentAt?: Date;
  completedAt?: Date;
  status?: string;
  category: string;
  type: 'avaliado' | 'avaliador';
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  selected?: boolean;
  avaliadoId?: string;
  cargo?: string;
  setor?: string;
  creditReserved?: boolean;
  // Dados de lembrete automático
  reminderCount?: number;
  nextReminderAt?: Date;
  lastReminderAt?: Date;
  reminderEnabled?: boolean;
  maxReminders?: number;
  intervalDays?: number;
  reminderSendTime?: string;
  reminderTimezone?: string;
  blocked?: boolean;
  blockedAt?: Date;
  blockedBy?: string;
}

interface Client {
  id: string;
  name: string;
  credits?: number;
  reservedCredits?: number;
  consumedCredits?: number;
  creditsPurchased?: number;
}

interface Project {
  id: string;
  name: string;
  clientId: string;
  assessmentId?: string;
}

interface MailTemplate {
  id: string;
  name: string;
  content: string;
  emailType: string;
  subject: string;
  clientId: string;
}

interface Assessment {
  id: string;
  name: string;
}

@Component({
  selector: 'app-participants',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, AppPageHeaderComponent, RouterLink, HasPermissionDirective],
  templateUrl: './participants.component.html',
  styleUrls: ['./participants.component.scss'],
})
export class ParticipantsComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = [
    'select',
    'name',
    'type',
    'category',
    'cargo',
    'projectName',
    'status',
    'lembrete',
    'datas',
    'relatorio',
  ];

  dataSource = new MatTableDataSource<UnifiedParticipant>([]);
  searchValue: string = '';
  filterType: string = '';
  filterCategory: string = '';
  filterStatus: string = '';
  filterClient: string = '';
  filterProject: string = '';
  clients: Client[] = [];
  projects: Project[] = [];
  filteredProjects: Project[] = [];
  mailTemplates: MailTemplate[] = [];
  assessments: Assessment[] = [];
  selectedParticipants: UnifiedParticipant[] = [];
  isLoading: boolean = false;
  isInitializing: boolean = true; // overlay de tela cheia durante carregamento inicial
  // Inicia como true: spinner aparece no primeiro frame do dialog,
  // antes mesmo de ngOnInit carregar os dados — evita cliques acidentais
  isTableLoading: boolean = true;
  isRefreshing: boolean = false;
  lastRefreshed: Date | null = null;
  templateFormControl = this.fb.control('', Validators.required);
  assessmentFormControl = this.fb.control('', Validators.required);
  /** Formulário travado no assessmentId definido na criação do projeto */
  projectAssessmentLocked = false;
  selectedTemplate: MailTemplate | any = null;
  userRole: string = '';
  userClientIds: string[] = [];
  viewerProjectIds: string[] = [];
  isClientDisabled: boolean = false;
  isProjectDisabled: boolean = false;
  projectStatus: string = '';
  isEmailSendingMode: boolean = false;
  emailType: string | undefined;
  reportTemplates: any[] = [];
  // Removido: seleção de template fora do modal
  reportTemplateFormControl = this.fb.control('', Validators.required);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  get canManageParticipantData(): boolean {
    return hasPermission(this.userRole as AppRole, 'criar');
  }

  get canEditParticipants(): boolean {
    return hasPermission(this.userRole as AppRole, 'editar');
  }

  get canDeleteParticipants(): boolean {
    return hasPermission(this.userRole as AppRole, 'excluir');
  }

  get canMutateProjectParticipants(): boolean {
    return (
      !this.isProjectConcluded &&
      !this.isProjectCancelled &&
      (this.canManageParticipantData || this.canEditParticipants || this.canDeleteParticipants)
    );
  }

  private ensureCanMutateParticipants(action: 'criar' | 'editar' | 'excluir' = 'editar'): boolean {
    if (!hasPermission(this.userRole as AppRole, action)) {
      this.snackBar.open('Você não tem permissão para esta ação.', 'Fechar', { duration: 4000 });
      return false;
    }
    if (this.isProjectConcluded || this.isProjectCancelled) {
      this.snackBar.open(
        `Ação bloqueada: projeto ${this.projectStatusLabel || 'indisponível'}.`,
        'Fechar',
        { duration: 4000 }
      );
      return false;
    }
    return true;
  }

  get canManageViewers(): boolean {
    return hasPermission(this.userRole as AppRole, 'gerenciar_viewers');
  }

  canBlockParticipant(participant: UnifiedParticipant): boolean {
    if (!hasPermission(this.userRole as AppRole, 'bloquear')) return false;
    if (this.userRole === 'admin_master') return true;
    if (this.userRole === 'admin_client') {
      return this.userClientIds.includes(participant.clientId);
    }
    return false;
  }

  get isProjectConcluded(): boolean {
    return ['Concluído', 'concluido'].includes(this.projectStatus);
  }

  get isProjectCancelled(): boolean {
    return ['Cancelado', 'cancelado'].includes(this.projectStatus);
  }

  get projectStatusLabel(): string {
    if (this.isProjectConcluded) return 'Concluído';
    if (this.isProjectCancelled) return 'Cancelado';
    if (this.projectStatus) return 'Em andamento';
    return '';
  }

  get projectStatusClass(): string {
    if (this.isProjectConcluded) return 'project-status--green';
    if (this.isProjectCancelled) return 'project-status--red';
    return 'project-status--blue';
  }

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private projectService: ProjectService,
    private participantValidationService: ParticipantValidationService,
    private participantCreditService: ParticipantCreditService,
    private auth: Auth,
    private firebaseApp: FirebaseApp,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: ModalData | null,
    @Optional() public dialogRef: MatDialogRef<ParticipantsComponent>
  ) {}

  async ngOnInit(): Promise<void> {
    this.isTableLoading = true;

    this.userRole = await this.authService.getCurrentUserRole() || '';
    this.userClientIds = await this.authService.getCurrentUserClientIds();

    if (this.userRole === 'viewer') {
      await this.loadViewerProjectIds();
    }

    this.isEmailSendingMode =
      !!this.data && !!this.data.templateId && !!this.data.emailType;
    this.emailType = this.data?.emailType;

    await Promise.all([
      this.loadClients(),
      this.loadProjects(),
      this.loadParticipants(),
    ]);

    this.isTableLoading = false;
    this.isInitializing = false;

    this.configureDataSource();

  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  configureDataSource(): void {
    this.dataSource.filterPredicate = (
      data: UnifiedParticipant,
      filter: string
    ) => {
      const searchStr =
        `${data.name} ${data.email} ${data.projectName} ${data.clientName}`.toLowerCase();
      const typeMatch = !this.filterType || data.type === this.filterType;
      const categoryMatch =
        !this.filterCategory || data.category === this.filterCategory;
      const statusMatch = !this.filterStatus || (
        this.filterStatus === '__blocked__'
          ? data.blocked === true
          : data.status === this.filterStatus && !data.blocked
      );
      const clientMatch =
        !this.filterClient || data.clientId === this.filterClient;
      const projectMatch =
        !this.filterProject || data.projectId === this.filterProject;
      const emailTypeMatch = this.applyEmailTypeFilter(data);
      return (
        searchStr.includes(this.searchValue.trim().toLowerCase()) &&
        typeMatch &&
        categoryMatch &&
        statusMatch &&
        clientMatch &&
        projectMatch &&
        emailTypeMatch
      );
    };

    this.dataSource.sortData = (data: any[], sort: MatSort) => {
      const active = sort.active;
      const direction = sort.direction;
      if (!active || direction === '') return data;

      return data.sort((a, b) => {
        const isAsc = direction === 'asc';
        switch (active) {
          case 'name':
            return this.compare(a.name, b.name, isAsc);
          case 'email':
            return this.compare(a.email, b.email, isAsc);
          case 'type':
            return this.compare(a.type, b.type, isAsc);
          case 'category':
            return this.compare(a.category, b.category, isAsc);
          case 'projectName':
            return this.compare(a.projectName, b.projectName, isAsc);
          case 'status':
            return this.compare(a.status, b.status, isAsc);
          case 'sentAt':
            return this.compareDates(a.sentAt, b.sentAt, isAsc);
          case 'completedAt':
            return this.compareDates(a.completedAt, b.completedAt, isAsc);
          default:
            return 0;
        }
      });
    };

    if (this.paginator && this.sort) {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    }

    if (this.isEmailSendingMode) {
      this.displayedColumns = [
        'select', 'name', 'email', 'type', 'category',
        'projectName', 'status', 'sentAt', 'completedAt',
      ];
      this.filterClient = this.data!.clientId!;
      this.isClientDisabled = true;
      this.filterProject = this.data!.projectId || '';
      this.isProjectDisabled = true;

      this.loadTemplate(this.data!.templateId!).then(() => {
        this.loadAssessments().then(async () => {
          this.filteredProjects = this.projects.filter(
            (project) => project.clientId === this.filterClient
          );
          this.loadReportTemplates();
          await this.syncProjectAssessment();

          if (
            ['conviteAvaliador', 'lembreteAvaliador'].includes(
              this.data!.emailType!
            )
          ) {
            this.filterType = 'avaliador';
          } else if (
            [
              'conviteRespondente',
              'lembreteRespondente',
              'convite',
              'lembrete',
            ].includes(this.data!.emailType!)
          ) {
            this.filterType = 'avaliado';
          }

          this.applyFilter();
        });
      });
    } else if (this.data && this.data.clientId && this.data.projectId) {
      this.filterClient = this.data.clientId;
      this.filterProject = this.data.projectId;
      this.isClientDisabled = true;
      this.isProjectDisabled = true;
      this.loadProjectStatus();

      Promise.all([this.loadMailTemplates(), this.loadAssessments(), this.loadReportTemplates()]).then(
        async () => {
          this.filteredProjects = this.projects.filter(
            (project) => project.clientId === this.filterClient
          );
          await this.syncProjectAssessment();
          this.applyFilter();
        }
      );
    } else {
      Promise.all([this.loadMailTemplates(), this.loadAssessments()]).then(
        () => {
          this.filteredProjects = [...this.projects];
          this.applyFilter();
        }
      );
    }
  }

  async loadTemplate(templateId: string): Promise<void> {
    const templateRef = doc(this.firestore, 'mailTemplates', templateId);
    const templateDoc = await getDoc(templateRef);
    if (templateDoc.exists()) {
      const templateData = templateDoc.data();
      this.selectedTemplate = {
        id: templateDoc.id,
        name: templateData['name'] || 'Sem Nome',
        content: templateData['content'] || '',
        emailType: this.data!.emailType!,
        subject: templateData['subject'] || '',
        clientId: this.data!.clientId!,
      };
      this.mailTemplates = [this.selectedTemplate];
      this.templateFormControl.setValue(this.selectedTemplate.id);
      this.templateFormControl.disable();
    } else {
      this.snackBar.open('Template não encontrado.', 'Fechar', {
        duration: 3000,
      });
      this.dialogRef.close();
    }
  }

  applyEmailTypeFilter(data: UnifiedParticipant): boolean {
    if (!this.selectedTemplate && !this.isEmailSendingMode) return true;

    const emailType = this.isEmailSendingMode
      ? this.emailType
      : this.selectedTemplate?.emailType;
    if (!emailType) return true;

    if (emailType === 'cadastro') return true;
    if (['conviteAvaliador', 'lembreteAvaliador'].includes(emailType)) {
      return data.type === 'avaliador';
    }
    if (
      [
        'conviteRespondente',
        'lembreteRespondente',
        'convite',
        'lembrete',
      ].includes(emailType)
    ) {
      return data.type === 'avaliado';
    }
    return true;
  }

  private async loadViewerProjectIds(): Promise<void> {
    this.viewerProjectIds = [];
    const email = await this.authService.getCurrentUserEmail();
    if (!email) return;

    const usersSnap = await getDocs(query(collection(this.firestore, 'users'), where('email', '==', email)));
    if (usersSnap.empty) return;

    const userDocId = usersSnap.docs[0].id;
    const userData = usersSnap.docs[0].data();
    const isOnNewStructure = 'groups' in userData;
    const projectIds = new Set<string>();

    // Fonte principal: grupos onde o viewer aparece em userIds
    const groupsSnap = await getDocs(
      query(collection(this.firestore, 'userGroups'), where('userIds', 'array-contains', userDocId))
    );

    const allProjectsClientIds = new Set<string>();
    groupsSnap.forEach(snap => {
      const gData = snap.data();
      if (gData['allProjects'] === true && gData['clientId']) {
        allProjectsClientIds.add(gData['clientId']);
      } else {
        (gData['projectIds'] || []).forEach((id: string) => projectIds.add(id));
      }
    });

    // Grupos com allProjects: buscar todos os projetos do cliente
    if (allProjectsClientIds.size > 0) {
      const projSnap = await getDocs(
        query(collection(this.firestore, 'projects'), where('clientId', 'in', [...allProjectsClientIds]))
      );
      projSnap.forEach(d => projectIds.add(d.id));
    }

    // Fallback legado: apenas se nunca foi migrado para grupos
    if (!isOnNewStructure && projectIds.size === 0) {
      const fromArray = Array.isArray(userData['projects']) ? userData['projects'] : [];
      const fromSingle = userData['project'] ? [userData['project']] : [];
      [...fromArray, ...fromSingle].forEach((id: string) => projectIds.add(id));
    }

    this.viewerProjectIds = [...projectIds];
  }

  async loadClients(): Promise<void> {
    try {
      let docs: any[] = [];
      if (this.userRole !== 'admin_master' && this.userClientIds.length > 0) {
        const snaps = await Promise.all(
          this.userClientIds.map(id => getDoc(doc(this.firestore, 'clients', id)))
        );
        docs = snaps.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() }));
      } else if (this.userRole === 'admin_master') {
        const snapshot = await getDocs(collection(this.firestore, 'clients'));
        docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      this.clients = docs.map(d => ({
        id: d.id,
        name: d['companyName'] || 'Cliente Sem Nome',
        credits: d['credits'] ?? 0,
        reservedCredits: d['reservedCredits'] ?? 0,
        consumedCredits: d['consumedCredits'] ?? 0,
        creditsPurchased: 0, // calculado abaixo
      }));

      // Calcular créditos comprados (pedidos aprovados e vigentes) para cada cliente
      const now = new Date();
      await Promise.all(this.clients.map(async client => {
        try {
          const ordersSnap = await getDocs(query(
            collection(this.firestore, 'creditOrders'),
            where('clientId', '==', client.id),
            where('status', '==', 'Aprovado')
          ));
          let purchased = 0;
          ordersSnap.docs.forEach(d => {
            const validity = d.data()['validityDate']?.toDate();
            // Alinhado ao restante do sistema: pedido sem validade ou ainda vigente
            if (!validity || validity >= now) purchased += (d.data()['credits'] || 0);
          });
          client.creditsPurchased = purchased;
        } catch { client.creditsPurchased = 0; }
      }));
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open('Erro ao carregar clientes.', 'Fechar', { duration: 3000 });
    }
  }




  async loadProjects(): Promise<void> {
    try {
      const projectsCollection = collection(this.firestore, 'projects');
      let snapshot;
      if (this.userRole === 'viewer' && this.viewerProjectIds.length > 0) {
        snapshot = await getDocs(query(projectsCollection, where('__name__', 'in', this.viewerProjectIds)));
      } else if (this.userRole === 'viewer') {
        this.projects = []; this.filteredProjects = []; return;
      } else if (this.userRole === 'admin_client' && this.userClientIds.length > 0) {
        snapshot = await getDocs(query(projectsCollection, where('clientId', 'in', this.userClientIds)));
      } else {
        snapshot = await getDocs(projectsCollection);
      }
      this.projects = snapshot.docs.map((d) => ({
        id: d.id,
        name: d.data()['name'] || 'Projeto Sem Nome',
        clientId: d.data()['clientId'] || '',
        assessmentId: d.data()['assessmentId'] || undefined,
      }));
      this.filteredProjects = [...this.projects];
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      this.snackBar.open('Erro ao carregar projetos.', 'Fechar', { duration: 3000 });
    }
  }

  async refreshTable(): Promise<void> {
    this.isRefreshing = true;
    await this.loadParticipants();
    this.isRefreshing = false;
    this.lastRefreshed = new Date();
  }

  async loadParticipants(): Promise<void> {
    this.isTableLoading = true;
    try {
      const participantsCollection = collection(this.firestore, 'participants');
      let participantsSnapshot;
      if (this.userRole === 'viewer' && this.viewerProjectIds.length > 0) {
        participantsSnapshot = await getDocs(query(participantsCollection, where('projectId', 'in', this.viewerProjectIds)));
      } else if (this.userRole === 'viewer') {
        this.dataSource.data = []; return;
      } else if (this.userRole === 'admin_client' && this.userClientIds.length > 0) {
        participantsSnapshot = await getDocs(query(participantsCollection, where('clientId', 'in', this.userClientIds)));
      } else {
        participantsSnapshot = await getDocs(participantsCollection);
      }

      if (participantsSnapshot.empty) {
        this.dataSource.data = [];
        return;
      }

      const projectIds = new Set<string>();
      participantsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data['projectId']) projectIds.add(data['projectId']);
      });

      const projectsMap: { [key: string]: { name: string; clientId: string; assessmentId?: string } } =
        {};
      if (projectIds.size > 0) {
        const projectsPromises = Array.from(projectIds).map(
          async (projectId) => {
            const projectDoc = doc(this.firestore, 'projects', projectId);
            const projectSnapshot = await getDoc(projectDoc);
            if (projectSnapshot.exists()) {
              const pd = projectSnapshot.data();
              projectsMap[projectId] = {
                name: pd['name'] || 'Projeto Sem Nome',
                clientId: pd['clientId'] || '',
                assessmentId: pd['assessmentId'] || undefined,
              };
            } else {
              projectsMap[projectId] = { name: 'N/A', clientId: '' };
            }
          }
        );
        await Promise.all(projectsPromises);
      }

      const clientIds = new Set<string>();
      participantsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data['clientId']) clientIds.add(data['clientId']);
      });
      Object.values(projectsMap).forEach((project) => {
        if (project.clientId) clientIds.add(project.clientId);
      });

      const clientsMap: { [key: string]: string } = {};
      // Chave: clientId (nível cliente) ou `${clientId}_${projectId}` (nível projeto)
      const reminderSettingsMap: { [key: string]: { enabled: boolean; intervalDays: number; maxReminders: number; sendTime: string; timezone: string } } = {};

      // Carrega dados dos clientes
      if (clientIds.size > 0) {
        await Promise.all(Array.from(clientIds).map(async (clientId) => {
          const clientSnapshot = await getDoc(doc(this.firestore, 'clients', clientId));
          clientsMap[clientId] = clientSnapshot.exists()
            ? (clientSnapshot.data()['companyName'] || 'Cliente Sem Nome')
            : 'N/A';
        }));
      }

      // Carrega configurações de lembrete por projeto (chave: `${clientId}_${projectId}`)
      const projectClientCombos = Array.from(projectIds)
        .map(pid => ({ projectId: pid, clientId: projectsMap[pid]?.clientId }))
        .filter(c => c.clientId);

      if (projectClientCombos.length > 0) {
        await Promise.all(projectClientCombos.map(async ({ projectId, clientId }) => {
          const docKey = `${clientId}_${projectId}`;
          try {
            const remDoc = await getDoc(doc(this.firestore, 'reminderSettings', docKey));
            reminderSettingsMap[docKey] = remDoc.exists() ? {
              enabled: !!remDoc.data()['enabled'],
              intervalDays: Number(remDoc.data()['intervalDays'] || 3),
              maxReminders: Number(remDoc.data()['maxReminders'] || 0),
              sendTime: String(remDoc.data()['sendTime'] || '09:00'),
              timezone: String(remDoc.data()['timezone'] || 'America/Fortaleza'),
            } : { enabled: false, intervalDays: 3, maxReminders: 0, sendTime: '09:00', timezone: 'America/Fortaleza' };
          } catch {
            reminderSettingsMap[docKey] = { enabled: false, intervalDays: 3, maxReminders: 0, sendTime: '09:00', timezone: 'America/Fortaleza' };
          }
        }));
      }

      const participants: UnifiedParticipant[] = [];
      for (const doc of participantsSnapshot.docs) {
        const participantId = doc.id;
        const participantData = doc.data();
        const projectId = participantData['projectId'] || '';
        let clientId = participantData['clientId'] || '';

        if (!clientId && projectId && projectsMap[projectId]) {
          clientId = projectsMap[projectId].clientId;
        }

        const email = participantData['email'] || 'Sem e-mail';
        const type = participantData['type'] as 'avaliado' | 'avaliador';
        const category = participantData['category'] || 'N/A';
        const assessments = participantData['assessments'] || [];

        let sentAt: Date | undefined;
        let completedAt: Date | undefined;
        let status: string = 'Não Enviado';
        let reminderCount: number = 0;
        let nextReminderAt: Date | undefined;
        let lastReminderAt: Date | undefined;

        const selectedAssessmentId = this.assessmentFormControl.value;
        const projectAssessmentId = projectsMap[projectId]?.assessmentId;
        let assessmentIdsToQuery: string[] = [];

        if (selectedAssessmentId) {
          assessmentIdsToQuery = [selectedAssessmentId];
        } else if (assessments.length > 0) {
          assessmentIdsToQuery = assessments;
        } else if (projectAssessmentId) {
          assessmentIdsToQuery = [projectAssessmentId];
        }

        let resolvedAssessmentId: string | undefined =
          assessments.length > 0
            ? assessments[0]
            : (selectedAssessmentId || projectAssessmentId || undefined);
        let creditReserved = participantData['creditReserved'] === true;

        const processLinks = (linksSnapshot: any) => {
          linksSnapshot.docs.forEach((linkDoc: any) => {
            const linkData = linkDoc.data();
            const linkStatus: string = linkData['status'] || '';

            // Links cancelados ou expirados não contribuem para nenhum estado —
            // sem eles, determineStatus retorna 'Não Enviado' corretamente.
            if (linkStatus === 'cancelled' || linkStatus === 'expired') return;

            if (!resolvedAssessmentId && linkData['assessmentId']) {
              resolvedAssessmentId = linkData['assessmentId'];
            }
            if (linkData['sentAt']) {
              const linkSentAt = (linkData['sentAt'] as Timestamp).toDate();
              if (!sentAt || linkSentAt > sentAt) sentAt = linkSentAt;
            }
            if (linkStatus === 'completed' && linkData['completedAt']) {
              const linkCompletedAt = (linkData['completedAt'] as Timestamp).toDate();
              if (!completedAt || linkCompletedAt > completedAt) completedAt = linkCompletedAt;
            }
            // Dados de lembrete (do link mais recente com dados de lembrete)
            const rc = Number(linkData['reminderCount'] || 0);
            if (rc > reminderCount) reminderCount = rc;
            if (linkData['nextReminderAt']) {
              const nra = (linkData['nextReminderAt'] as Timestamp).toDate();
              if (!nextReminderAt || nra < nextReminderAt) nextReminderAt = nra;
            }
            if (linkData['lastReminderSentAt']) {
              const lrs = (linkData['lastReminderSentAt'] as Timestamp).toDate();
              if (!lastReminderAt || lrs > lastReminderAt) lastReminderAt = lrs;
            }
            if (linkData['creditReserved'] === true && !creditReserved) {
              creditReserved = true;
            }
          });
        };

        let linksLoaded = false;

        // 1) Links do projeto (fonte mais confiável ao abrir a partir de /projects)
        if (projectId) {
          const projectLinksQuery = query(
            collection(this.firestore, 'assessmentLinks'),
            where('participantId', '==', participantId),
            where('projectId', '==', projectId)
          );
          const projectLinksSnap = await getDocs(projectLinksQuery);
          if (!projectLinksSnap.empty) {
            processLinks(projectLinksSnap);
            status = this.determineStatus(sentAt, completedAt);
            linksLoaded = true;
          }
        }

        // 2) Links da(s) avaliação(ões) vinculada(s)
        if (!linksLoaded && assessmentIdsToQuery.length > 0) {
          const batchSize = 10;
          for (let i = 0; i < assessmentIdsToQuery.length; i += batchSize) {
            const batch = assessmentIdsToQuery.slice(i, i + batchSize);
            const assessmentLinksQuery = query(
              collection(this.firestore, 'assessmentLinks'),
              where('participantId', '==', participantId),
              where('assessmentId', 'in', batch)
            );
            const linksSnapshot = await getDocs(assessmentLinksQuery);
            if (!linksSnapshot.empty) {
              processLinks(linksSnapshot);
              status = this.determineStatus(sentAt, completedAt);
              linksLoaded = true;
            }
          }
        }

        // 3) Discovery: qualquer link do participante (links legados sem projectId)
        if (!linksLoaded) {
          const discoveryQuery = query(
            collection(this.firestore, 'assessmentLinks'),
            where('participantId', '==', participantId)
          );
          const discoverySnap = await getDocs(discoveryQuery);
          if (!discoverySnap.empty) {
            processLinks(discoverySnap);
            status = this.determineStatus(sentAt, completedAt);
          }
        }

        if (clientId) {
          participants.push({
            id: participantId,
            name: participantData['name'] || 'Desconhecido',
            email: email,
            assessmentId: resolvedAssessmentId,
            sentAt: sentAt,
            completedAt: completedAt,
            status: status,
            category: category,
            type: type,
            projectId: projectId,
            projectName: projectsMap[projectId]?.name || 'N/A',
            clientId: clientId,
            clientName: clientsMap[clientId] || 'N/A',
            selected: false,
            avaliadoId: participantData['avaliadoId'] || undefined,
            cargo: participantData['cargo'] || undefined,
            setor: participantData['setor'] || undefined,
            creditReserved,
            reminderCount,
            nextReminderAt,
            lastReminderAt,
            reminderEnabled: reminderSettingsMap[`${clientId}_${projectId}`]?.enabled ?? false,
            maxReminders: reminderSettingsMap[`${clientId}_${projectId}`]?.maxReminders ?? 0,
            intervalDays: reminderSettingsMap[`${clientId}_${projectId}`]?.intervalDays ?? 3,
            reminderSendTime: reminderSettingsMap[`${clientId}_${projectId}`]?.sendTime ?? '09:00',
            reminderTimezone: reminderSettingsMap[`${clientId}_${projectId}`]?.timezone ?? 'America/Fortaleza',
            blocked: participantData['blocked'] === true,
            blockedAt: participantData['blockedAt']?.toDate?.() ?? undefined,
            blockedBy: participantData['blockedBy'] || undefined,
          });
        }
      }

      this.dataSource.data = participants;
      this.applyFilter();
    } catch (error) {
      console.error('Erro ao carregar participantes:', error);
      this.snackBar.open('Erro ao carregar participantes.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isTableLoading = false;
      if (this.paginator && this.sort) {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
      }
    }
  }

  async loadMailTemplates(): Promise<void> {
    try {
      if (!this.filterClient) {
        this.mailTemplates = [];
        this.templateFormControl.setValue('');
        return;
      }

      const templatesCollection = collection(this.firestore, 'mailTemplates');
      const templatesQuery = query(
        templatesCollection,
        where('clientId', '==', this.filterClient)
      );
      const snapshot = await getDocs(templatesQuery);

      this.mailTemplates = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Sem Nome',
        content: doc.data()['content'] || '',
        emailType: doc.data()['emailType'] || '',
        subject: doc.data()['subject'] || '',
        clientId: doc.data()['clientId'] || '',
      }));

      if (this.mailTemplates.length === 0) {
        this.snackBar.open(
          'Nenhum template encontrado para este cliente.',
          'Fechar',
          {
            duration: 3000,
          }
        );
      }
    } catch (error) {
      console.error('Erro ao carregar Modelos de e-mail:', error);
      this.snackBar.open('Erro ao carregar Modelos de e-mail.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadAssessments(): Promise<void> {
    try {
      if (!this.filterClient) {
        this.assessments = [];
        this.assessmentFormControl.setValue('');
        return;
      }

      const assessmentsCollection = collection(this.firestore, 'assessments');
      const assessmentsQuery = query(
        assessmentsCollection,
        where('clientId', '==', this.filterClient)
      );
      const snapshot = await getDocs(assessmentsQuery);

      this.assessments = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Avaliação Sem Nome',
      }));

      if (this.assessments.length === 0) {
        this.snackBar.open(
          'Nenhuma avaliação encontrada para este cliente.',
          'Fechar',
          {
            duration: 3000,
          }
        );
      }
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      this.snackBar.open('Erro ao carregar avaliações.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadReportTemplates(): Promise<void> {
    if (!this.filterClient) {
      this.reportTemplates = [];
      return;
    }
    const templatesCollection = collection(this.firestore, 'reportTemplates');
    const snapshot = await getDocs(
      query(templatesCollection, where('clientId', '==', this.filterClient))
    );
    this.reportTemplates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  determineStatus(sentAt?: Date, completedAt?: Date): string {
    if (completedAt) return 'Respondido';
    if (sentAt) return 'Enviado (Pendente)';
    return 'Não Enviado';
  }

  async toggleBlockParticipant(participant: UnifiedParticipant): Promise<void> {
    if (!this.canBlockParticipant(participant)) {
      this.snackBar.open('Você não tem permissão para bloquear este participante.', 'Fechar', {
        duration: 4000,
      });
      return;
    }

    const newBlocked = !participant.blocked;
    const actionKey = newBlocked ? 'bloquear' : 'desbloquear';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        message: newBlocked
          ? `Bloquear "${participant.name}"? Ele não poderá responder à avaliação, mesmo que o e-mail já tenha sido enviado.`
          : `Desbloquear "${participant.name}"? Ele voltará a poder acessar e responder a avaliação pelo link recebido.`,
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;

      try {
        const blockedBy = this.auth.currentUser?.email || this.auth.currentUser?.uid || '';
        await updateDoc(doc(this.firestore, `participants/${participant.id}`), {
          blocked: newBlocked,
          blockedAt: newBlocked ? Timestamp.now() : null,
          blockedBy: newBlocked ? blockedBy : null,
        });

        const patch = (p: UnifiedParticipant) =>
          p.id === participant.id
            ? {
                ...p,
                blocked: newBlocked,
                blockedAt: newBlocked ? new Date() : undefined,
                blockedBy: newBlocked ? blockedBy : undefined,
                selected: false,
              }
            : p;

        this.dataSource.data = this.dataSource.data.map(patch);
        this.applyFilter();

        const msg = newBlocked
          ? 'Participante bloqueado com sucesso.'
          : 'Participante desbloqueado com sucesso.';
        this.snackBar.open(msg, 'Fechar', { duration: 3000 });
      } catch (error) {
        console.error(`Erro ao ${actionKey} participante:`, error);
        this.snackBar.open('Erro ao alterar o bloqueio do participante.', 'Fechar', {
          duration: 4000,
        });
      }
    });
  }

  getReminderTooltip(p: UnifiedParticipant): string {
    if (!p.reminderEnabled) return 'Lembretes automáticos não configurados para este cliente';
    if (p.maxReminders && p.maxReminders > 0 && (p.reminderCount ?? 0) >= p.maxReminders) {
      return `Limite de ${p.maxReminders} lembrete(s) atingido`;
    }

    const lines: string[] = [];

    // Data do próximo disparo (lida diretamente do Firestore via nextReminderAt)
    const nextDate = p.nextReminderAt;

    if (nextDate) {
      const now    = new Date();
      const diffMs = nextDate.getTime() - now.getTime();
      const diffH  = Math.round(diffMs / 3_600_000);
      const diffD  = Math.floor(diffMs / 86_400_000);

      let quando: string;
      if (diffMs < 0) {
        quando = 'Aguardando próximo ciclo de processamento';
      } else if (diffH < 1) {
        quando = 'Em menos de 1 hora';
      } else if (diffH < 24) {
        quando = `Em ~${diffH}h`;
      } else {
        quando = `Em ${diffD} dia${diffD !== 1 ? 's' : ''}`;
      }

      const fmt = nextDate.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      lines.push(`Próximo disparo: ${fmt} (${quando})`);
    } else {
      lines.push('Próximo disparo: não agendado');
    }

    // Último lembrete enviado
    if (p.lastReminderAt) {
      const fmt = p.lastReminderAt.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      lines.push(`Último enviado: ${fmt}`);
    }

    // Contagem
    const countLabel = p.maxReminders && p.maxReminders > 0
      ? `${p.reminderCount ?? 0} de ${p.maxReminders} lembrete(s) enviado(s)`
      : `${p.reminderCount ?? 0} lembrete(s) enviado(s)`;
    lines.push(countLabel);

    if (p.intervalDays) lines.push(`Intervalo: a cada ${p.intervalDays} dia(s)`);

    return lines.join('\n');
  }

  /** Calcula próximo disparo respeitando sendTime e timezone (mesmo algoritmo do reminder-settings). */
  private calcNextReminderDate(base: Date, intervalDays: number, sendTime: string, timezone: string): Date {
    const targetDay = new Date(base.getTime() + intervalDays * 86400000);
    const dateFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const dp = dateFmt.formatToParts(targetDay);
    const year  = dp.find(p => p.type === 'year')?.value  ?? '2000';
    const month = dp.find(p => p.type === 'month')?.value ?? '01';
    const day   = dp.find(p => p.type === 'day')?.value   ?? '01';
    const datePart = `${year}-${month}-${day}`;

    const noonUtc = new Date(`${datePart}T12:00:00Z`);
    const timeFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: false,
    });
    const tp = timeFmt.formatToParts(noonUtc);
    const tzH = Number(tp.find(p => p.type === 'hour')?.value   ?? '0');
    const tzM = Number(tp.find(p => p.type === 'minute')?.value ?? '0');
    const offsetMin = tzH * 60 + tzM - 720;

    const [sh, sm] = sendTime.split(':').map(Number);
    const utcMin = sh * 60 + sm - offsetMin;
    return new Date(new Date(`${datePart}T00:00:00Z`).getTime() + utcMin * 60000);
  }

  onClientChange(): void {
    this.filterProject = '';
    this.templateFormControl.setValue('');
    this.assessmentFormControl.setValue('');
    this.projectAssessmentLocked = false;
    this.mailTemplates = [];
    this.assessments = [];
    if (this.filterClient) {
      this.filteredProjects = this.projects.filter(
        (project) => project.clientId === this.filterClient
      );
      if (!this.isEmailSendingMode) this.loadMailTemplates();
      this.loadAssessments();
      this.loadReportTemplates();
    } else {
      this.filteredProjects = [...this.projects];
    }
    this.applyFilter();
  }

  async onProjectChange(): Promise<void> {
    this.applyFilter();
    await this.syncProjectAssessment();
    await this.loadProjectStatus();
  }

  get lockedAssessmentName(): string {
    const id = this.assessmentFormControl.value;
    if (!id) return '';
    return this.assessments.find((a) => a.id === id)?.name || 'Formulário do projeto';
  }

  private async syncProjectAssessment(): Promise<void> {
    if (!this.filterProject) {
      this.projectAssessmentLocked = false;
      this.assessmentFormControl.setValue('');
      return;
    }

    let assessmentId = this.projects.find((p) => p.id === this.filterProject)?.assessmentId;

    if (!assessmentId) {
      try {
        const snap = await getDoc(doc(this.firestore, 'projects', this.filterProject));
        if (snap.exists()) {
          assessmentId = snap.data()['assessmentId'] || '';
          const project = this.projects.find((p) => p.id === this.filterProject);
          if (project && assessmentId) {
            project.assessmentId = assessmentId;
          }
        }
      } catch {
        /* ignora falha pontual de leitura */
      }
    }

    if (!assessmentId) {
      this.projectAssessmentLocked = false;
      this.assessmentFormControl.setValue('');
      return;
    }

    await this.ensureAssessmentLoaded(assessmentId);
    this.projectAssessmentLocked = true;
    this.assessmentFormControl.setValue(assessmentId);
  }

  private async ensureAssessmentLoaded(assessmentId: string): Promise<void> {
    if (this.assessments.some((a) => a.id === assessmentId)) return;
    try {
      const snap = await getDoc(doc(this.firestore, 'assessments', assessmentId));
      if (snap.exists()) {
        this.assessments = [
          ...this.assessments,
          { id: assessmentId, name: snap.data()['name'] || 'Avaliação Sem Nome' },
        ];
      }
    } catch {
      /* ignora falha pontual de leitura */
    }
  }

  private async loadProjectStatus(): Promise<void> {
    if (!this.filterProject) { this.projectStatus = ''; return; }
    try {
      const snap = await getDoc(doc(this.firestore, 'projects', this.filterProject));
      if (!snap.exists()) { this.projectStatus = ''; return; }
      const status: string = snap.data()['status'] || '';
      this.projectStatus = status;

      // Migração automática: se o projeto está Concluído mas ainda tem créditos reservados,
      // dispara o concludeProject para mover reservedCredits → consumedCredits
      if (['Concluído', 'concluido'].includes(status)) {
        const reserved = await getDocs(query(
          collection(this.firestore, 'participants'),
          where('projectId', '==', this.filterProject),
          where('creditReserved', '==', true),
          where('creditConsumed', '==', false)
        ));
        if (!reserved.empty) {
          await this.projectService.concludeProject(this.filterProject, 'auto-migration').catch(() => {});
          // Recarrega os créditos do cliente após migração
          await this.loadClients();
        }
      }
    } catch { this.projectStatus = ''; }
  }

  getSelectedClientName(): string {
    return this.clients.find(c => c.id === this.filterClient)?.name || '';
  }

  get currentClientCredits(): { disponivel: number; reservado: number; consumido: number; totalComprado: number } | null {
    if (!this.filterClient) return null;
    const c = this.clients.find(cl => cl.id === this.filterClient);
    if (!c) return null;
    const totalComprado = c.creditsPurchased ?? 0;
    const reservado = c.reservedCredits ?? 0;
    const consumido = c.consumedCredits ?? 0;
    // Saldo real fica em clients.credits (debitado na reserva, não recalculado na conclusão)
    const disponivel = Math.max(0, c.credits ?? 0);
    return {
      totalComprado,
      reservado,
      consumido,
      disponivel,
    };
  }

  getSelectedProjectName(): string {
    return this.filteredProjects.find(p => p.id === this.filterProject)?.name || '';
  }

  onTemplateChange(): void {
    this.selectedTemplate =
      this.mailTemplates.find((t) => t.id === this.templateFormControl.value) ||
      null;
    this.applyFilter();
    this.updateSelection();
  }

  // Removido: seleção de template fora do modal

  applyFilter(): void {
    this.dataSource.filter = 'trigger'; // Valor arbitrário para acionar o filtro
    this.updateSelection();
    if (this.paginator) {
      this.dataSource.paginator = this.paginator; // Reaplicar paginator após filtro
      this.dataSource.paginator.firstPage(); // Resetar para a primeira página
    }
    if (this.sort) {
      this.dataSource.sort = this.sort; // Reaplicar sort após filtro
    }
  }

  toggleAll(checked: boolean): void {
    this.dataSource.filteredData.forEach((participant) => {
      if (!participant.completedAt && !participant.blocked && this.applyEmailTypeFilter(participant)) {
        participant.selected = checked;
      }
    });
    this.updateSelection();
  }

  /** Retorna true quando o usuário já selecionou modelo de e-mail E avaliação (se necessária) */
  get isSelectionReady(): boolean {
    if (!this.templateFormControl.valid) return false;
    const needsAssessment = this.selectedTemplate?.emailType && this.selectedTemplate?.emailType !== 'cadastro';
    if (needsAssessment && !this.assessmentFormControl.valid) return false;
    return true;
  }

  get selectionTooltip(): string {
    if (!this.templateFormControl.valid) return 'Selecione um modelo de e-mail primeiro';
    const needsAssessment = this.selectedTemplate?.emailType && this.selectedTemplate?.emailType !== 'cadastro';
    if (needsAssessment && !this.assessmentFormControl.valid) {
      if (this.filterProject && !this.projectAssessmentLocked) {
        return 'Defina o formulário no cadastro do projeto';
      }
      return 'Formulário de avaliação não configurado';
    }
    return '';
  }

  updateSelection(): void {
    this.selectedParticipants = this.dataSource.filteredData.filter(
      (p) => p.selected && this.applyEmailTypeFilter(p) && !p.completedAt && !p.blocked
    );
  }

  allSelected(): boolean {
    const eligibleParticipants = this.dataSource.filteredData.filter(
      (p) => this.applyEmailTypeFilter(p) && !p.completedAt && !p.blocked
    );
    return (
      eligibleParticipants.length > 0 &&
      eligibleParticipants.every((p) => p.selected)
    );
  }

  someSelected(): boolean {
    const eligibleParticipants = this.dataSource.filteredData.filter(
      (p) => this.applyEmailTypeFilter(p) && !p.completedAt && !p.blocked
    );
    return eligibleParticipants.some((p) => p.selected) && !this.allSelected();
  }

  async deleteSelectedParticipants(): Promise<void> {
    if (!this.ensureCanMutateParticipants('excluir')) return;
    const count = this.selectedParticipants.length;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { message: `Tem certeza de que deseja excluir ${count} participante(s)? Os links de avaliação e créditos reservados também serão removidos. Esta ação não pode ser desfeita.` },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      const BATCH_SIZE = 400;
      try {
        const linkRefs: any[] = [];
        const clientsToReload = new Set<string>();

        for (const p of this.selectedParticipants) {
          const linksSnap = await getDocs(query(
            collection(this.firestore, 'assessmentLinks'),
            where('participantId', '==', p.id)
          ));
          for (const linkDoc of linksSnap.docs) {
            linkRefs.push(linkDoc.ref);
          }

          const legacyCount = await this.participantCreditService.refundLegacyLinkCredits(
            linksSnap.docs,
            p.clientId
          );
          if (legacyCount > 0 && p.clientId) {
            clientsToReload.add(p.clientId);
          }

          const refunded = await this.participantCreditService.refundParticipantReservedCredit(p.id);
          if (refunded && p.clientId) {
            clientsToReload.add(p.clientId);
          }
        }

        for (let i = 0; i < linkRefs.length; i += BATCH_SIZE) {
          const batch = writeBatch(this.firestore);
          linkRefs.slice(i, i + BATCH_SIZE).forEach(ref => batch.delete(ref));
          await batch.commit();
        }

        for (let i = 0; i < this.selectedParticipants.length; i += BATCH_SIZE) {
          const batch = writeBatch(this.firestore);
          this.selectedParticipants.slice(i, i + BATCH_SIZE).forEach(p => batch.delete(doc(this.firestore, `participants/${p.id}`)));
          await batch.commit();
        }

        if (clientsToReload.size > 0) {
          await this.loadClients();
        }

        const removedIds = new Set(this.selectedParticipants.map(p => p.id));
        this.dataSource.data = this.dataSource.data.filter(p => !removedIds.has(p.id));
        this.selectedParticipants = [];
        this.applyFilter();
        this.snackBar.open('Participantes excluídos com sucesso!', 'Fechar', { duration: 3000 });
      } catch (error) {
        console.error('Erro ao excluir participantes em massa:', error);
        this.snackBar.open('Erro ao excluir participantes. Tente novamente.', 'Fechar', { duration: 3000 });
      }
    });
  }

  async resendLinks(): Promise<void> {
    if (!this.ensureCanMutateParticipants('criar')) return;
    // Auto-link: gestores/avaliadores são automaticamente vinculados ao único avaliado do projeto
    const assessmentId = this.assessmentFormControl.value;
    const nonAvaliados = this.selectedParticipants.filter(p => p.type !== 'avaliado');
    if (nonAvaliados.length > 0 && assessmentId) {
      const projectId = this.filterProject || this.selectedParticipants[0]?.projectId;
      if (projectId) {
        const singleAvaliadoId = await this.participantValidationService.getProjectEvaluateeId(projectId);
        if (singleAvaliadoId) {
          for (const p of nonAvaliados) {
            p.avaliadoId = singleAvaliadoId;
          }
        }
      }
    }

    this.isLoading = true;
    this.isTableLoading = true;
    try {

      let selectedTemplateId: any;
      if (this.isEmailSendingMode) {
        selectedTemplateId = this.data!.templateId!;
      } else {
        selectedTemplateId = this.templateFormControl.value;
        if (!selectedTemplateId) {
          this.snackBar.open(
            'Por favor, selecione um template antes de enviar.',
            'Fechar',
            {
              duration: 3000,
            }
          );
          return;
        }
      }

      const selectedAssessmentId = this.assessmentFormControl.value;
      if (
        (this.isEmailSendingMode &&
          this.emailType &&
          [
            'conviteAvaliador',
            'conviteRespondente',
            'lembreteAvaliador',
            'lembreteRespondente',
            'convite',
            'lembrete',
          ].includes(this.emailType) &&
          !selectedAssessmentId) ||
        (!this.isEmailSendingMode && !selectedAssessmentId)
      ) {
        this.snackBar.open(
          'Por favor, selecione uma avaliação antes de enviar.',
          'Fechar',
          {
            duration: 3000,
          }
        );
        return;
      }

      const templateDoc = await getDoc(doc(this.firestore, 'mailTemplates', selectedTemplateId));
      if (!templateDoc.exists()) {
        throw new Error('Template nao encontrado.');
      }

      let projectIdForDeadline = this.filterProject;
      if (!projectIdForDeadline && this.selectedParticipants.length > 0) {
        projectIdForDeadline = this.selectedParticipants[0].projectId;
      }

      if (!projectIdForDeadline) {
        this.snackBar.open(
          'Por favor, selecione um projeto antes de enviar.',
          'Fechar',
          {
            duration: 3000,
          }
        );
        return;
      }
      const sendEmailUrl = (await import('src/enviroments/environment')).environment.functions.sendEmailUrl;

      // Carrega configurações de lembrete do projeto uma única vez antes do loop
      const reminderClientId = this.filterClient || this.selectedParticipants[0]?.clientId || '';
      const reminderSettings = await this.loadReminderSettingsForProject(reminderClientId, projectIdForDeadline || '');

      // Captura antes do loop — selectedParticipants pode ser alterado por change detection
      const emailCount = this.selectedParticipants.length;

      // Envio sequencial: cada participante recebe template com variáveis próprias
      for (const participant of this.selectedParticipants) {
        const response = await fetch(sendEmailUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: participant.email,
            templateId: selectedTemplateId,
            participantId: participant.id,
            assessmentId: selectedAssessmentId,
            evaluatedParticipantId: participant.avaliadoId || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`Erro ao enviar e-mail para ${participant.email}: ${await response.text()}`);
        }

        const assessmentLinkQuery = query(
          collection(this.firestore, 'assessmentLinks'),
          where('participantId', '==', participant.id),
          where('assessmentId', '==', selectedAssessmentId)
        );
        const existingLinksSnapshot = await getDocs(assessmentLinkQuery);

        const inviteHistoryEntry = {
          type: 'convite',
          sentAt: new Date(),
          status: 'enviado',
          templateId: selectedTemplateId,
        };

        if (existingLinksSnapshot.empty) {
          const assessmentLinkDoc = doc(collection(this.firestore, 'assessmentLinks'));
          const linkData: any = {
            assessmentId: selectedAssessmentId,
            participantId: participant.id,
            clientId: participant.clientId,
            projectId: participant.projectId,
            sentAt: new Date(),
            status: 'pending',
            emailTemplate: selectedTemplateId,
            participantEmail: participant.email,
            emailHistory: [inviteHistoryEntry],
            creditReserved: false,
          };
          if (participant.type === 'avaliador' && participant.avaliadoId) {
            linkData['avaliadoId'] = participant.avaliadoId;
          }
          if (reminderSettings) {
            linkData['nextReminderAt'] = Timestamp.fromDate(
              this.computeNextReminderAt(
                reminderSettings.startDate,
                reminderSettings.intervalDays,
                reminderSettings.sendTime,
                reminderSettings.timezone,
                reminderSettings.weekdays
              )
            );
          }
          await setDoc(assessmentLinkDoc, linkData);
        } else {
          const existingLinkDoc = existingLinksSnapshot.docs[0];
          const existingData = existingLinkDoc.data();
          const isPending = existingData['status'] !== 'completed';
          const updateData: any = {
            sentAt: new Date(),
            emailTemplate: selectedTemplateId,
            status: isPending ? 'pending' : 'completed',
            emailHistory: arrayUnion(inviteHistoryEntry),
            creditReserved: false,
          };
          if (participant.type !== 'avaliado' && participant.avaliadoId) {
            updateData['avaliadoId'] = participant.avaliadoId;
          }
          if (isPending && !existingData['nextReminderAt'] && reminderSettings) {
            updateData['nextReminderAt'] = Timestamp.fromDate(
              this.computeNextReminderAt(
                reminderSettings.startDate,
                reminderSettings.intervalDays,
                reminderSettings.sendTime,
                reminderSettings.timezone,
                reminderSettings.weekdays
              )
            );
          }
          await updateDoc(doc(this.firestore, 'assessmentLinks', existingLinkDoc.id), updateData);
        }

        const participantRef = doc(this.firestore, 'participants', participant.id);
        const participantDoc = await getDoc(participantRef);
        if (participantDoc.exists()) {
          const currentAssessments = participantDoc.data()['assessments'] || [];
          if (!currentAssessments.includes(selectedAssessmentId)) {
            await updateDoc(participantRef, { assessments: [...currentAssessments, selectedAssessmentId] });
          }
        }
      }


      this.snackBar.open(
        `E-mails enviados para ${emailCount} participante${emailCount !== 1 ? 's' : ''}!`,
        'Fechar',
        { duration: 3000 }
      );

      if (this.isEmailSendingMode) {
        this.dialogRef.close(true);
      } else {
        await this.loadParticipants();
      }
    } catch (error) {
      console.error('Erro ao enviar e-mails:', error);
      this.snackBar.open('Erro ao enviar e-mails.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isLoading = false;
      this.isTableLoading = false;
    }
  }

  /** Substitui todas as variáveis dinâmicas (nova sintaxe {{...}} + legado $%...$%) */
  private replaceAllVariables(contentObj: any, vars: Record<string, string>): any {
    const replaceInText = (text: string): string => {
      // Nova sintaxe {{...}}
      text = text.replace(/\{\{nome_participante\}\}/g, vars['nome_participante'] || '');
      text = text.replace(/\{\{nome_avaliado\}\}/g, vars['nome_avaliado'] || '');
      text = text.replace(/\{\{categoria\}\}/g, vars['categoria'] || '');
      text = text.replace(/\{\{data_expiracao\}\}/g, vars['data_expiracao'] || '');
      text = text.replace(/\{\{nome_projeto\}\}/g, vars['nome_projeto'] || '');
      text = text.replace(/\{\{nome_cliente\}\}/g, vars['nome_cliente'] || '');
      // Sintaxe legada (compatibilidade com templates antigos)
      text = text.replace(/\$%Nome do usuário preenchido dinâmicamente\$%/g, vars['nome_participante'] || '');
      text = text.replace(/\$%NOME_DO_AVALIADO\$%/g, vars['nome_avaliado'] || '');
      text = text.replace(/\*?\$%DATA DE EXPIRAÇÃO DO PROJETO\$%\*?/g, vars['data_expiracao'] || '');
      return text;
    };

    if (contentObj.body?.rows) {
      contentObj.body.rows.forEach((row: any) => {
        row.columns?.forEach((column: any) => {
          column.contents?.forEach((content: any) => {
            if (content.values?.text) {
              content.values.text = replaceInText(content.values.text);
            }
          });
        });
      });
    }
    return contentObj;
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'Não definida';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  downloadTemplate(): void {
    const link = document.createElement('a');
    link.href = 'assets/templates/Modelo_Avaliacao_360.xlsx';
    link.download = 'Modelo_Avaliacao_360.xlsx';
    link.click();
  }

  async uploadExcel(event: any): Promise<void> {
    if (!this.ensureCanMutateParticipants('criar')) return;
    const file = event.target.files[0];
    if (!file) return;
    // Reset input so the same file can be selected again
    (event.target as HTMLInputElement).value = '';

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const startRowIndex = 19;
      const participants: any[] = [];
      for (let i = startRowIndex; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!Array.isArray(row) || row.length < 4 || !row[1] || !row[2] || !row[3]) continue;
        const category = row[3]?.toString().trim() || '';
        const type = category === 'Avaliado' ? 'avaliado' : 'avaliador';
        const cargo = row[4]?.toString().trim() || '';
        const setor = row[5]?.toString().trim() || '';
        const participant: any = {
          name: row[1]?.toString().trim() || '',
          email: row[2]?.toString().trim() || '',
          category,
          type,
        };
        if (cargo) participant['cargo'] = cargo;
        if (setor) participant['setor'] = setor;
        participants.push(participant);
      }

      if (participants.length === 0) {
        this.snackBar.open('Nenhum participante válido encontrado na planilha.', 'Fechar', { duration: 3000 });
        return;
      }

      const dialogRef = this.dialog.open(ParticipantsConfirmationDialogComponent, {
        width: '760px',
        maxWidth: '95vw',
        disableClose: true,
        data: {
          participants,
          clients: this.clients,
          projects: this.projects,
          preselectedClientId: this.filterClient || undefined,
          preselectedProjectId: this.filterProject || undefined,
          loadEvaluation: (projectId: string) => this.loadEvaluation(projectId),
        },
      });

      dialogRef.afterClosed().subscribe(async (result) => {
        if (!result) return;

        const projectName = this.projects.find(p => p.id === result.project)?.name || 'projeto';

        // Revalidar antes de gravar (defesa contra mudanças entre confirmação e gravação).
        const importValidation = await this.participantValidationService.validateImportParticipantsForProject(
          result.project,
          participants,
          projectName
        );
        if (!importValidation.valid) {
          this.snackBar.open(importValidation.error || 'Falha de validação no import.', 'Fechar', { duration: 6000 });
          return;
        }

        // Ordena para processar o avaliado primeiro e em seguida os avaliadores.
        const ordered = [...participants].sort((a, b) => {
          const aFirst = a.category === 'Avaliado' ? 0 : 1;
          const bFirst = b.category === 'Avaliado' ? 0 : 1;
          return aFirst - bFirst;
        });

        // Descobre avaliadoId: do arquivo (após criação) ou do BD se ele já existe.
        let avaliadoIdParaVincular: string | undefined;
        if (!ordered.some(p => p.category === 'Avaliado')) {
          const existsCheck = await this.participantValidationService.validateAvaliadoExistsForProject(
            result.project,
            projectName
          );
          avaliadoIdParaVincular = existsCheck.avaliadoId;
        }

        let saved = 0;
        for (const participant of ordered) {
          try {
            const baseFields = this.participantValidationService.buildParticipantWriteFields(
              participant.name,
              participant.email,
              {
                category: participant.category,
                type: participant.type,
                clientId: result.client,
                projectId: result.project,
                assessments: result.evaluation ? [result.evaluation] : [],
              }
            );
            if (participant.cargo) baseFields['cargo'] = participant.cargo;
            if (participant.setor) baseFields['setor'] = participant.setor;

            if (participant.category === 'Avaliado') {
              const evaluateeId = await this.participantCreditService.createEvaluateeWithCredit(
                baseFields,
                result.client,
                result.project
              );
              if (!avaliadoIdParaVincular) {
                avaliadoIdParaVincular = evaluateeId;
              }
            } else {
              const docData: Record<string, unknown> = {
                ...baseFields,
                createdAt: new Date(),
              };
              if (avaliadoIdParaVincular) {
                docData['avaliadoId'] = avaliadoIdParaVincular;
              }
              await addDoc(collection(this.firestore, 'participants'), docData);
            }
            saved++;
          } catch (error: unknown) {
            console.error('Erro ao salvar participante:', error);
            const err = error as { code?: string; message?: string };
            if (err.code === 'insufficient-credits') {
              this.snackBar.open('Créditos insuficientes para importar o avaliado.', 'Fechar', { duration: 6000 });
              break;
            }
          }
        }
        const total = participants.length;
        const msg = saved === total
          ? `${saved} participante${saved !== 1 ? 's' : ''} importado${saved !== 1 ? 's' : ''} com sucesso!`
          : `${saved} de ${total} participante${total !== 1 ? 's' : ''} importados (${total - saved} com erro)`;
        this.snackBar.open(msg, 'Fechar', { duration: 5000 });
        if (result.project) await this.revertProjectIfConcluded(result.project);
        // Ajustar filtros para exibir os novos participantes sem recarregar cliente/projeto
        if (!this.filterClient) {
          this.filterClient = result.client;
          this.filteredProjects = this.projects.filter(p => p.clientId === result.client);
        }
        if (!this.filterProject) this.filterProject = result.project;
        await Promise.all([this.loadParticipants(), this.loadClients()]);
      });
    };
    reader.readAsArrayBuffer(file);
  }

  async loadEvaluation(
    projectId: string
  ): Promise<{ id: string; name: string } | null> {
    if (!projectId) return null;

    try {
      const projectDoc = doc(this.firestore, 'projects', projectId);
      const projectSnapshot = await getDoc(projectDoc);
      if (!projectSnapshot.exists()) throw new Error('Projeto não encontrado');

      const projectData = projectSnapshot.data();
      const assessmentId = projectData['assessmentId'];

      if (!assessmentId) {
        this.snackBar.open(
          'Nenhuma avaliação associada a este projeto.',
          'Fechar',
          { duration: 3000 }
        );
        return null;
      }

      const assessmentDoc = doc(this.firestore, 'assessments', assessmentId);
      const assessmentSnapshot = await getDoc(assessmentDoc);
      if (!assessmentSnapshot.exists())
        throw new Error('Avaliação não encontrada');

      const assessmentData = assessmentSnapshot.data();
      return {
        id: assessmentId,
        name: assessmentData['name'] || 'Avaliação Sem Nome',
      };
    } catch (error) {
      console.error('Erro ao carregar avaliação:', error);
      this.snackBar.open('Erro ao carregar avaliação.', 'Fechar', {
        duration: 3000,
      });
      return null;
    }
  }

  openEditParticipantDialog(participant: UnifiedParticipant): void {
    void this.openEditParticipantDialogAsync(participant);
  }

  private async openEditParticipantDialogAsync(participant: UnifiedParticipant): Promise<void> {
    if (!this.ensureCanMutateParticipants('editar')) return;

    const evaluateeCheck = await this.participantValidationService.validateSingleEvaluateePerProject(
      participant.projectId,
      'Avaliado',
      participant.id
    );

    const dialogRef = this.dialog.open(EditParticipantDialogComponent, {
      width: '440px',
      maxWidth: '95vw',
      data: {
        name: participant.name,
        email: participant.email,
        category: participant.category,
        type: participant.type,
        canSelectAvaliado: evaluateeCheck.valid,
        existingEvaluateeName: evaluateeCheck.existingEvaluateeName,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result) return;

      if (!this.participantValidationService.isValidEmailFormat(result.email)) {
        this.snackBar.open('E-mail inválido.', 'Fechar', { duration: 4000 });
        return;
      }

      const emailCheck = await this.participantValidationService.validateEmailUniqueInProject(
        participant.projectId,
        result.email,
        participant.id
      );
      if (!emailCheck.valid) {
        this.snackBar.open(emailCheck.error || 'E-mail inválido.', 'Fechar', { duration: 5000 });
        return;
      }

      if (result.category === 'Avaliado' && result.category !== participant.category) {
        const validation = await this.participantValidationService.validateSingleEvaluateePerProject(
          participant.projectId,
          'Avaliado',
          participant.id
        );
        if (!validation.valid) {
          this.snackBar.open(
            `Este projeto já possui um avaliado cadastrado (${validation.existingEvaluateeName}). É permitido apenas um avaliado por projeto.`,
            'Fechar',
            { duration: 5000 }
          );
          return;
        }
      }

      try {
        await this.saveParticipantEdit(participant, result);
        this.dataSource.data = [...this.dataSource.data];
        this.snackBar.open('Participante atualizado com sucesso!', 'Fechar', { duration: 2500 });
      } catch (error: unknown) {
        console.error('Erro ao atualizar participante:', error);
        const message =
          (error as { message?: string })?.message || 'Erro ao atualizar participante.';
        this.snackBar.open(message, 'Fechar', { duration: 5000 });
      }
    });
  }

  private async saveParticipantEdit(
    participant: UnifiedParticipant,
    result: { name: string; email: string; category: string; type: 'avaliado' | 'avaliador' }
  ): Promise<void> {
    const participantRef = doc(this.firestore, `participants/${participant.id}`);
    const oldType = participant.type;
    const newType = result.type;
    const categoryChanged = result.category !== participant.category;
    const typeChanged = newType !== oldType;

    if (newType === 'avaliado' && oldType !== 'avaliado') {
      await this.promoteParticipantToAvaliado(participant, result.name, result.email, result.category);
    } else if (oldType === 'avaliado' && newType !== 'avaliado') {
      await this.demoteParticipantFromAvaliado(participant, result.name, result.email, result.category, newType);
    } else {
      const updates: Record<string, any> = {};
      if (result.name !== participant.name) updates['name'] = result.name;
      if (result.email !== participant.email) {
        updates['email'] = result.email;
        updates['emailLower'] = this.participantValidationService.normalizeEmail(result.email);
      }
      if (categoryChanged) {
        updates['category'] = result.category;
        updates['type'] = result.type;
      }
      if (!Object.keys(updates).length) return;

      await updateDoc(participantRef, updates);
      if (updates['name']) participant.name = result.name;
      if (updates['email']) participant.email = result.email;
      if (categoryChanged) participant.category = result.category;
    }

    if (typeChanged) {
      participant.type = newType;
    } else if (categoryChanged) {
      participant.category = result.category;
    }
    if (result.name !== participant.name) participant.name = result.name;
    if (result.email !== participant.email) participant.email = result.email;

    if (newType === 'avaliado') {
      participant.avaliadoId = undefined;
      await this.linkAvaliadoresToEvaluatee(participant.projectId, participant.id);
      for (const row of this.dataSource.data) {
        if (row.projectId === participant.projectId && row.type === 'avaliador') {
          row.avaliadoId = participant.id;
        }
      }
    } else if (oldType === 'avaliado' && newType === 'avaliador') {
      participant.avaliadoId = undefined;
      await this.clearAvaliadoLinks(participant.projectId, participant.id);
      for (const row of this.dataSource.data) {
        if (row.projectId === participant.projectId && row.avaliadoId === participant.id) {
          row.avaliadoId = undefined;
        }
      }
    } else if (newType === 'avaliador') {
      const avaliadoId = await this.participantValidationService.getProjectEvaluateeId(participant.projectId);
      if (avaliadoId) {
        await updateDoc(participantRef, { avaliadoId });
        participant.avaliadoId = avaliadoId;
      }
    }
  }

  private async linkAvaliadoresToEvaluatee(projectId: string, avaliadoId: string): Promise<void> {
    const snap = await getDocs(query(
      collection(this.firestore, 'participants'),
      where('projectId', '==', projectId),
      where('type', '==', 'avaliador')
    ));
    if (snap.empty) return;

    const batch = writeBatch(this.firestore);
    for (const docSnap of snap.docs) {
      batch.update(docSnap.ref, { avaliadoId });
    }
    await batch.commit();
  }

  private async clearAvaliadoLinks(projectId: string, avaliadoId: string): Promise<void> {
    const snap = await getDocs(query(
      collection(this.firestore, 'participants'),
      where('projectId', '==', projectId),
      where('avaliadoId', '==', avaliadoId)
    ));
    if (snap.empty) return;

    const batch = writeBatch(this.firestore);
    for (const docSnap of snap.docs) {
      batch.update(docSnap.ref, { avaliadoId: deleteField() });
    }
    await batch.commit();
  }

  private async promoteParticipantToAvaliado(
    participant: UnifiedParticipant,
    name: string,
    email: string,
    category: string
  ): Promise<void> {
    const patch = this.participantValidationService.buildParticipantWriteFields(name, email, {
      type: 'avaliado',
      category,
    });

    await this.participantCreditService.reserveCreditForExistingParticipant(
      participant.id,
      participant.clientId,
      participant.projectId,
      patch
    );

    participant.creditReserved = true;
    participant.category = category;
    participant.type = 'avaliado';
    participant.name = name.trim();
    participant.email = email.trim();
    await this.loadClients();
  }

  private async demoteParticipantFromAvaliado(
    participant: UnifiedParticipant,
    name: string,
    email: string,
    category: string,
    newType: 'avaliado' | 'avaliador'
  ): Promise<void> {
    await this.participantCreditService.refundParticipantReservedCredit(participant.id);

    const updateData: Record<string, any> = this.participantValidationService.buildParticipantWriteFields(name, email, {
      type: newType,
      category,
      avaliadoId: deleteField(),
      creditReserved: false,
      creditConsumed: false,
    });

    await updateDoc(doc(this.firestore, `participants/${participant.id}`), updateData);
    participant.creditReserved = false;
    participant.category = category;
    participant.type = newType;
    participant.name = name.trim();
    participant.email = email.trim();
    await this.loadClients();
  }

  openAddParticipantModal(): void {
    if (!this.ensureCanMutateParticipants('criar')) return;
    const dialogRef = this.dialog.open(AddParticipantModalComponent, {
      width: '480px',
      maxWidth: '95vw',
      panelClass: 'add-participant-dialog',
      data: {
        clientId: this.filterClient || undefined,
        projectId: this.filterProject || undefined,
        clients: this.clients,
        projects: this.projects,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        if (this.filterProject) await this.revertProjectIfConcluded(this.filterProject);
        await Promise.all([this.loadParticipants(), this.loadClients()]);
      }
    });
  }

  private async revertProjectIfConcluded(projectId: string): Promise<void> {
    try {
      const projectRef = doc(this.firestore, `projects/${projectId}`);
      const projectSnap = await getDoc(projectRef);
      if (!projectSnap.exists()) return;
      const status = projectSnap.data()['status'];
      if (status === 'Concluído' || status === 'concluido') {
        await updateDoc(projectRef, { status: 'Em andamento' });
      }
    } catch (e) {
      console.error('Erro ao reverter status do projeto:', e);
    }
  }

  getFriendlyEmailType(emailType: string): string {
    switch (emailType) {
      case 'conviteAvaliador':
        return 'Convite Avaliador';
      case 'conviteRespondente':
        return 'Convite Avaliado';
      case 'lembreteAvaliador':
        return 'Lembrete Avaliador';
      case 'lembreteRespondente':
        return 'Lembrete Avaliado';
      case 'lembrete':
        return 'Lembrete Avaliado';
      case 'convite':
        return 'Convite Avaliado';
      case 'cadastro':
        return 'Cadastro';
      default:
        return emailType || 'Tipo Desconhecido';
    }
  }

  private compare(a: string, b: string, isAsc: boolean): number {
    return (a < b ? -1 : a > b ? 1 : 0) * (isAsc ? 1 : -1);
  }

  private compareDates(
    a: Date | undefined,
    b: Date | undefined,
    isAsc: boolean
  ): number {
    const dateA = a ? a.getTime() : 0;
    const dateB = b ? b.getTime() : 0;
    return (dateA - dateB) * (isAsc ? 1 : -1);
  }

  countByType(type: string): number {
    return this.dataSource.filteredData.filter(p => p.type === type).length;
  }

  countByStatus(status: string): number {
    return this.dataSource.filteredData.filter(p => (p.status || 'Não Enviado') === status).length;
  }

  openSendHistory(participant: UnifiedParticipant): void {
    this.dialog.open(SendHistoryDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'send-history-panel',
      data: { participant },
    });
  }

  generateReportForParticipant(participant: UnifiedParticipant) {
    // Abrir o modal de geração para escolher competências e gerar PDF em background (sem navegação)
    const dialogRef = this.dialog.open(ReportGenerationModalComponent, {
      width: '700px',
      maxWidth: '90vw',
      data: {
        participant: participant,
        projectId: participant.projectId,
        assessmentId: participant.assessmentId,
        clientId: participant.clientId
      },
      disableClose: false
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result.success) {
        this.snackBar.open('Relatório gerado com sucesso!', 'Fechar', { duration: 3000 });
      }
    });
  }

  async cancelSend(participant: UnifiedParticipant): Promise<void> {
    if (!this.ensureCanMutateParticipants('editar')) return;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: { message: `Deseja cancelar o envio pendente para ${participant.name}?` },
    });
    const confirmed = await dialogRef.afterClosed().toPromise();
    if (!confirmed) return;

    const prevStatus = participant.status;
    const prevSentAt = participant.sentAt;

    participant.status = 'Não Enviado';
    participant.sentAt = undefined;
    this.dataSource.data = [...this.dataSource.data];
    this.applyFilter();

    try {
      const cancelConstraints: any[] = [
        where('participantId', '==', participant.id),
        where('status', '==', 'pending'),
      ];
      if (participant.assessmentId) {
        cancelConstraints.push(where('assessmentId', '==', participant.assessmentId));
      }
      const linkQuery = query(collection(this.firestore, 'assessmentLinks'), ...cancelConstraints);
      const linkSnap = await getDocs(linkQuery);
      if (linkSnap.empty) {
        participant.status = prevStatus;
        participant.sentAt = prevSentAt;
        this.dataSource.data = [...this.dataSource.data];
        this.snackBar.open('Nenhum envio pendente encontrado.', 'Fechar', { duration: 3000 });
        return;
      }

      const linkDoc = linkSnap.docs[0];
      const linkData = linkDoc.data();
      await updateDoc(doc(this.firestore, 'assessmentLinks', linkDoc.id), {
        status: 'cancelled',
        cancelledAt: new Date(),
        creditReserved: false,
      });

      if (linkData['creditReserved'] === true && participant.clientId) {
        await this.participantCreditService.refundLegacyLinkCredits([linkDoc], participant.clientId);
        await this.loadClients();
      }

      this.snackBar.open('Envio cancelado.', 'Fechar', { duration: 3000 });
    } catch (e) {
      participant.status = prevStatus;
      participant.sentAt = prevSentAt;
      this.dataSource.data = [...this.dataSource.data];
      console.error('Erro ao cancelar envio:', e);
      this.snackBar.open('Erro ao cancelar envio.', 'Fechar', { duration: 3000 });
    }
  }

  /** Carrega as configurações de lembrete ativas para o projeto. */
  private async loadReminderSettingsForProject(clientId: string, projectId: string): Promise<{
    startDate: Date;
    intervalDays: number;
    sendTime: string;
    timezone: string;
    maxReminders: number;
    weekdays: number[];
  } | null> {
    if (!clientId || !projectId) return null;
    try {
      const docId = `${clientId}_${projectId}`;
      const snap = await getDoc(doc(this.firestore, 'reminderSettings', docId));
      if (!snap.exists()) return null;
      const d = snap.data();
      if (!d['enabled']) return null;

      const startDate: Date | null = d['startDate']?.toDate?.() ?? null;
      if (!startDate) return null;

      return {
        startDate,
        intervalDays: Math.max(1, Number(d['intervalDays'] || 3)),
        sendTime: String(d['sendTime'] || '09:00'),
        timezone: String(d['timezone'] || 'America/Fortaleza'),
        maxReminders: Math.max(0, Number(d['maxReminders'] || 0)),
        weekdays: this.normalizeWeekdays(d['weekdays']),
      };
    } catch {
      return null;
    }
  }

  /**
   * Calcula o próximo instante de disparo de lembrete para um participante
   * novo (sem histórico de envios).
   */
  private computeNextReminderAt(
    startDate: Date,
    intervalDays: number,
    sendTime: string,
    timezone: string,
    weekdays: number[] = [],
  ): Date {
    const now = new Date();
    let next = this.buildReminderOccurrence(startDate, 0, sendTime, timezone);
    next = this.advanceToAllowedWeekday(next, timezone, weekdays);

    if (next > now) return next;

    const msPerInterval = intervalDays * 86_400_000;
    const extra = Math.ceil((now.getTime() - next.getTime()) / msPerInterval);
    next = this.buildReminderOccurrence(startDate, intervalDays * extra, sendTime, timezone);
    next = this.advanceToAllowedWeekday(next, timezone, weekdays);

    if (next <= now) {
      next = this.buildReminderOccurrence(startDate, intervalDays * (extra + 1), sendTime, timezone);
      next = this.advanceToAllowedWeekday(next, timezone, weekdays);
    }

    return next;
  }

  private advanceToAllowedWeekday(date: Date, timezone: string, weekdays: number[] = []): Date {
    const allowedWeekdays = this.normalizeWeekdays(weekdays);
    if (!allowedWeekdays.length) return date;

    for (let offset = 0; offset < 7; offset++) {
      const candidate = new Date(date.getTime() + offset * 86_400_000);
      if (allowedWeekdays.includes(this.getWeekdayInTimezone(candidate, timezone))) {
        return candidate;
      }
    }

    return date;
  }

  private getWeekdayInTimezone(date: Date, timezone: string): number {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(date).toLowerCase();
    const map: Record<string, number> = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };
    return map[weekday.slice(0, 3)] ?? date.getDay();
  }

  private normalizeWeekdays(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(
        value
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
      )
    ).sort((a, b) => a - b);
  }

  private buildReminderOccurrence(base: Date, offsetDays: number, sendTime: string, timezone: string): Date {
    const targetDay = new Date(base.getTime() + offsetDays * 86_400_000);

    const dateFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const dp = dateFmt.formatToParts(targetDay);
    const year  = dp.find(p => p.type === 'year')?.value  ?? '2000';
    const month = dp.find(p => p.type === 'month')?.value ?? '01';
    const day   = dp.find(p => p.type === 'day')?.value   ?? '01';
    const datePart = `${year}-${month}-${day}`;

    const noonUtc = new Date(`${datePart}T12:00:00Z`);
    const timeFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: false,
    });
    const tp = timeFmt.formatToParts(noonUtc);
    const tzH = Number(tp.find(p => p.type === 'hour')?.value   ?? '0');
    const tzM = Number(tp.find(p => p.type === 'minute')?.value ?? '0');
    const offsetMin = tzH * 60 + tzM - 720;

    const [sh, sm] = sendTime.split(':').map(Number);
    const utcMin = sh * 60 + sm - offsetMin;
    const dayStartUtc = new Date(`${datePart}T00:00:00Z`).getTime();
    return new Date(dayStartUtc + utcMin * 60_000);
  }

  async linkParticipantAsViewer(participant: UnifiedParticipant): Promise<void> {
    if (!participant.email) {
      this.snackBar.open('Participante não tem e-mail cadastrado.', 'Fechar', { duration: 3000 });
      return;
    }

    const emailLower = participant.email.toLowerCase().trim();

    // Verifica se já existe usuário com esse e-mail
    const [snapLower, snapEmail] = await Promise.all([
      getDocs(query(collection(this.firestore, 'users'), where('emailLower', '==', emailLower))),
      getDocs(query(collection(this.firestore, 'users'), where('email', '==', participant.email))),
    ]);
    const existing = snapLower.empty ? snapEmail : snapLower;

    if (!existing.empty) {
      const existingData = existing.docs[0].data();
      if (existingData['role'] === 'viewer') {
        // Garante que o projeto está na lista de projetos do viewer
        const currentProjects: string[] = existingData['projects'] || [];
        if (!currentProjects.includes(participant.projectId)) {
          await updateDoc(existing.docs[0].ref, { projects: arrayUnion(participant.projectId) });
          this.snackBar.open('Projeto adicionado ao acesso do visualizador existente.', 'Fechar', { duration: 3000 });
        } else {
          this.snackBar.open('Este participante já possui acesso como visualizador.', 'Fechar', { duration: 3000 });
        }
      } else {
        this.snackBar.open(
          `Este e-mail já está cadastrado com o perfil "${existingData['role']}". Edite o usuário para alterar permissões.`,
          'Fechar',
          { duration: 5000 }
        );
      }
      return;
    }

    // Cria o usuário no Firestore
    try {
      await addDoc(collection(this.firestore, 'users'), {
        name: participant.name,
        surname: '',
        email: participant.email,
        emailLower,
        role: 'viewer',
        clients: participant.clientId ? [participant.clientId] : [],
        projects: [participant.projectId],
        status: 'active',
        createdAt: new Date(),
      });
    } catch (err: any) {
      this.snackBar.open(`Erro ao criar visualizador: ${err?.message}`, 'Fechar', { duration: 5000 });
      return;
    }

    // Cria conta Firebase Auth via app secundário e envia e-mail de boas-vindas
    const appName = `viewer_link_${Date.now()}`;
    const secondaryApp = initializeApp((this.firebaseApp as any).options, appName);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const tempPassword =
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).toUpperCase().slice(2) + '!8';
      await createUserWithEmailAndPassword(secondaryAuth, participant.email, tempPassword);
      await firebaseSignOut(secondaryAuth);
    } catch (err: any) {
      if (err?.code !== 'auth/email-already-in-use') {
        this.snackBar.open(
          `Conta Firestore criada, mas erro ao criar Auth: ${err?.message}`,
          'Fechar', { duration: 6000 }
        );
        try { await deleteApp(secondaryApp); } catch {}
        return;
      }
    } finally {
      try { await deleteApp(secondaryApp); } catch {}
    }

    // Envia e-mail com link de acesso
    try {
      const actionCodeSettings: ActionCodeSettings = {
        url: `${window.location.origin}/authentication/login`,
        handleCodeInApp: false,
      };
      await sendPasswordResetEmail(this.auth, participant.email, actionCodeSettings);
    } catch (err: any) {
      this.snackBar.open(
        `Visualizador criado, mas o e-mail não foi enviado: ${err?.message}`,
        'Fechar', { duration: 6000 }
      );
      return;
    }

    this.snackBar.open(
      `Acesso criado! E-mail de acesso enviado para ${participant.email}.`,
      'Fechar', { duration: 4000 }
    );
  }
}
