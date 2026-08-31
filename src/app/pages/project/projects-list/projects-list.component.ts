import { Component, OnInit, ViewChild } from '@angular/core';
import {
  Firestore,
  Timestamp,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { ProjectService } from 'src/app/services/project.service';
import { ConfirmDialogComponent } from '../../clients/clients-list/confirm-dialog/confirm-dialog.component';
import { EmailSelectionDialogComponent } from './email-selection-dialog/email-selection-dialog.component';
import { ResendAssessmentModalComponent } from '../resend-assessment-modal/resend-assessment-modal.component';
import { ParticipantsModalComponent } from '../participants-modal/participants-modal.component';
import { ParticipantsComponent } from '../../assessments/participants/participants.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';
import { fixMojibake } from 'src/app/utils/encoding.utils';
import { DependencyCheckService } from 'src/app/services/dependency-check.service';
import { DependencyBlockDialogComponent } from 'src/app/shared/dependency-block-dialog/dependency-block-dialog.component';
import {
  ProjectExportDialogComponent,
  ProjectExportDialogResult,
} from '../project-export-dialog/project-export-dialog.component';
import {
  ClientPdfBatchDialogComponent,
  ClientPdfBatchDialogResult,
} from '../client-pdf-batch-dialog/client-pdf-batch-dialog.component';
import { ReportClientExportService } from 'src/app/services/report-client-export.service';
import { LoadingService } from 'src/app/services/loading.service';
import { translateProjectStatus } from 'src/app/utils/i18n-labels.util';

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MaterialModule, TranslateModule, AppPageHeaderComponent],
  templateUrl: './projects-list.component.html',
  styleUrls: ['./projects-list.component.scss'],
})
export class ProjectsListComponent implements OnInit {
  displayedColumns: string[] = [];
  private allProjects: any[] = [];
  dataSource = new MatTableDataSource<any>();
  searchValue: string = '';
  currentUser: any;
  clientId: any;
  clientsMap: { [key: string]: string } = {};
  clients: { id: string; name: string }[] = [];
  clientsFiltered: { id: string; name: string }[] = [];
  clientSearchCtrl = new FormControl('');
  selectedClientId: string | null = null;
  isAdminMaster: boolean = false;
  isClienteAdmin: boolean = false;
  isViewer: boolean = false;
  userClientIds: string[] = [];
  viewerProjectIds = new Set<string>();
  today = new Date();
  loadingParticipantsProjectId: string | null = null;
  selectedProjectIds = new Set<string>();
  statusFilter: string = 'all';

  readonly STATUS_FILTERS = [
    { value: 'all',          labelKey: 'Todos' },
    { value: 'Em andamento', labelKey: 'Em andamento' },
    { value: 'Concluído',    labelKey: 'Concluído' },
    { value: 'Cancelado',    labelKey: 'Cancelado' },
  ];

  statusLabel(status: string): string {
    return translateProjectStatus(this.translate, status);
  }

  getInitial(name: string): string {
    return name?.charAt(0)?.toUpperCase() || 'P';
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'Em andamento': 'status-em-andamento',
      'Concluído':    'status-concluido',
      'Cancelado':    'status-cancelado',
      // legados
      'Ativo':        'status-em-andamento',
      'Inativo':      'status-cancelado',
    };
    return map[status] || 'status-em-andamento';
  }

  applyStatusFilter(value: string): void {
    this.statusFilter = value;
    this.dataSource.filter = this.statusFilter === 'all' ? (this.searchValue.trim().toLowerCase() || '') : '__status__';
    this._applyCustomFilter();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  private _applyCustomFilter(): void {
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const q = this.searchValue.trim().toLowerCase();
      const matchSearch = !q
        || data.name.toLowerCase().includes(q)
        || (data.clientName || '').toLowerCase().includes(q);
      const matchStatus = this.statusFilter === 'all' || data.status === this.statusFilter;
      return matchSearch && matchStatus;
    };
    // trigger re-filter
    this.dataSource.filter = this.dataSource.filter === '' ? ' ' : this.dataSource.filter.trim() || ' ';
    this.dataSource.filter = this.dataSource.filter.trim();
  }

  async cancelProject(projectId: string): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { message: this.translate.instant('Tem certeza de que deseja cancelar este projeto? Ele não aparecerá mais no Dashboard.') },
    });
    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      try {
        const currentUser = await this.authService.getCurrentUser();
        await this.projectService.cancelProject(projectId, currentUser?.uid || 'manual');
        this.dataSource.data = this.dataSource.data.map(p =>
          p.id === projectId ? { ...p, status: 'Cancelado' } : p
        );
        this.snackBar.open(this.translate.instant('Projeto cancelado com sucesso.'), this.translate.instant('Fechar'), { duration: 3000 });
      } catch (e: any) {
        const msg = e?.message || this.translate.instant('Erro ao cancelar projeto.');
        this.snackBar.open(msg, this.translate.instant('Fechar'), { duration: 4000 });
      }
    });
  }

  isOverdue(deadline: Date | null): boolean {
    return !!deadline && deadline < this.today;
  }

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private router: Router,
    private dialog: MatDialog,
    private authService: AuthService,
    private projectService: ProjectService,
    private location: Location,
    private translate: TranslateService,
    private dependencyCheck: DependencyCheckService,
    private clientExportService: ReportClientExportService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    this.authService.getCurrentUser().then(async (user) => {
      this.isAdminMaster = user?.role === 'admin_master';
      this.isClienteAdmin = user?.role === 'admin_client';
      this.isViewer = user?.role === 'viewer';
      this.userClientIds = await this.authService.getCurrentUserClientIds();
      this.clientId = this.userClientIds[0] || null;
      if (this.isViewer) {
        await this.loadViewerProjectIds();
      }

      this.displayedColumns = [
        ...(this.canBulkSelectProjects() ? ['select'] : []),
        'client',
        'name',
        'deadline',
        'responses',
        'actions',
      ];

      if (this.isAdminMaster) {
        await this.loadClients();
      } else if (this.userClientIds.length > 0) {
        // admin_client e viewer: carrega clientes vinculados em clientsMap E clients[]
        const snaps = await Promise.all(
          this.userClientIds.map(id => getDoc(doc(this.firestore, 'clients', id)))
        );
        snaps.forEach(snap => {
          if (snap.exists()) {
            const name = fixMojibake(snap.data()['companyName'] || snap.id);
            this.clientsMap[snap.id] = name;
            this.clients.push({ id: snap.id, name });
          }
        });
      }
      // Inicializar lista filtrada e busca por cliente (disponível para todos os roles)
      this.clientsFiltered = [...this.clients];
      this.clientSearchCtrl.valueChanges.subscribe(s => {
        const q = (s || '').toLowerCase();
        this.clientsFiltered = this.clients.filter(c => c.name.toLowerCase().includes(q));
      });
      this.loadProjects();
    });
  }

  resetClientSearch(): void {
    this.clientSearchCtrl.setValue('', { emitEvent: false });
    this.clientsFiltered = [...this.clients];
  }

  private async loadClients(): Promise<void> {
    try {
      const clientsCollection = collection(this.firestore, 'clients');
      let snapshot;

      if (this.isAdminMaster) {
        // Admin_master vê todos os clientes
        snapshot = await getDocs(clientsCollection);
      } else if (this.userClientIds.length > 0) {
        // Admin_client e viewer veem apenas seus clientes vinculados
        snapshot = await getDocs(query(clientsCollection, where('__name__', 'in', this.userClientIds)));
      } else {
        snapshot = await getDocs(query(clientsCollection, where('__name__', '==', 'nonexistent')));
      }

      this.clients = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: fixMojibake(doc.data()['companyName'] || 'Cliente Desconhecido'),
      }));

      this.clients.forEach((client) => {
        this.clientsMap[client.id] = client.name;
      });
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open(this.translate.instant('Erro ao carregar clientes.'), this.translate.instant('Fechar'), {
        duration: 3000,
      });
    }
  }

  private async loadProjects(): Promise<void> {
    try {
      const projectsCollection = collection(this.firestore, 'projects');
      const projectsQuery = query(projectsCollection);

      const snapshot = await getDocs(projectsQuery);
      const projects = await Promise.all(
        snapshot.docs.map(async (projectDoc) => {
          const data = projectDoc.data();
          const deadline =
            data['deadline'] instanceof Timestamp
              ? data['deadline'].toDate()
              : null;

          const projectId = projectDoc.id;
          const [respondedCount, totalParticipants] =
            await this.countAssessmentResponses(projectId);

          // Auto-conclusão: se todos responderam, usar ProjectService para garantir consumo de créditos
          let currentStatus = data['status'];
          if (
            totalParticipants > 0 &&
            respondedCount >= totalParticipants &&
            !['Concluído', 'concluido', 'Cancelado', 'cancelado'].includes(currentStatus)
          ) {
            try {
              await this.projectService.concludeProject(projectId, 'auto');
            } catch {
              // fallback: pelo menos atualiza o status
              await updateDoc(doc(this.firestore, 'projects', projectId), { status: 'Concluído' });
            }
            currentStatus = 'Concluído';
          }

          return {
            id: projectDoc.id,
            ...data,
            status: currentStatus,
            deadline: deadline,
            clientName:
              this.clientsMap[data['clientId']] || 'Cliente não encontrado',
            respondedCount: respondedCount || 0,
            totalParticipants: totalParticipants || 0,
            pendingCount: (totalParticipants || 0) - (respondedCount || 0),
          };
        })
      );

      this.allProjects = projects;

      // Preencher clientsMap com clientes dos projetos visíveis que ainda não estão mapeados
      const filteredForMap = this.filterProjectsByClient(projects);
      const missingClientIds = [...new Set(
        filteredForMap
          .map(p => p.clientId)
          .filter((id: string) => id && !this.clientsMap[id])
      )];
      if (missingClientIds.length > 0) {
        await Promise.all(missingClientIds.map(async (id: string) => {
          try {
            const snap = await getDoc(doc(this.firestore, 'clients', id));
            if (snap.exists()) this.clientsMap[id] = fixMojibake(snap.data()['companyName'] || id);
          } catch { /* ignora */ }
        }));
        // Reatribuir clientName com o mapa atualizado
        this.allProjects = this.allProjects.map(p => ({
          ...p,
          clientName: this.clientsMap[p.clientId] || 'Cliente não encontrado',
        }));
      }

      this.dataSource.data = this.filterProjectsByClient(this.allProjects);
      this.dataSource.paginator = this.paginator;
      this._applyCustomFilter();

      this.dataSource.sortingDataAccessor = (item, property) => {
        switch (property) {
          case 'client':
            return item.clientName.toLowerCase();
          case 'name':
            return item.name.toLowerCase();
          case 'deadline':
            return item.deadline ? item.deadline.getTime() : 0;
          case 'responses':
            return item.respondedCount;
          default:
            return item[property];
        }
      };
      this.dataSource.sort = this.sort;
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      this.snackBar.open(this.translate.instant('Erro ao carregar projetos.'), this.translate.instant('Fechar'), {
        duration: 3000,
      });
    }
  }

  private async countAssessmentResponses(
    projectId: string
  ): Promise<[number, number]> {
    try {
      // Passo 1: Obter o clientId do projeto
      const projectRef = doc(this.firestore, 'projects', projectId);
      const projectSnapshot = await getDoc(projectRef);
      if (!projectSnapshot.exists()) {
        console.warn(`Projeto ${projectId} não encontrado.`);
        return [0, 0];
      }
      const projectData = projectSnapshot.data();
      const clientId = projectData['clientId'];
      if (!clientId) {
        console.warn(`Projeto ${projectId} não tem clientId associado.`);
        return [0, 0];
      }

      const projectAssessmentId = projectData['assessmentId'] as string | undefined;

      // Passo 2: Contar todos os participantes do projeto
      const participantsQuery = query(
        collection(this.firestore, 'participants'),
        where('projectId', '==', projectId)
      );
      const participantsSnapshot = await getDocs(participantsQuery);
      const totalParticipants = participantsSnapshot.docs.length;
      console.log(
        `Projeto ${projectId} - Total de participantes: ${totalParticipants}`
      );

      // Passo 3: Contar respostas completadas — apenas deste projeto
      let respondedCount = 0;
      const participantIds = participantsSnapshot.docs.map((doc) => doc.id);
      const participantIdSet = new Set(participantIds);

      if (participantIds.length > 0) {
        const batchSize = 10;
        const completedParticipants = new Set<string>();

        // Fonte principal: links com projectId (formato atual)
        const projectLinksQuery = query(
          collection(this.firestore, 'assessmentLinks'),
          where('projectId', '==', projectId),
          where('status', '==', 'completed')
        );
        const projectLinksSnapshot = await getDocs(projectLinksQuery);
        projectLinksSnapshot.docs.forEach((linkDoc) => {
          const participantId = linkDoc.data()['participantId'];
          if (participantIdSet.has(participantId)) {
            completedParticipants.add(participantId);
          }
        });

        // Fallback legado: links sem projectId, mas da avaliação vinculada ao projeto
        if (projectAssessmentId) {
          for (let i = 0; i < participantIds.length; i += batchSize) {
            const participantBatch = participantIds.slice(i, i + batchSize);
            const legacyLinksQuery = query(
              collection(this.firestore, 'assessmentLinks'),
              where('participantId', 'in', participantBatch),
              where('assessmentId', '==', projectAssessmentId),
              where('status', '==', 'completed')
            );
            const legacyLinksSnapshot = await getDocs(legacyLinksQuery);
            legacyLinksSnapshot.docs.forEach((linkDoc) => {
              completedParticipants.add(linkDoc.data()['participantId']);
            });
          }
        }

        respondedCount = completedParticipants.size;
      }

      console.log(
        `Projeto ${projectId} - Respostas completadas: ${respondedCount}`
      );
      return [respondedCount, totalParticipants];
    } catch (error) {
      console.error('Erro ao contar respostas da avaliação:', error);
      return [0, 0];
    }
  }

  private async loadViewerProjectIds(): Promise<void> {
    this.viewerProjectIds.clear();
    const email = await this.authService.getCurrentUserEmail();
    if (!email) return;

    const usersSnap = await getDocs(
      query(collection(this.firestore, 'users'), where('email', '==', email))
    );
    if (usersSnap.empty) return;

    const userDocId = usersSnap.docs[0].id;
    const userData = usersSnap.docs[0].data() || {};
    const isOnNewStructure = 'groups' in userData;

    // Fonte principal: grupos onde o viewer aparece em userIds
    const groupsSnap = await getDocs(
      query(collection(this.firestore, 'userGroups'), where('userIds', 'array-contains', userDocId))
    );

    const allProjectsClientIds = new Set<string>();
    groupsSnap.forEach(snap => {
      const data = snap.data();
      if (data['allProjects'] === true && data['clientId']) {
        allProjectsClientIds.add(data['clientId']);
      } else {
        const projectIds: string[] = data['projectIds'] || [];
        projectIds.forEach(id => this.viewerProjectIds.add(id));
      }
    });

    // Para grupos com allProjects: buscar todos os projetos do cliente
    if (allProjectsClientIds.size > 0) {
      const allClientsArr = [...allProjectsClientIds];
      const projSnap = await getDocs(
        query(collection(this.firestore, 'projects'), where('clientId', 'in', allClientsArr))
      );
      projSnap.forEach(d => this.viewerProjectIds.add(d.id));
    }

    // Fallback legado: APENAS se o usuário nunca foi migrado para grupos
    if (!isOnNewStructure && this.viewerProjectIds.size === 0) {
      const fromArray = Array.isArray(userData['projects']) ? userData['projects'] : [];
      const fromSingle = typeof userData['project'] === 'string' && userData['project'].trim()
        ? [userData['project']] : [];
      [...fromArray, ...fromSingle].forEach(id => this.viewerProjectIds.add(id));
    }
  }

  private filterProjectsByClient(projects: any[]): any[] {
    let result = projects;

    // Viewer: restringir aos projetos atribuídos
    if (this.isViewer) {
      result = this.viewerProjectIds.size > 0
        ? result.filter(p => this.viewerProjectIds.has(p.id))
        : [];
    }
    // Admin_client: restringir aos clientes vinculados
    else if (!this.isAdminMaster && this.userClientIds.length > 0) {
      result = result.filter(p => this.userClientIds.includes(p.clientId));
    }

    // Filtro de cliente selecionado (dropdown) — funciona para todos os roles
    if (this.selectedClientId) {
      result = result.filter(p => p.clientId === this.selectedClientId);
    }

    return result;
  }

  onClientChange(): void {
    this.dataSource.data = this.filterProjectsByClient(this.allProjects);
    this._applyCustomFilter();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  applyFilter(event: Event): void {
    this.searchValue = (event.target as HTMLInputElement).value;
    this._applyCustomFilter();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  // ─── Seleção em massa ────────────────────────────────────────
  isAllProjectsSelected(): boolean {
    const visible = this.dataSource.filteredData;
    return visible.length > 0 && visible.every(p => this.selectedProjectIds.has(p.id));
  }

  isSomeProjectsSelected(): boolean {
    return this.dataSource.filteredData.some(p => this.selectedProjectIds.has(p.id));
  }

  toggleAllProjects(checked: boolean): void {
    if (checked) {
      this.dataSource.filteredData.forEach(p => this.selectedProjectIds.add(p.id));
    } else {
      this.dataSource.filteredData.forEach(p => this.selectedProjectIds.delete(p.id));
    }
  }

  toggleProjectSelect(id: string): void {
    if (this.selectedProjectIds.has(id)) {
      this.selectedProjectIds.delete(id);
    } else {
      this.selectedProjectIds.add(id);
    }
  }

  canBulkSelectProjects(): boolean {
    return this.isAdminMaster || this.isClienteAdmin || this.isViewer;
  }

  getSelectedProjects(): any[] {
    return this.dataSource.data.filter(p => this.selectedProjectIds.has(p.id));
  }

  getSelectedProjectsClientId(): string | null {
    const selected = this.getSelectedProjects();
    if (selected.length === 0) return null;
    const clientIds = new Set(selected.map(p => p.clientId).filter(Boolean));
    return clientIds.size === 1 ? selected[0].clientId : null;
  }

  canExportSelectedProjectsPdf(): boolean {
    // Geração em lote PDF desabilitada nesta versão.
    return false;
    /*
    if (!this.isSomeProjectsSelected()) return false;
    return !!this.getSelectedProjectsClientId();
    */
  }

  async exportSelectedProjectsPdfZip(): Promise<void> {
    // Geração em lote PDF desabilitada nesta versão — reativar ao subir a feature.
    return;
    /*
    const selected = this.getSelectedProjects();
    const clientId = this.getSelectedProjectsClientId();

    if (!selected.length || !clientId) {
      this.snackBar.open(
        this.translate.instant('Selecione projetos do mesmo cliente para exportar em lote.'),
        this.translate.instant('Fechar'),
        { duration: 5000 }
      );
      return;
    }

    const clientName = this.clientsMap[clientId] || clientId;
    const dialogRef = this.dialog.open(ClientPdfBatchDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      panelClass: 'client-pdf-batch-dialog-panel',
      autoFocus: false,
      data: {
        clientId,
        clientName,
        projects: selected.map(p => ({
          id: p.id,
          name: p.name || p.id,
          reportTemplateId: p.reportTemplateId as string | undefined,
        })),
      },
    });

    const result = (await dialogRef.afterClosed().toPromise()) as ClientPdfBatchDialogResult | undefined;
    if (!result?.projectTemplates?.length) return;

    const projectTemplates = result.projectTemplates
      .map(item => `${item.projectId}:${item.templateId}`)
      .join('|');

    this.router.navigate(['/reports'], {
      queryParams: {
        clientId,
        projectIds: result.projectTemplates.map(item => item.projectId).join(','),
        projectTemplates,
        exportAction: 'clientBatchPdf',
      },
    });
    */
  }

  async deleteSelectedProjects(): Promise<void> {
    const ids = Array.from(this.selectedProjectIds);

    // 1. Verificação prévia por projeto
    const checks = await Promise.all(
      ids.map(async id => {
        const name = this.dataSource.data.find(p => p.id === id)?.name || 'projeto';
        return { id, name, result: await this.dependencyCheck.checkProject(id, name) };
      })
    );
    const blocked = checks.filter(c => !c.result.canDelete);
    const deletable = checks.filter(c => c.result.canDelete);

    if (blocked.length > 0) {
      const aggregated = blocked.flatMap(b =>
        b.result.blockers.map(bl => ({ ...bl, label: `${bl.label} (${b.name})` }))
      );
      this.dialog.open(DependencyBlockDialogComponent, {
        width: '560px',
        data: {
          entityLabel: blocked.length === 1 ? blocked[0].result.entityLabel : `${blocked.length} projetos selecionados`,
          blockers: aggregated,
        },
      });
      return;
    }

    if (deletable.length === 0) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { message: this.translate.instant(`Tem certeza de que deseja excluir ${deletable.length} projeto(s)? Esta ação não pode ser desfeita.`) },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      try {
        const batch = writeBatch(this.firestore);
        deletable.forEach(c => batch.delete(doc(this.firestore, `projects/${c.id}`)));
        await batch.commit();
        const deletedIds = new Set(deletable.map(c => c.id));
        this.dataSource.data = this.dataSource.data.filter(p => !deletedIds.has(p.id));
        this.selectedProjectIds.clear();
        this.snackBar.open(this.translate.instant('Projetos excluídos com sucesso.'), this.translate.instant('Fechar'), { duration: 3000 });
      } catch (error) {
        console.error('Erro ao excluir projetos em massa:', error);
        this.snackBar.open(this.translate.instant('Erro ao excluir projetos. Tente novamente.'), this.translate.instant('Fechar'), { duration: 3000 });
      }
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    const projectName = this.dataSource.data.find(p => p.id === projectId)?.name || 'projeto';

    // 1. Verificação prévia de dependências
    const depResult = await this.dependencyCheck.checkProject(projectId, projectName);
    if (!depResult.canDelete) {
      this.dialog.open(DependencyBlockDialogComponent, {
        width: '560px',
        data: { entityLabel: depResult.entityLabel, blockers: depResult.blockers },
      });
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { message: this.translate.instant('Tem certeza de que deseja excluir este projeto? Participantes, links e créditos reservados também serão removidos.') },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      try {
        await this.cascadeDeleteProject(projectId);
        this.dataSource.data = this.dataSource.data.filter(p => p.id !== projectId);
        this.snackBar.open(this.translate.instant('Projeto excluído com sucesso.'), this.translate.instant('Fechar'), { duration: 3000 });
      } catch (error) {
        console.error('Erro ao excluir projeto:', error);
        this.snackBar.open(this.translate.instant('Erro ao excluir projeto. Tente novamente mais tarde.'), this.translate.instant('Fechar'), { duration: 3000 });
      }
    });
  }

  private async cascadeDeleteProject(projectId: string): Promise<void> {
    const BATCH_SIZE = 400;

    // 1. Dados do projeto (clientId, groupIds)
    const projectSnap = await getDoc(doc(this.firestore, `projects/${projectId}`));
    if (!projectSnap.exists()) return;
    const projectData = projectSnap.data() as Record<string, any>;
    const clientId: string = projectData['clientId'] || '';
    const groupIds: string[] = Array.isArray(projectData['groupIds']) ? projectData['groupIds'] : [];

    // 2. Participantes do projeto
    const participantsSnap = await getDocs(
      query(collection(this.firestore, 'participants'), where('projectId', '==', projectId))
    );
    const participantIds = participantsSnap.docs.map(d => d.id);

    // 3. AssessmentLinks + créditos a estornar
    let refundCredits = 0;
    const linkRefs: any[] = [];
    for (let i = 0; i < participantIds.length; i += 10) {
      const chunk = participantIds.slice(i, i + 10);
      const linksSnap = await getDocs(
        query(collection(this.firestore, 'assessmentLinks'), where('participantId', 'in', chunk))
      );
      for (const linkDoc of linksSnap.docs) {
        linkRefs.push(linkDoc.ref);
        const d = linkDoc.data();
        if (d['creditReserved'] === true && d['status'] !== 'completed' && d['status'] !== 'cancelled') {
          refundCredits++;
        }
      }
    }

    // 4. Deletar links em batches
    for (let i = 0; i < linkRefs.length; i += BATCH_SIZE) {
      const batch = writeBatch(this.firestore);
      linkRefs.slice(i, i + BATCH_SIZE).forEach(ref => batch.delete(ref));
      await batch.commit();
    }

    // 5. Deletar participantes em batches
    for (let i = 0; i < participantsSnap.docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(this.firestore);
      participantsSnap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 6. Deletar reminderSettings do projeto
    if (clientId) {
      try { await deleteDoc(doc(this.firestore, `reminderSettings/${clientId}_${projectId}`)); } catch { /* não existe */ }
    }

    // 7. Remover projectId de cada grupo
    if (groupIds.length > 0) {
      await Promise.all(groupIds.map(gId =>
        updateDoc(doc(this.firestore, `userGroups/${gId}`), { projectIds: arrayRemove(projectId) }).catch(() => {})
      ));
    }

    // 8. Estornar créditos reservados ao cliente (transação atômica)
    if (clientId && refundCredits > 0) {
      await runTransaction(this.firestore, async (t) => {
        const clientRef = doc(this.firestore, `clients/${clientId}`);
        const snap = await t.get(clientRef);
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, any>;
        t.update(clientRef, {
          credits: (data['credits'] || 0) + refundCredits,
          reservedCredits: Math.max(0, (data['reservedCredits'] || 0) - refundCredits),
        });
      });
    }

    // 9. Deletar o projeto
    await deleteDoc(doc(this.firestore, `projects/${projectId}`));
  }

  openProjectForm(projectId?: string): void {
    if (!this.clientId && !this.isAdminMaster) {
      this.snackBar.open(this.translate.instant('Cliente não identificado. Contate o suporte.'), this.translate.instant('Fechar'), { duration: 3000 });
      return;
    }

    this.router.navigate(
      projectId ? [`/projects/${projectId}/edit`] : ['/projects/new'],
      { queryParams: { clientId: this.clientId } }
    );
  }

  goToProjectUsers(projectId: string): void {
    this.router.navigate([`/projects/${projectId}/users`]);
  }

  goToProjectTemplates(clientId: string, projectId: string): void {
    this.router.navigate([`/projects/${clientId}/${projectId}/templates`]);
  }

  openSendInvitesModal(clientId: string, projectId: string, projectName: string): void {
    this.dialog.open(ParticipantsModalComponent, {
      width: '95vw',
      maxWidth: '1100px',
      panelClass: 'participants-modal-dialog',
      data: { clientId, projectId, projectName },
    });
  }

  goToProjectQuestionnaires(projectId: string): void {
    this.router.navigate([`/projects/assessments/${projectId}`]);
  }

  goBack(): void {
    this.location.back();
  }

  openEmailSelectionModal(projectId: string): void {
    this.dialog.open(EmailSelectionDialogComponent, {
      width: '900px',
      data: { projectId },
    });
  }

  async goToProjectReport(project: {
    id: string;
    clientId: string;
    name: string;
    assessmentId?: string;
    reportTemplateId?: string;
  }): Promise<void> {
    const user = await this.authService.getCurrentUser();
    const dialogRef = this.dialog.open(ProjectExportDialogComponent, {
      width: '580px',
      maxWidth: '95vw',
      panelClass: 'project-export-dialog-panel',
      autoFocus: false,
      data: {
        clientId: project.clientId,
        clientName: this.clientsMap[project.clientId] || project.clientId,
        projectId: project.id,
        projectName: project.name,
        assessmentId: project.assessmentId,
        reportTemplateId: project.reportTemplateId,
        userRole: user?.role || '',
      },
    });

    const result = (await dialogRef.afterClosed().toPromise()) as ProjectExportDialogResult | undefined;
    if (!result) return;

    if (result.action === 'excelClient') {
      await this.exportProjectExcelExtract(project.clientId, project.id);
      return;
    }

    const queryParams: Record<string, string> = {
      clientId: project.clientId,
      projectId: project.id,
    };

    if (result.templateId) {
      queryParams['templateId'] = result.templateId;
    }

    if (result.action !== 'openReports') {
      queryParams['exportAction'] = result.action;
      queryParams['returnTo'] = 'projects';
    }

    this.router.navigate(['/reports'], { queryParams });
  }

  private async exportProjectExcelExtract(clientId: string, projectId: string): Promise<void> {
    const clientName = this.clientsMap[clientId] || clientId;
    this.loadingService.show(this.translate.instant('Gerando extrato do cliente...'));

    try {
      const exportResult = await this.clientExportService.exportClientExtract({
        clientId,
        clientName,
        projectIds: [projectId],
        releasedOnly: this.isViewer || this.isClienteAdmin,
      });

      this.snackBar.open(
        this.translate.instant('Extrato exportado: {{resumo}} linhas (Resumo), {{respostas}} linhas (Respostas).')
          .replace('{{resumo}}', String(exportResult.resumoCount))
          .replace('{{respostas}}', String(exportResult.respostasCount)),
        this.translate.instant('Fechar'),
        { duration: 5000 }
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : this.translate.instant('Erro ao exportar extrato.');
      this.snackBar.open(message, this.translate.instant('Fechar'), { duration: 5000 });
    } finally {
      this.loadingService.hide();
    }
  }

  openResendModal(projectId: string, clientId: string): void {
    this.loadingParticipantsProjectId = projectId;

    const dialogRef = this.dialog.open(ParticipantsComponent, {
      width: '95vw',
      maxWidth: '95vw',
      height: '90vh',
      panelClass: 'participants-fullscreen-dialog',
      data: {
        projectId: projectId,
        clientId: clientId,
      },
    });

    dialogRef.afterOpened().subscribe(() => {
      this.loadingParticipantsProjectId = null;
    });

    dialogRef.afterClosed().subscribe(() => {
      this.loadingParticipantsProjectId = null;
      this.loadProjects();
    });
  }
}
