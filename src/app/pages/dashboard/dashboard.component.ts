import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  AppNewsletterCampaign2Component,
  AppPieCardsComponent,
  AppProjectDataComponent,
  AppSalesOverview2Component,
} from 'src/app/components';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { ExportDialogComponent } from './export-dialog/export-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterModule } from '@angular/router';

// ── Types ──────────────────────────────────────────────────────

export type ProjectStatus = 'em_andamento' | 'em_risco' | 'atrasado' | 'concluido';

export interface AlertItem {
  level: 'danger' | 'warning' | 'info';
  category: string;
  clientName: string;
  title: string;
  description: string;
  route: string;
  queryParams?: Record<string, string>;
}

export interface ProjectRow {
  id: string;
  name: string;
  clientName: string;
  totalParticipants: number;
  respondedParticipants: number;
  responseRate: number;
  deadline: Date | null;
  daysUntilDeadline: number;
  status: ProjectStatus;
}

@Component({
  selector: 'app-dashboard3',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    RouterModule,
    AppPieCardsComponent,
    AppSalesOverview2Component,
    AppProjectDataComponent,
    AppNewsletterCampaign2Component,
    AppPageHeaderComponent,
    TranslateModule,
    NgApexchartsModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  isExporting = false;
  isExportingTables = false;
  exportLabel = '';
  isLoading = true;

  userRole: string | null = null;
  clientId: string | null = null;
  clientName = '';
  userClientIds: string[] = [];

  // ── KPIs (4 cards, role-specific) ─────────────────────────
  masterKpis: { value: number; label: string; color: string; icon: string }[] = [];
  clientKpis: { value: number; label: string; color: string; icon: string }[] = [];

  // ── Alerts ────────────────────────────────────────────────
  alerts: AlertItem[] = [];
  alertLevelFilter  = 'all';
  alertClientFilter = 'all';
  alertSearchQuery  = '';
  alertPageIndex    = 0;
  alertPageSize     = 6;

  get filteredAlerts(): AlertItem[] {
    const q = this.alertSearchQuery.trim().toLowerCase();
    return this.alerts.filter(a => {
      const matchLevel  = this.alertLevelFilter  === 'all' || a.level      === this.alertLevelFilter;
      const matchClient = this.alertClientFilter === 'all' || a.clientName === this.alertClientFilter;
      const matchSearch = !q || a.title.toLowerCase().includes(q)
        || a.description.toLowerCase().includes(q)
        || (a.clientName || '').toLowerCase().includes(q);
      return matchLevel && matchClient && matchSearch;
    });
  }

  get pagedAlerts(): AlertItem[] {
    const start = this.alertPageIndex * this.alertPageSize;
    return this.filteredAlerts.slice(start, start + this.alertPageSize);
  }

  onAlertLevelFilter(level: string): void {
    this.alertLevelFilter = level;
    this.alertPageIndex = 0;
  }

  onAlertClientFilter(value: string): void {
    this.alertClientFilter = value;
    this.alertPageIndex = 0;
  }

  onAlertSearch(): void { this.alertPageIndex = 0; }

  onAlertPage(event: PageEvent): void {
    this.alertPageIndex = event.pageIndex;
    this.alertPageSize  = event.pageSize;
  }

  get alertClients(): string[] {
    return [...new Set(this.alerts.map(a => a.clientName).filter(Boolean))].sort() as string[];
  }

  get alertTableCols(): string[] {
    return this.userRole === 'admin_master'
      ? ['level', 'category', 'clientName', 'description', 'action']
      : ['level', 'category', 'description', 'action'];
  }

  alertCountByLevel(level: string): number {
    return this.alerts.filter(a => a.level === level).length;
  }

  // ── Credits per client (master) ───────────────────────────
  clientCreditRows: {
    clientId: string;
    clientName: string;
    credits: number;
    reservedCredits: number;
    creditsUsed: number;
    projects: { projectId: string; projectName: string; used: number; reserved: number; orphan: boolean }[];
    expanded: boolean;
  }[] = [];
  creditPageIndex   = 0;
  creditPageSize    = 8;
  creditSearchQuery = '';
  creditStatusFilter = '';   // 'zero' | 'low' | 'ok' | ''

  get totalCredits(): number { return this.clientCreditRows.reduce((s, r) => s + r.credits, 0); }
  get totalReservedCredits(): number { return this.clientCreditRows.reduce((s, r) => s + r.reservedCredits, 0); }
  get totalCreditsUsed(): number { return this.clientCreditRows.reduce((s, r) => s + r.creditsUsed, 0); }

  get filteredCreditRows() {
    const q = this.creditSearchQuery.trim().toLowerCase();
    return this.clientCreditRows.filter(r => {
      const matchSearch = !q || r.clientName.toLowerCase().includes(q);
      const matchStatus = !this.creditStatusFilter ||
        (this.creditStatusFilter === 'zero' && r.credits === 0) ||
        (this.creditStatusFilter === 'low'  && r.credits > 0 && r.credits < 5) ||
        (this.creditStatusFilter === 'ok'   && r.credits >= 5);
      return matchSearch && matchStatus;
    });
  }

  get pagedCreditRows() {
    const start = this.creditPageIndex * this.creditPageSize;
    return this.filteredCreditRows.slice(start, start + this.creditPageSize);
  }

  toggleCreditRow(row: any): void { row.expanded = !row.expanded; }

  onCreditPage(event: PageEvent): void {
    this.creditPageIndex = event.pageIndex;
    this.creditPageSize  = event.pageSize;
  }

  onCreditSearch(): void { this.creditPageIndex = 0; }
  onCreditStatusFilter(v: string): void { this.creditStatusFilter = v; this.creditPageIndex = 0; }

  // ── Projects table ────────────────────────────────────────
  projectRows: ProjectRow[] = [];
  masterProjectCols = ['clientName', 'name', 'responseRate', 'deadline', 'status'];
  clientProjectCols = ['name', 'responseRate', 'deadline', 'status'];
  projectPageIndex = 0;
  projectPageSize  = 8;
  projectSearchQuery = '';
  projectClientFilter = '';
  projectStatusFilter = '';

  get uniqueProjectClients(): string[] {
    return [...new Set(this.projectRows.map(r => r.clientName).filter(Boolean))].sort();
  }

  get filteredProjectRows(): ProjectRow[] {
    const q = this.projectSearchQuery.trim().toLowerCase();
    return this.projectRows.filter(r => {
      const matchSearch = !q || r.name.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q);
      const matchClient = !this.projectClientFilter || r.clientName === this.projectClientFilter;
      const matchStatus = !this.projectStatusFilter || r.status === this.projectStatusFilter;
      return matchSearch && matchClient && matchStatus;
    });
  }

  get pagedProjectRows(): ProjectRow[] {
    const start = this.projectPageIndex * this.projectPageSize;
    return this.filteredProjectRows.slice(start, start + this.projectPageSize);
  }

  onProjectPage(event: PageEvent): void {
    this.projectPageIndex = event.pageIndex;
    this.projectPageSize  = event.pageSize;
  }

  onProjectSearch(): void { this.projectPageIndex = 0; }
  onProjectClientFilter(v: string): void { this.projectClientFilter = v; this.projectPageIndex = 0; }
  onProjectStatusFilter(v: string): void { this.projectStatusFilter = v; this.projectPageIndex = 0; }

  // ── Funnel (master only) ──────────────────────────────────
  funnelData = { created: 0, invitesSent: 0, completed: 0 };
  funnelAllProjects: any[] = [];
  funnelInvitedProjectIds = new Set<string>();
  funnelClientsMap = new Map<string, string>();
  funnelClientOptions: { id: string; name: string }[] = [];
  funnelClientFilter = 'all';

  // ── Existing chart data (kept for charts section) ─────────
  pieCardsData: { value: number; label: string; color: string; icon: string }[] = [];
  assessmentsData: { client: string; used: number; remaining: number }[] = [];
  projectsByClientData: { client: string; projects: number }[] = [];
  participantsByCategoryChart: any = null;
  projectsByStatusChart: any = null;
  totalActiveProjects = 0;

  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  private headersMap: Record<string, { key: string; header: string }[]> = {
    clients: [
      { key: 'companyName', header: 'Nome da Empresa' },
      { key: 'credits', header: 'Créditos Disponíveis' },
      { key: 'sector', header: 'Setor' },
      { key: 'cnpj', header: 'CNPJ' },
      { key: 'createdAt', header: 'Data de Criação' },
    ],
    creditOrders: [
      { key: 'credits', header: 'Créditos' },
      { key: 'totalAmount', header: 'Valor Total' },
      { key: 'status', header: 'Status' },
      { key: 'startDate', header: 'Data de Início' },
      { key: 'validityDate', header: 'Data de Validade' },
      { key: 'clientId', header: 'Cliente' },
    ],
    projects: [
      { key: 'name', header: 'Nome do Projeto' },
      { key: 'status', header: 'Status' },
      { key: 'budget', header: 'Orçamento' },
      { key: 'deadline', header: 'Prazo' },
      { key: 'clientId', header: 'Cliente' },
      { key: 'createdAt', header: 'Data de Criação' },
    ],
    participants: [
      { key: 'name', header: 'Nome' },
      { key: 'email', header: 'E-mail' },
      { key: 'category', header: 'Categoria' },
      { key: 'type', header: 'Tipo' },
      { key: 'projectId', header: 'Projeto' },
      { key: 'createdAt', header: 'Data de Criação' },
    ],
  };

  availableTables = [
    { key: 'clients',      label: 'Clientes' },
    { key: 'projects',     label: 'Projetos' },
    { key: 'creditOrders', label: 'Pedidos de Crédito' },
    { key: 'participants', label: 'Participantes' },
  ];

  constructor(
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar,
  ) {}

  async ngOnInit(): Promise<void> {
    this.userRole = await this.authService.getCurrentUserRole();
    // Suporta clients[] (novo) e campo legado client
    this.userClientIds = await this.authService.getCurrentUserClientIds();
    if (this.userClientIds.length === 0) {
      const legacy = await this.authService.getCurrentClientId();
      if (legacy) this.userClientIds = [legacy];
    }
    this.clientId = this.userClientIds[0] || null;

    // Viewer não acessa o dashboard
    if (this.userRole === 'viewer') {
      this.router.navigate(['/assessments']);
      return;
    }

    if (this.userRole === 'admin_master') {
      await this.loadMasterData();
    } else {
      await this.loadClientData();
    }

    this.isLoading = false;
    this.cdr.markForCheck();
  }

  // ── Master data loading ───────────────────────────────────

  private async loadMasterData(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [clientsSnap, projectsSnap, participantsSnap, assessmentsSnap, linksSnap] = await Promise.all([
      getDocs(collection(this.firestore, 'clients')),
      getDocs(collection(this.firestore, 'projects')),
      getDocs(collection(this.firestore, 'participants')),
      getDocs(collection(this.firestore, 'assessments')),
      getDocs(query(collection(this.firestore, 'assessmentLinks'), where('status', '==', 'completed'))),
    ]);

    const clientsMap = new Map(clientsSnap.docs.map(d => [d.id, d.data()]));
    const activeProjects = projectsSnap.docs.filter(d => !['Cancelado', 'Inativo'].includes(d.data()['status']));

    // assessmentLinks: completed já carregado, buscar pending também
    const completedParticipantIds = new Set(linksSnap.docs.map(d => d.data()['participantId'] as string));
    const pendingLinkSnap = await getDocs(query(collection(this.firestore, 'assessmentLinks'), where('status', '==', 'pending')));
    const pendingParticipantIds = new Set(pendingLinkSnap.docs.map(d => d.data()['participantId'] as string));
    // withInviteIds = quem tem qualquer link (completed ou pending)
    const withInviteIds = new Set([...completedParticipantIds, ...pendingParticipantIds]);

    const statsByProject = this.buildParticipantStats(participantsSnap.docs, completedParticipantIds, withInviteIds);

    // Projetos com pelo menos 1 participante com link = "com convites enviados" no funil
    // (buscamos pelo projectId dos participantes que têm link)
    const invitedParticipantProjectIds = new Set(
      participantsSnap.docs
        .filter(d => withInviteIds.has(d.id))
        .map(d => d.data()['projectId'] as string)
    );

    // KPIs — pendentes = participantes com link pending
    const pendingCount = participantsSnap.docs.filter(d => pendingParticipantIds.has(d.id)).length;
    this.masterKpis = [
      { value: clientsSnap.size,       label: 'Clientes Ativos',          color: '#1B84FF', icon: 'business' },
      { value: activeProjects.length,  label: 'Projetos Ativos',          color: '#26c6da', icon: 'folder_open' },
      { value: pendingCount,           label: 'Avaliações em Andamento',  color: '#7c3aed', icon: 'assignment_turned_in' },
    ];

    // Credits per client — com breakdown por projeto
    const UNKNOWN_PROJECT = '__sem_projeto__';

    // Mapa de utilizados: clientId → Map<projectId, count>
    // Fonte: assessmentLinks completed, enriquecido com clientId do participante
    const usedByClientProject = new Map<string, Map<string, number>>();
    participantsSnap.docs.forEach(pDoc => {
      const data = pDoc.data();
      const clientId = data['clientId'] as string;
      if (!clientId) return;
      if (completedParticipantIds.has(pDoc.id)) {
        const projectId = (data['projectId'] as string) || UNKNOWN_PROJECT;
        if (!usedByClientProject.has(clientId)) usedByClientProject.set(clientId, new Map());
        const proj = usedByClientProject.get(clientId)!;
        proj.set(projectId, (proj.get(projectId) || 0) + 1);
      }
    });

    // Mapa de reservados: clientId → Map<projectId, count>
    // Fonte: assessmentLinks com creditReserved=true e status=pending (computado localmente,
    // não usa clients.reservedCredits que pode estar desatualizado)
    const reservedByClientProject = new Map<string, Map<string, number>>();
    pendingLinkSnap.docs.forEach(linkDoc => {
      const data = linkDoc.data();
      if (!data['creditReserved']) return;
      const clientId = data['clientId'] as string;
      if (!clientId) return;
      const projectId = (data['projectId'] as string) || UNKNOWN_PROJECT;
      if (!reservedByClientProject.has(clientId)) reservedByClientProject.set(clientId, new Map());
      const proj = reservedByClientProject.get(clientId)!;
      proj.set(projectId, (proj.get(projectId) || 0) + 1);
    });

    const projectsNameMap = new Map(projectsSnap.docs.map(d => [d.id, (d.data()['name'] as string) || '—']));

    this.clientCreditRows = clientsSnap.docs
      .map(d => {
        const usedMap      = usedByClientProject.get(d.id)     || new Map<string, number>();
        const reservedMap  = reservedByClientProject.get(d.id) || new Map<string, number>();

        // União de todos os projetos com qualquer atividade de crédito
        const allProjectIds = new Set([...usedMap.keys(), ...reservedMap.keys()]);

        const projects = Array.from(allProjectIds)
          .map(projectId => {
            const used     = usedMap.get(projectId)     || 0;
            const reserved = reservedMap.get(projectId) || 0;
            let projectName: string;
            let orphan = false;
            if (projectId === UNKNOWN_PROJECT) {
              projectName = 'Sem projeto';
              orphan = true;
            } else {
              const found = projectsNameMap.get(projectId);
              projectName = found ?? 'Projeto excluído';
              orphan = !found;
            }
            return { projectId, projectName, used, reserved, orphan };
          })
          .sort((a, b) => (b.used + b.reserved) - (a.used + a.reserved));

        // Totais computados localmente (consistência garantida)
        const creditsUsedCalc     = projects.reduce((s, p) => s + p.used,     0);
        const reservedCreditsCalc = projects.reduce((s, p) => s + p.reserved, 0);

        return {
          clientId: d.id,
          clientName: (d.data()['companyName'] as string) || '—',
          credits: (d.data()['credits'] as number) || 0,
          reservedCredits: reservedCreditsCalc,   // ← computado de links reais, não do campo Firestore
          creditsUsed: creditsUsedCalc,
          projects,
          expanded: false,
        };
      })
      .sort((a, b) => a.credits - b.credits); // menor primeiro (mais crítico no topo)

    // Projects table
    this.projectRows = this.buildProjectRows(projectsSnap.docs, statsByProject, clientsMap, today);

    // Alerts
    this.alerts = this.buildAlerts(projectsSnap.docs, clientsSnap.docs, statsByProject, today);

    // Funil — dados base (todos os clientes)
    this.funnelAllProjects = projectsSnap.docs;
    this.funnelInvitedProjectIds = invitedParticipantProjectIds;
    this.funnelClientsMap = new Map(clientsSnap.docs.map(d => [d.id, (d.data()['companyName'] as string) || '']));
    this.funnelClientOptions = [
      { id: 'all', name: 'Todos os clientes' },
      ...clientsSnap.docs.map(d => ({ id: d.id, name: (d.data()['companyName'] as string) || '—' })),
    ];
    this.buildFunnelData(projectsSnap.docs, invitedParticipantProjectIds);

    // Existing chart data (charts section)
    this.totalActiveProjects = activeProjects.length;
    const projectCountByClient = new Map<string, number>();
    activeProjects.forEach(d => {
      const id = d.data()['clientId'];
      if (id) projectCountByClient.set(id, (projectCountByClient.get(id) || 0) + 1);
    });
    this.projectsByClientData = clientsSnap.docs.map(d => ({
      client: d.data()['companyName'],
      projects: projectCountByClient.get(d.id) || 0,
    }));

    const byClientAssessments = new Map<string, number>();
    assessmentsSnap.docs.forEach(d => {
      const id = d.data()['clientId'];
      if (id) byClientAssessments.set(id, (byClientAssessments.get(id) || 0) + 1);
    });
    this.assessmentsData = Array.from(byClientAssessments.entries()).map(([id, count]) => ({
      client: (clientsMap.get(id) as any)?.['companyName'] || 'Desconhecido',
      used: count,
      remaining: 0,
    }));

    this.buildCategoryChartFromDocs(participantsSnap.docs);
    this.buildProjectsByStatusChart(projectsSnap.docs);
  }

  // ── Client data loading ───────────────────────────────────

  private async loadClientData(): Promise<void> {
    if (this.userClientIds.length === 0) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Carrega dados de todos os clientes vinculados ao usuário
    const clientSnaps = await Promise.all(
      this.userClientIds.map(id => getDoc(doc(this.firestore, 'clients', id)))
    );
    const clientDataMap = new Map<string, any>();
    let totalCredits = 0;
    clientSnaps.forEach(snap => {
      if (snap.exists()) {
        clientDataMap.set(snap.id, snap.data());
        totalCredits += snap.data()['credits'] || 0;
      }
    });

    // Nome exibido: único cliente ou lista resumida
    this.clientName = clientSnaps.length === 1
      ? (clientSnaps[0].exists() ? clientSnaps[0].data()['companyName'] || '' : '')
      : `${clientSnaps.length} clientes`;

    // Busca projetos, participantes e assessments de todos os clientes via 'in'
    const [projectsSnap, participantsSnap, assessmentsSnap] = await Promise.all([
      getDocs(query(collection(this.firestore, 'projects'), where('clientId', 'in', this.userClientIds))),
      getDocs(query(collection(this.firestore, 'participants'), where('clientId', 'in', this.userClientIds))),
      getDocs(query(collection(this.firestore, 'assessments'), where('clientId', 'in', this.userClientIds))),
    ]);

    // Carregar assessmentLinks para os participantes
    const pIds = participantsSnap.docs.map(d => d.id);
    const completedParticipantIds = new Set<string>();
    const pendingParticipantIds = new Set<string>();
    if (pIds.length > 0) {
      const batchSize = 10;
      for (let i = 0; i < pIds.length; i += batchSize) {
        const batch = pIds.slice(i, i + batchSize);
        const [compSnap, pendSnap] = await Promise.all([
          getDocs(query(collection(this.firestore, 'assessmentLinks'), where('participantId', 'in', batch), where('status', '==', 'completed'))),
          getDocs(query(collection(this.firestore, 'assessmentLinks'), where('participantId', 'in', batch), where('status', '==', 'pending'))),
        ]);
        compSnap.docs.forEach(d => completedParticipantIds.add(d.data()['participantId']));
        pendSnap.docs.forEach(d => pendingParticipantIds.add(d.data()['participantId']));
      }
    }

    const withInviteIds = new Set([...completedParticipantIds, ...pendingParticipantIds]);
    const activeProjects = projectsSnap.docs.filter(d => !['Cancelado', 'Inativo'].includes(d.data()['status']));
    const statsByProject = this.buildParticipantStats(participantsSnap.docs, completedParticipantIds, withInviteIds);

    const pendingCount = participantsSnap.docs.filter(d => pendingParticipantIds.has(d.id)).length;
    const totalParticipants = participantsSnap.docs.filter(d => d.data()['type'] === 'avaliado').length;

    this.clientKpis = [
      { value: activeProjects.length, label: 'Projetos Ativos',          color: '#1B84FF', icon: 'folder_open' },
      { value: pendingCount,          label: 'Avaliações em Andamento',  color: '#26c6da', icon: 'assignment_turned_in' },
      { value: totalParticipants,     label: 'Participantes Ativos',     color: '#7c3aed', icon: 'groups' },
      { value: totalCredits,          label: 'Créditos Disponíveis',     color: '#4caf50', icon: 'toll' },
    ];

    this.projectRows = this.buildProjectRows(projectsSnap.docs, statsByProject, clientDataMap as any, today);

    const fakeClientDocs = clientSnaps
      .filter(s => s.exists())
      .map(s => ({ id: s.id, data: () => s.data() } as any));
    this.alerts = this.buildAlerts(projectsSnap.docs, fakeClientDocs, statsByProject, today);

    this.buildCategoryChartFromDocs(participantsSnap.docs);
    this.buildProjectsByStatusChart(projectsSnap.docs);

    // Gráfico de projetos por cliente (relevante quando há múltiplos clientes)
    this.projectsByClientData = Array.from(clientDataMap.entries()).map(([id, data]) => ({
      client: data['companyName'] || id,
      projects: activeProjects.filter(d => d.data()['clientId'] === id).length,
    }));

    this.assessmentsData = Array.from(clientDataMap.entries()).map(([id, data]) => ({
      client: data['companyName'] || id,
      used: assessmentsSnap.docs.filter(d => d.data()['clientId'] === id).length,
      remaining: 0,
    }));

    this.totalActiveProjects = activeProjects.length;
  }

  // ── Helpers ───────────────────────────────────────────────

  private buildParticipantStats(
    docs: any[],
    completedIds: Set<string> = new Set(),
    withInviteIds: Set<string> = new Set()
  ): Map<string, { total: number; responded: number; withInvite: number }> {
    const map = new Map<string, { total: number; responded: number; withInvite: number }>();
    docs.forEach(d => {
      const data = d.data();
      const pid = data['projectId'];
      if (!pid) return;
      const entry = map.get(pid) || { total: 0, responded: 0, withInvite: 0 };
      // total = TODOS os participantes do projeto (com ou sem convite)
      // Assim, novos participantes adicionados derrubam o percentual imediatamente
      entry.total++;
      if (withInviteIds.has(d.id)) {
        entry.withInvite++;
        if (completedIds.has(d.id)) entry.responded++;
      }
      map.set(pid, entry);
    });
    return map;
  }

  private buildProjectRows(
    projectDocs: any[],
    statsByProject: Map<string, { total: number; responded: number; withInvite: number }>,
    clientsMap: Map<string, any>,
    today: Date
  ): ProjectRow[] {
    const rows: ProjectRow[] = projectDocs
      .filter(d => !['Cancelado', 'Inativo'].includes(d.data()['status']))
      .map(d => {
        const data = d.data();
        const stats = statsByProject.get(d.id) || { total: 0, responded: 0, withInvite: 0 };
        const responseRate = stats.total > 0 ? Math.round((stats.responded / stats.total) * 100) : 0;
        const deadline = data['deadline']
          ? new Date(data['deadline'].seconds * 1000)
          : null;
        const daysLeft = deadline
          ? Math.ceil((deadline.getTime() - today.getTime()) / 86400000)
          : 9999;
        const clientData = clientsMap.get(data['clientId']);

        let status: ProjectStatus = 'em_andamento';
        if (data['status'] === 'Concluído') {
          status = 'concluido';
        } else if (daysLeft < 0 && responseRate < 100) {
          // Prazo vencido E ainda há respostas pendentes
          status = 'atrasado';
        } else if (daysLeft >= 0 && daysLeft <= 7 && responseRate < 100) {
          // Prazo chegando (≤ 7 dias) E ainda há respostas pendentes
          status = 'em_risco';
        }

        return {
          id: d.id,
          name: data['name'] || '',
          clientName: clientData?.['companyName'] || '',
          totalParticipants: stats.total,
          respondedParticipants: stats.responded,
          responseRate,
          deadline,
          daysUntilDeadline: daysLeft,
          status,
        } as ProjectRow;
      });

    const order: Record<ProjectStatus, number> = { atrasado: 0, em_risco: 1, em_andamento: 2, concluido: 3 };
    return rows.sort((a, b) => order[a.status] - order[b.status]);
  }

  private buildAlerts(
    projectDocs: any[],
    clientDocs: any[],
    statsByProject: Map<string, { total: number; responded: number; withInvite: number }>,
    today: Date
  ): AlertItem[] {
    const alerts: AlertItem[] = [];
    const cMap = new Map(clientDocs.map(d => [d.id, d.data()['companyName'] as string]));
    const activeStatuses = ['Em andamento', 'Ativo']; // inclui legado

    // 🔴 Crítico: prazo vencido com respostas pendentes
    projectDocs
      .filter(d => {
        const data = d.data();
        if (!activeStatuses.includes(data['status'])) return false;
        const deadline = data['deadline'] ? new Date(data['deadline'].seconds * 1000) : null;
        if (!deadline) return false;
        const days = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
        if (days >= 0) return false; // não vencido
        const stats = statsByProject.get(d.id);
        const rate = stats && stats.total > 0 ? (stats.responded / stats.total) * 100 : 0;
        return rate < 100; // ainda tem pendências
      })
      .forEach(d => {
        const data = d.data();
        const stats = statsByProject.get(d.id);
        const rate = stats && stats.total > 0 ? Math.round((stats.responded / stats.total) * 100) : 0;
        const overdue = Math.abs(Math.ceil((new Date(data['deadline'].seconds * 1000).getTime() - today.getTime()) / 86400000));
        alerts.push({
          level: 'danger',
          category: 'Prazo Vencido',
          clientName: cMap.get(data['clientId']) || '',
          title: data['name'] || '',
          description: `Vencido há ${overdue} dia(s) — ${rate}% respondido`,
          route: '/projects',
        });
      });

    // 🟠 Atenção: prazo em ≤ 7 dias com respostas incompletas
    projectDocs
      .filter(d => {
        const data = d.data();
        if (!activeStatuses.includes(data['status'])) return false;
        const deadline = data['deadline'] ? new Date(data['deadline'].seconds * 1000) : null;
        if (!deadline) return false;
        const days = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
        if (days < 0 || days > 7) return false; // já vencido ou folga suficiente
        const stats = statsByProject.get(d.id);
        const rate = stats && stats.total > 0 ? (stats.responded / stats.total) * 100 : 0;
        return rate < 100;
      })
      .forEach(d => {
        const data = d.data();
        const stats = statsByProject.get(d.id);
        const rate = stats && stats.total > 0 ? Math.round((stats.responded / stats.total) * 100) : 0;
        const days = Math.ceil((new Date(data['deadline'].seconds * 1000).getTime() - today.getTime()) / 86400000);
        const pending = (stats?.total ?? 0) - (stats?.responded ?? 0);
        alerts.push({
          level: 'warning',
          category: 'Prazo Próximo',
          clientName: cMap.get(data['clientId']) || '',
          title: data['name'] || '',
          description: `${days} dia(s) restante(s) — ${pending} resposta(s) pendente(s) (${rate}% concluído)`,
          route: '/projects',
        });
      });

    // 🔵 Aviso: cliente sem créditos
    clientDocs
      .filter(d => (d.data()['credits'] || 0) === 0)
      .forEach(d => {
        alerts.push({
          level: 'info',
          category: 'Sem Créditos',
          clientName: d.data()['companyName'] || '',
          title: d.data()['companyName'] || '',
          description: 'Créditos esgotados — realize um pedido para continuar',
          route: '/orders',
        });
      });

    return alerts;
  }

  private buildCategoryChartFromDocs(docs: any[]): void {
    const byCategory = new Map<string, number>();
    docs.forEach(d => {
      const cat = d.data()['category'] || d.data()['type'] || 'Outros';
      byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
    });
    if (byCategory.size === 0) return;

    const labels = Array.from(byCategory.keys());
    const values = Array.from(byCategory.values());

    this.participantsByCategoryChart = {
      series: values,
      chart: {
        type: 'donut',
        height: 260,
        toolbar: { show: false },
        fontFamily: 'Poppins, sans-serif',
      },
      labels,
      colors: ['#1B84FF', '#26c6da', '#fc4b6c', '#ffb22b', '#4caf50', '#7c3aed'],
      legend: { position: 'bottom', fontFamily: 'Poppins, sans-serif', fontSize: '12px' },
      dataLabels: { enabled: false },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Total',
                color: '#1e293b',
                formatter: (w: any) => w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0),
              },
            },
          },
        },
      },
      stroke: { width: 2, colors: ['#fff'] },
      tooltip: { theme: 'light' },
    };
  }

  private buildProjectsByStatusChart(projectDocs: any[]): void {
    const counts: Record<string, number> = { 'Em andamento': 0, 'Concluído': 0, 'Cancelado': 0 };
    projectDocs.forEach(d => {
      const s = d.data()['status'];
      if (s === 'Em andamento' || s === 'Ativo') counts['Em andamento']++;
      else if (s === 'Concluído') counts['Concluído']++;
      else if (s === 'Cancelado' || s === 'Inativo') counts['Cancelado']++;
    });

    const labels = Object.keys(counts);
    const values = Object.values(counts);
    const colors = ['#1B84FF', '#4caf50', '#fc4b6c'];

    this.projectsByStatusChart = {
      series: [{ name: 'Projetos', data: values }],
      chart: { type: 'bar', height: 220, toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
      plotOptions: { bar: { horizontal: false, columnWidth: '40%', borderRadius: 6, borderRadiusApplication: 'end', distributed: true } },
      colors,
      dataLabels: { enabled: true, formatter: (val: number) => val > 0 ? String(val) : '', style: { fontSize: '13px', fontFamily: 'Poppins', colors: ['#374151'] }, offsetY: -6 },
      xaxis: { categories: labels, labels: { style: { fontSize: '12px', fontFamily: 'Poppins' } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { show: true, min: 0, tickAmount: 3, labels: { style: { fontSize: '11px' } } },
      grid: { borderColor: '#f1f5f9', yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } } },
      legend: { show: false },
      tooltip: { theme: 'light', y: { formatter: (val: number) => `${val} projeto${val !== 1 ? 's' : ''}` } },
    };
  }

  buildFunnelData(projectDocs: any[], invitedProjectIds: Set<string>, clientFilter = 'all'): void {
    const filtered = clientFilter === 'all'
      ? projectDocs
      : projectDocs.filter(d => d.data()['clientId'] === clientFilter);

    const active = filtered.filter(d => !['Cancelado', 'Inativo'].includes(d.data()['status']));
    const created = active.length;
    const invitesSent = active.filter(d => invitedProjectIds.has(d.id)).length;
    const completed = active.filter(d => d.data()['status'] === 'Concluído').length;

    this.funnelData = { created, invitesSent, completed };
  }

  onFunnelClientFilter(clientId: string): void {
    this.funnelClientFilter = clientId;
    this.buildFunnelData(this.funnelAllProjects, this.funnelInvitedProjectIds, clientId);
  }

  // ── Template helpers ──────────────────────────────────────

  statusLabel(status: ProjectStatus): string {
    const map: Record<ProjectStatus, string> = {
      em_andamento: 'Em andamento',
      em_risco: 'Em risco',
      atrasado: 'Atrasado',
      concluido: 'Concluído',
    };
    return map[status];
  }

  statusClass(status: ProjectStatus): string {
    const map: Record<ProjectStatus, string> = {
      em_andamento: 'status-badge--blue',
      em_risco: 'status-badge--yellow',
      atrasado: 'status-badge--red',
      concluido: 'status-badge--green',
    };
    return map[status];
  }

  deadlineLabel(row: ProjectRow): string {
    if (!row.deadline) return '—';
    if (row.status === 'concluido') return row.deadline.toLocaleDateString('pt-BR');
    if (row.daysUntilDeadline < 0) return `${Math.abs(row.daysUntilDeadline)}d atrasado`;
    if (row.daysUntilDeadline === 0) return 'Hoje';
    if (row.daysUntilDeadline <= 7) return `${row.daysUntilDeadline}d restante(s)`;
    return row.deadline.toLocaleDateString('pt-BR');
  }

  deadlineClass(row: ProjectRow): string {
    if (!row.deadline || row.status === 'concluido') return '';
    if (row.daysUntilDeadline < 0) return 'deadline--overdue';
    if (row.daysUntilDeadline <= 3) return 'deadline--critical';
    if (row.daysUntilDeadline <= 7) return 'deadline--warning';
    return '';
  }

  // ── Exports ───────────────────────────────────────────────

  async generatePDF(): Promise<void> {
    if (this.isExporting) return;

    const dashboardEl = document.getElementById('dashboard-content');
    if (!dashboardEl) {
      this.snackBar.open(this.translate.instant('Elemento do dashboard não encontrado.'), this.translate.instant('Fechar'), { duration: 3000 });
      return;
    }

    this.isExporting = true;
    this.exportLabel = this.translate.instant('Preparando impressão...');
    this.cdr.markForCheck();

    let iframe: HTMLIFrameElement | null = null;

    try {
      await new Promise(r => setTimeout(r, 100));

      const canvases = Array.from(dashboardEl.querySelectorAll('canvas')) as HTMLCanvasElement[];
      const canvasDataUrls = canvases.map(c => {
        try { return c.toDataURL('image/jpeg', 0.92); } catch { return ''; }
      });

      const clone = dashboardEl.cloneNode(true) as HTMLElement;

      Array.from(clone.querySelectorAll('canvas')).forEach((clonedCanvas, i) => {
        const dataUrl = canvasDataUrls[i];
        if (!dataUrl) return;
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.width  = canvases[i].style.width  || `${canvases[i].offsetWidth}px`;
        img.style.height = canvases[i].style.height || `${canvases[i].offsetHeight}px`;
        img.style.maxWidth = '100%';
        img.style.display = 'block';
        clonedCanvas.parentNode?.replaceChild(img, clonedCanvas);
      });

      const angularStyles = Array.from(document.head.querySelectorAll('style'))
        .map(s => s.innerHTML).join('\n');
      const linkTags = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'))
        .map(l => l.outerHTML).join('\n');

      iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;border:none;visibility:hidden;';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument!;
      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base href="${window.location.origin}/">
  ${linkTags}
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
    body { margin: 0; padding: 0; font-family: Roboto, "Helvetica Neue", sans-serif; background: #fff; width: 186mm; }
    #dashboard-content { width: 100%; }
    table { border-collapse: collapse; }
    img, svg { max-width: 100% !important; height: auto; }
    ${angularStyles}
  </style>
</head>
<body>
  <div id="dashboard-content">${clone.innerHTML}</div>
  <script>
    (function() {
      var bodyWidth = document.body.offsetWidth;
      document.querySelectorAll('table').forEach(function(table) {
        var natural = table.scrollWidth;
        if (natural <= bodyWidth + 2) return;
        var scale = bodyWidth / natural;
        var origH = table.offsetHeight;
        var wrap = document.createElement('div');
        wrap.style.cssText = 'width:100%;overflow:hidden;display:block;';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
        table.style.transformOrigin = 'top left';
        table.style.transform = 'scale(' + scale + ')';
        table.style.marginBottom = (origH * (scale - 1)) + 'px';
      });
    })();
  <\/script>
</body>
</html>`);
      iframeDoc.close();

      await new Promise<void>((resolve) => {
        const doPrint = () => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            window.removeEventListener('afterprint', finish);
            try { iframe!.contentWindow?.removeEventListener('afterprint', finish); } catch {}
            clearTimeout(safetyTimer);
            resolve();
          };
          window.addEventListener('afterprint', finish);
          try { iframe!.contentWindow?.addEventListener('afterprint', finish); } catch {}
          const safetyTimer = setTimeout(finish, 2 * 60 * 1000);
          iframe!.contentWindow?.focus();
          iframe!.contentWindow?.print();
        };
        iframe!.addEventListener('load', () => setTimeout(doPrint, 400));
      });

      this.snackBar.open(this.translate.instant('Dashboard exportado com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
    } catch (err) {
      console.error(err);
      this.snackBar.open(this.translate.instant('Erro ao exportar o dashboard.'), this.translate.instant('Fechar'), { duration: 4000 });
    } finally {
      if (iframe && document.body.contains(iframe)) document.body.removeChild(iframe);
      this.isExporting = false;
      this.exportLabel = '';
      this.cdr.markForCheck();
    }
  }

  openExportDialog(): void {
    const dialogRef = this.dialog.open(ExportDialogComponent, {
      width: '400px',
      data: { availableTables: this.availableTables },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result) return;
      const { selectedTable, selectedFormat } = result;
      this.isExportingTables = true;
      this.exportLabel = this.translate.instant('Exportando') + ' ' + selectedTable.label + '...';
      this.cdr.markForCheck();
      try {
        if (selectedFormat === 'excel') await this.exportToExcel(selectedTable.key, selectedTable.label);
        else if (selectedFormat === 'pdf') await this.exportToPDF(selectedTable.key, selectedTable.label);
      } finally {
        this.isExportingTables = false;
        this.exportLabel = '';
        this.cdr.markForCheck();
      }
    });
  }

  private async exportToExcel(tableKey: string, tableLabel: string): Promise<void> {
    const data = await this.getFormattedData(tableKey);
    const headers = this.headersMap[tableKey] || [];
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(tableLabel);

    const headerRow = worksheet.addRow(headers.map(h => h.header));
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B84FF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    data.forEach(row => {
      const dataRow = worksheet.addRow(headers.map(h => row[h.key] || ''));
      dataRow.eachCell(cell => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    worksheet.columns = headers.map(() => ({ width: 22 }));
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tableLabel}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.snackBar.open(this.translate.instant('Exportado com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
  }

  private async exportToPDF(tableKey: string, tableLabel: string): Promise<void> {
    const data = await this.getFormattedData(tableKey);
    const headers = this.headersMap[tableKey] || [];
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(tableLabel, 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [headers.map(h => h.header)],
      body: data.map(row => headers.map(h => row[h.key] || '')),
      theme: 'grid',
      headStyles: { fillColor: [27, 132, 255], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: 50 },
      styles: { cellPadding: 3, fontSize: 10 },
    });
    doc.save(`${tableLabel}.pdf`);
    this.snackBar.open(this.translate.instant('Exportado com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
  }

  private formatDate(ts: any): string {
    if (!ts?.seconds) return '';
    const d = new Date(ts.seconds * 1000);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
  }

  private async getFormattedData(tableKey: string): Promise<any[]> {
    const snap = await getDocs(collection(this.firestore, tableKey));
    const [clientsSnap, projectsSnap] = await Promise.all([
      getDocs(collection(this.firestore, 'clients')),
      getDocs(collection(this.firestore, 'projects')),
    ]);
    const clientsMap  = new Map(clientsSnap.docs.map(d  => [d.id,  d.data()['companyName']]));
    const projectsMap = new Map(projectsSnap.docs.map(d => [d.id, d.data()['name']]));

    return snap.docs.map(d => {
      const item: any = { ...d.data() };
      return {
        ...item,
        clientId:     item.clientId     ? clientsMap.get(item.clientId)   || 'Desconhecido' : '',
        projectId:    item.projectId    ? projectsMap.get(item.projectId) || 'Desconhecido' : '',
        createdAt:    this.formatDate(item.createdAt),
        startDate:    this.formatDate(item.startDate),
        validityDate: this.formatDate(item.validityDate),
        deadline:     this.formatDate(item.deadline),
      };
    });
  }
}
