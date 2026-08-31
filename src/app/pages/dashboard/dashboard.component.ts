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
import { fixMojibake } from 'src/app/utils/encoding.utils';
import { translateParticipantCategory } from 'src/app/utils/i18n-labels.util';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  clientId: string;
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
  viewerProjectIds = new Set<string>();

  // â”€â”€ KPIs (4 cards, role-specific) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  masterKpis: { value: number; label: string; color: string; icon: string }[] = [];
  clientKpis: { value: number; label: string; color: string; icon: string }[] = [];

  // â”€â”€ Alerts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Credits per client (master) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  clientCreditRows: {
    clientId: string;
    clientName: string;
    credits: number;
    reservedCredits: number;
    creditsUsed: number;
    projects: { projectId: string; projectName: string; reserved: number; consumed: number; orphan: boolean }[];
    expanded: boolean;
  }[] = [];
  creditPageIndex   = 0;
  creditPageSize    = 8;
  creditSearchQuery = '';
  creditStatusFilter = '';   // 'zero' | 'low' | 'ok' | ''

  get totalCredits(): number         { return this.clientCreditRows.reduce((s, r) => s + r.credits, 0); }
  get totalReservedCredits(): number  { return this.clientCreditRows.reduce((s, r) => s + r.reservedCredits, 0); }
  get totalCreditsUsed(): number      { return this.clientCreditRows.reduce((s, r) => s + r.creditsUsed, 0); }

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

  getReservedCreditTooltip(count: number): string {
    return count === 1
      ? '1 crédito reservado — avaliado cadastrado no projeto'
      : `${count} créditos reservados — avaliados cadastrados no projeto`;
  }

  getConsumedCreditTooltip(count: number): string {
    return count === 1
      ? '1 crédito consumido — avaliado com ciclo concluído'
      : `${count} créditos consumidos — avaliados com ciclo concluído`;
  }

  // â”€â”€ Projects table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  projectRows: ProjectRow[] = [];
  masterProjectCols = ['clientName', 'name', 'responseRate', 'deadline', 'status', 'actions'];
  clientProjectCols = ['name', 'responseRate', 'deadline', 'status', 'actions'];
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

  // â”€â”€ Funnel (master only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  funnelData = { total: 0, active: 0, completed: 0 };
  funnelAllProjects: any[] = [];
  funnelInvitedProjectIds = new Set<string>();
  funnelClientsMap = new Map<string, string>();
  funnelClientOptions: { id: string; name: string }[] = [];
  funnelClientFilter = 'all';

  // â”€â”€ Existing chart data (kept for charts section) â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      { key: 'credits', header: 'Cr\u00e9ditos Dispon\u00edveis' },
      { key: 'sector', header: 'Setor' },
      { key: 'cnpj', header: 'CNPJ' },
      { key: 'createdAt', header: 'Data de Cria\u00e7\u00e3o' },
    ],
    creditOrders: [
      { key: 'credits', header: 'Cr\u00e9ditos' },
      { key: 'totalAmount', header: 'Valor Total' },
      { key: 'status', header: 'Status' },
      { key: 'startDate', header: 'Data de In\u00edcio' },
      { key: 'validityDate', header: 'Data de Validade' },
      { key: 'clientId', header: 'Cliente' },
    ],
    projects: [
      { key: 'name', header: 'Nome do Projeto' },
      { key: 'status', header: 'Status' },
      { key: 'budget', header: 'Or\u00e7amento' },
      { key: 'deadline', header: 'Prazo' },
      { key: 'clientId', header: 'Cliente' },
      { key: 'createdAt', header: 'Data de Cria\u00e7\u00e3o' },
    ],
    participants: [
      { key: 'name', header: 'Nome' },
      { key: 'email', header: 'E-mail' },
      { key: 'category', header: 'Categoria' },
      { key: 'type', header: 'Tipo' },
      { key: 'projectId', header: 'Projeto' },
      { key: 'createdAt', header: 'Data de Cria\u00e7\u00e3o' },
    ],
  };

  availableTables = [
    { key: 'clients',      label: 'Clientes' },
    { key: 'projects',     label: 'Projetos' },
    { key: 'creditOrders', label: 'Pedidos de Cr\u00e9dito' },
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

    // Carregar projetos do viewer se for viewer
    if (this.userRole === 'viewer') {
      await this.loadViewerProjectIds();
    }

    if (this.userRole === 'admin_master') {
      await this.loadMasterData();
    } else {
      await this.loadClientData();
    }

    this.isLoading = false;
    this.cdr.markForCheck();
  }

  // â”€â”€ Master data loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    const activeProjects = projectsSnap.docs.filter(d => !['Cancelado', 'cancelado', 'Inativo'].includes(d.data()['status']));

    // assessmentLinks: completed já carregado, buscar pending também
    const completedParticipantIds = new Set(linksSnap.docs.map(d => d.data()['participantId'] as string));
    const pendingLinkSnap = await getDocs(query(collection(this.firestore, 'assessmentLinks'), where('status', '==', 'pending')));
    const pendingParticipantIds = new Set(pendingLinkSnap.docs.map(d => d.data()['participantId'] as string));
    // withInviteIds = quem tem qualquer link (completed ou pending)
    const withInviteIds = new Set([...completedParticipantIds, ...pendingParticipantIds]);

    const statsByProject = this.buildParticipantStats(participantsSnap.docs, completedParticipantIds, withInviteIds);

    // Projetos com pelo menos 1 participante com link = "com convites enviados" no funil
    // (buscamos pelo projectId dos participantes que tÃªm link)
    const invitedParticipantProjectIds = new Set(
      participantsSnap.docs
        .filter(d => withInviteIds.has(d.id))
        .map(d => d.data()['projectId'] as string)
    );

    // KPIs â€” pendentes = participantes com link pending
    const activeProjectsCount = this.countProjectsInProgress(projectsSnap.docs);
    this.masterKpis = [
      { value: clientsSnap.size,      label: this.translate.instant('kpi.clientes_ativos'), color: '#1B84FF', icon: 'business' },
      { value: activeProjectsCount,   label: this.translate.instant('kpi.projetos_ativos'), color: '#26c6da', icon: 'folder_open' },
    ];

    // Credits per client — 1 crédito por avaliado (fonte: participants.creditReserved / creditConsumed)
    const projectsNameMap = new Map(projectsSnap.docs.map(d => [d.id, fixMojibake((d.data()['name'] as string) || '—')]));
    const creditBreakdown = this.buildClientCreditBreakdown(participantsSnap.docs, projectsNameMap);

    this.clientCreditRows = clientsSnap.docs
      .map(d => {
        const breakdown = creditBreakdown.get(d.id) || {
          reservedTotal: 0,
          consumedTotal: 0,
          projects: [] as {
            projectId: string;
            projectName: string;
            reserved: number;
            consumed: number;
            orphan: boolean;
          }[],
        };

        return {
          clientId: d.id,
          clientName: fixMojibake((d.data()['companyName'] as string) || '—'),
          credits: (d.data()['credits'] as number) || 0,
          reservedCredits: breakdown.reservedTotal,
          creditsUsed: breakdown.consumedTotal,
          projects: breakdown.projects,
          expanded: false,
        };
      })
      .sort((a, b) => a.credits - b.credits); // menor disponível primeiro (mais crítico no topo)

    // Projects table
    this.projectRows = this.buildProjectRows(projectsSnap.docs, statsByProject, clientsMap, today);

    // Alerts
    this.alerts = this.buildAlerts(projectsSnap.docs, clientsSnap.docs, statsByProject, today);

    // Funil â€” dados base (todos os clientes)
    this.funnelAllProjects = projectsSnap.docs;
    this.funnelInvitedProjectIds = invitedParticipantProjectIds;
    this.funnelClientsMap = new Map(clientsSnap.docs.map(d => [d.id, fixMojibake((d.data()['companyName'] as string) || '')]));
    this.funnelClientOptions = [
      { id: 'all', name: 'Todos os clientes' },
      ...clientsSnap.docs.map(d => ({ id: d.id, name: fixMojibake((d.data()['companyName'] as string) || '—') })),
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
      client: fixMojibake(d.data()['companyName'] || ''),
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

  // ─── Client data loading ────────────────────────────────────────────────────────

  private async loadClientData(): Promise<void> {
    const isViewer = this.userRole === 'viewer';

    // Viewers may have no clientIds — they are linked to projects directly
    if (!isViewer && this.userClientIds.length === 0) return;
    if (isViewer && this.viewerProjectIds.size === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const clientDataMap = new Map<string, any>();
    let totalCredits = 0;
    let clientSnaps: any[] = [];

    if (!isViewer && this.userClientIds.length > 0) {
      clientSnaps = await Promise.all(
        this.userClientIds.map(id => getDoc(doc(this.firestore, 'clients', id)))
      );
      clientSnaps.forEach(snap => {
        if (snap.exists()) {
          clientDataMap.set(snap.id, snap.data());
          totalCredits += snap.data()['credits'] || 0;
        }
      });
      this.clientName = clientSnaps.length === 1
        ? (clientSnaps[0].exists() ? fixMojibake(clientSnaps[0].data()['companyName'] || '') : '')
        : `${clientSnaps.length} clientes`;
    }

    // Busca projetos, participantes e assessments
    let projectsSnap, participantsSnap, assessmentsSnap;

    if (isViewer) {
      const projectIds = Array.from(this.viewerProjectIds);
      [projectsSnap, participantsSnap, assessmentsSnap] = await Promise.all([
        getDocs(query(collection(this.firestore, 'projects'), where('__name__', 'in', projectIds))),
        getDocs(query(collection(this.firestore, 'participants'), where('projectId', 'in', projectIds))),
        getDocs(query(collection(this.firestore, 'assessments'), where('projectId', 'in', projectIds))),
      ]);
    } else {
      [projectsSnap, participantsSnap, assessmentsSnap] = await Promise.all([
        getDocs(query(collection(this.firestore, 'projects'), where('clientId', 'in', this.userClientIds))),
        getDocs(query(collection(this.firestore, 'participants'), where('clientId', 'in', this.userClientIds))),
        getDocs(query(collection(this.firestore, 'assessments'), where('clientId', 'in', this.userClientIds))),
      ]);
    }

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
    const activeProjects = projectsSnap.docs.filter(d => !['Cancelado', 'cancelado', 'Inativo'].includes(d.data()['status']));
    const statsByProject = this.buildParticipantStats(participantsSnap.docs, completedParticipantIds, withInviteIds);

    if (!isViewer) {
      const invitedProjectIds = new Set(
        participantsSnap.docs.filter(d => withInviteIds.has(d.id)).map(d => d.data()['projectId'] as string)
      );
      this.buildFunnelData(projectsSnap.docs, invitedProjectIds);
    }

    const activeProjectsCount = this.countProjectsInProgress(projectsSnap.docs);
    const totalParticipants = participantsSnap.docs.filter(d => d.data()['type'] === 'avaliado').length;

    this.clientKpis = [
      { value: activeProjectsCount, label: this.translate.instant('kpi.projetos_ativos'), color: '#1B84FF', icon: 'folder_open' },
      { value: totalParticipants,   label: this.translate.instant('kpi.participantes_ativos'), color: '#7c3aed', icon: 'groups' },
      ...(!isViewer ? [{ value: totalCredits, label: this.translate.instant('kpi.creditos_disponiveis'), color: '#4caf50', icon: 'toll' }] : []),
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
      client: fixMojibake(data['companyName'] || id),
      projects: activeProjects.filter(d => d.data()['clientId'] === id).length,
    }));

    this.assessmentsData = Array.from(clientDataMap.entries()).map(([id, data]) => ({
      client: fixMojibake(data['companyName'] || id),
      used: assessmentsSnap.docs.filter(d => d.data()['clientId'] === id).length,
      remaining: 0,
    }));

    this.totalActiveProjects = activeProjects.length;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────────

  /** Projetos ativos = em execução (Em andamento / Ativo), sem concluídos nem cancelados. */
  private countProjectsInProgress(projectDocs: { data: () => Record<string, unknown> }[]): number {
    return projectDocs.filter((d) => {
      const status = d.data()['status'] as string | undefined;
      if (status === 'Em andamento' || status === 'Ativo') return true;
      if (status === 'Concluído' || status === 'concluido') return false;
      if (status === 'Cancelado' || status === 'cancelado' || status === 'Inativo') return false;
      return true;
    }).length;
  }

  private buildClientCreditBreakdown(
    participantDocs: { data: () => Record<string, unknown> }[],
    projectsNameMap: Map<string, string>
  ): Map<string, {
    reservedTotal: number;
    consumedTotal: number;
    projects: {
      projectId: string;
      projectName: string;
      reserved: number;
      consumed: number;
      orphan: boolean;
    }[];
  }> {
    const byClient = new Map<string, Map<string, { reserved: number; consumed: number }>>();

    participantDocs.forEach((pDoc) => {
      const data = pDoc.data();
      if (data['type'] !== 'avaliado') return;

      const clientId = data['clientId'] as string;
      const projectId = data['projectId'] as string;
      if (!clientId || !projectId) return;

      const isConsumed = data['creditConsumed'] === true;
      const isReserved = data['creditReserved'] === true && !isConsumed;
      if (!isReserved && !isConsumed) return;

      if (!byClient.has(clientId)) {
        byClient.set(clientId, new Map());
      }
      const byProject = byClient.get(clientId)!;
      if (!byProject.has(projectId)) {
        byProject.set(projectId, { reserved: 0, consumed: 0 });
      }
      const entry = byProject.get(projectId)!;
      if (isConsumed) {
        entry.consumed++;
      } else {
        entry.reserved++;
      }
    });

    const result = new Map<string, {
      reservedTotal: number;
      consumedTotal: number;
      projects: {
        projectId: string;
        projectName: string;
        reserved: number;
        consumed: number;
        orphan: boolean;
      }[];
    }>();

    byClient.forEach((byProject, clientId) => {
      let reservedTotal = 0;
      let consumedTotal = 0;

      const projects = Array.from(byProject.entries())
        .map(([projectId, counts]) => {
          reservedTotal += counts.reserved;
          consumedTotal += counts.consumed;
          return {
            projectId,
            projectName: projectsNameMap.get(projectId) ?? 'Projeto não encontrado',
            reserved: counts.reserved,
            consumed: counts.consumed,
            orphan: !projectsNameMap.has(projectId),
          };
        })
        .filter((p) => p.reserved > 0 || p.consumed > 0)
        .sort((a, b) => a.projectName.localeCompare(b.projectName, 'pt-BR'));

      result.set(clientId, { reservedTotal, consumedTotal, projects });
    });

    return result;
  }

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
      .filter(d => !['Cancelado', 'cancelado', 'Inativo'].includes(d.data()['status']))
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
        if (data['status'] === 'Concluído' || data['status'] === 'concluido' || (stats.total > 0 && responseRate === 100)) {
          status = 'concluido';
        } else if (daysLeft < 0 && responseRate < 100) {
          status = 'atrasado';
        } else if (daysLeft >= 0 && daysLeft <= 7 && responseRate < 100) {
          status = 'em_risco';
        }

        return {
          id: d.id,
          name: fixMojibake(data['name'] || ''),
          clientId: data['clientId'] || '',
          clientName: fixMojibake(clientData?.['companyName'] || ''),
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
    const cMap = new Map(clientDocs.map(d => [d.id, fixMojibake(d.data()['companyName'] as string || '')]));
    const activeStatuses = ['Em andamento', 'Ativo']; // inclui legado

    // ðŸ”´ CrÃ­tico: prazo vencido com respostas pendentes
    projectDocs
      .filter(d => {
        const data = d.data();
        if (!activeStatuses.includes(data['status'])) return false;
        const deadline = data['deadline'] ? new Date(data['deadline'].seconds * 1000) : null;
        if (!deadline) return false;
        const days = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
        if (days >= 0) return false; // nÃ£o vencido
        const stats = statsByProject.get(d.id);
        const rate = stats && stats.total > 0 ? (stats.responded / stats.total) * 100 : 0;
        return rate < 100; // ainda tem pendÃªncias
      })
      .forEach(d => {
        const data = d.data();
        const stats = statsByProject.get(d.id);
        const rate = stats && stats.total > 0 ? Math.round((stats.responded / stats.total) * 100) : 0;
        const overdue = Math.abs(Math.ceil((new Date(data['deadline'].seconds * 1000).getTime() - today.getTime()) / 86400000));
        alerts.push({
          level: 'danger',
          category: this.translate.instant('alert.prazo_vencido'),
          clientName: cMap.get(data['clientId']) || '',
          title: fixMojibake(data['name'] || ''),
          description: this.translate.instant('alert.vencido_descricao', { days: overdue, rate: rate }),
          route: `/projects/${d.id}/edit`,
        });
      });

    // ðŸŸ  AtenÃ§Ã£o: prazo em â‰¤ 7 dias com respostas incompletas
    projectDocs
      .filter(d => {
        const data = d.data();
        if (!activeStatuses.includes(data['status'])) return false;
        const deadline = data['deadline'] ? new Date(data['deadline'].seconds * 1000) : null;
        if (!deadline) return false;
        const days = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
        if (days < 0 || days > 7) return false; // jÃ¡ vencido ou folga suficiente
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
          category: this.translate.instant('alert.prazo_proximo'),
          clientName: cMap.get(data['clientId']) || '',
          title: fixMojibake(data['name'] || ''),
          description: this.translate.instant('alert.proximo_descricao', { days: days, pending: pending, rate: rate }),
          route: `/projects/${d.id}/edit`,
        });
      });

    // ðŸ”µ Aviso: cliente sem crÃ©ditos
    clientDocs
      .filter(d => (d.data()['credits'] || 0) === 0)
      .forEach(d => {
        alerts.push({
          level: 'info',
          category: this.translate.instant('alert.sem_creditos'),
          clientName: fixMojibake(d.data()['companyName'] || ''),
          title: fixMojibake(d.data()['companyName'] || ''),
          description: this.translate.instant('alert.creditos_esgotados'),
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

    const labels = Array.from(byCategory.keys()).map((cat) =>
      translateParticipantCategory(this.translate, cat)
    );
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
    const statusKeys = ['Ativos', 'Concluído', 'Cancelado'] as const;
    const counts: Record<(typeof statusKeys)[number], number> = { Ativos: 0, 'Concluído': 0, Cancelado: 0 };
    projectDocs.forEach(d => {
      const s = d.data()['status'];
      if (s === 'Em andamento' || s === 'Ativo') counts['Ativos']++;
      else if (s === 'Concluído' || s === 'concluido') counts['Concluído']++;
      else if (s === 'Cancelado' || s === 'cancelado' || s === 'Inativo') counts['Cancelado']++;
      else counts['Ativos']++;
    });

    const labels = statusKeys.map((key) => {
      if (key === 'Ativos') return this.translate.instant('Ativos');
      return this.translate.instant(key);
    });
    const values = statusKeys.map((key) => counts[key]);
    const colors = ['#1B84FF', '#4caf50', '#fc4b6c'];

    this.projectsByStatusChart = {
      series: [{ name: this.translate.instant('Projetos'), data: values }],
      chart: { type: 'bar', height: 220, toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
      plotOptions: { bar: { horizontal: false, columnWidth: '40%', borderRadius: 6, borderRadiusApplication: 'end', distributed: true } },
      colors,
      dataLabels: { enabled: true, formatter: (val: number) => val > 0 ? String(val) : '', style: { fontSize: '13px', fontFamily: 'Poppins', colors: ['#374151'] }, offsetY: -6 },
      xaxis: { categories: labels, labels: { style: { fontSize: '12px', fontFamily: 'Poppins' } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { show: true, min: 0, tickAmount: 3, labels: { style: { fontSize: '11px' } } },
      grid: { borderColor: '#f1f5f9', yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } } },
      legend: { show: false },
      tooltip: {
        theme: 'light',
        y: {
          formatter: (val: number) => {
            const word = val === 1 ? this.translate.instant('projeto') : this.translate.instant('projetos');
            return `${val} ${word}`;
          },
        },
      },
    };
  }

  buildFunnelData(projectDocs: any[], _invitedProjectIds: Set<string>, clientFilter = 'all'): void {
    const filtered = clientFilter === 'all'
      ? projectDocs
      : projectDocs.filter(d => d.data()['clientId'] === clientFilter);

    const eligible = filtered.filter(
      d => !['Cancelado', 'cancelado', 'Inativo'].includes(d.data()['status'] as string)
    );
    const completed = eligible.filter(
      d => ['Concluído', 'concluido'].includes(d.data()['status'] as string)
    ).length;
    const active = this.countProjectsInProgress(eligible);

    this.funnelData = {
      total: eligible.length,
      active,
      completed,
    };
  }

  onFunnelClientFilter(clientId: string): void {
    this.funnelClientFilter = clientId;
    this.buildFunnelData(this.funnelAllProjects, this.funnelInvitedProjectIds, clientId);
  }

  // â”€â”€ Template helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  statusLabel(status: ProjectStatus): string {
    const map: Record<ProjectStatus, string> = {
      em_andamento: 'Em andamento',
      em_risco: 'Em risco',
      atrasado: 'Atrasado',
      concluido: 'Concluído',
    };
    return this.translate.instant(map[status]);
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
    if (!row.deadline) return '\u2014';
    const locale = this.translate.currentLang?.startsWith('en') ? 'en-US' : 'pt-BR';
    if (row.status === 'concluido') return row.deadline.toLocaleDateString(locale);
    if (row.daysUntilDeadline < 0) {
      return `${Math.abs(row.daysUntilDeadline)}${this.translate.instant('d atrasado')}`;
    }
    if (row.daysUntilDeadline === 0) return this.translate.instant('Hoje');
    if (row.daysUntilDeadline <= 7) {
      return `${row.daysUntilDeadline}${this.translate.instant('d restante(s)')}`;
    }
    return row.deadline.toLocaleDateString(locale);
  }

  deadlineClass(row: ProjectRow): string {
    if (!row.deadline || row.status === 'concluido') return '';
    if (row.daysUntilDeadline < 0) return 'deadline--overdue';
    if (row.daysUntilDeadline <= 3) return 'deadline--critical';
    if (row.daysUntilDeadline <= 7) return 'deadline--warning';
    return '';
  }

  // â”€â”€ Exports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  private async loadViewerProjectIds(): Promise<void> {
    this.viewerProjectIds.clear();
    const email = await this.authService.getCurrentUserEmail();
    if (!email) return;

    const usersSnap = await getDocs(
      query(collection(this.firestore, 'users'), where('email', '==', email))
    );

    if (usersSnap.empty) return;

    const userData = usersSnap.docs[0].data();
    const fromArray = Array.isArray(userData['projects']) ? userData['projects'] : [];
    const fromSingle = userData['project'] ? [userData['project']] : [];

    [...fromArray, ...fromSingle].forEach((projectId) => this.viewerProjectIds.add(projectId));
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
