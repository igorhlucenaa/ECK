import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
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
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { ExportDialogComponent } from './export-dialog/export-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-dashboard3',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
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

  userRole: string | null = null;
  clientId: string | null = null;

  pieCardsData: { value: number; label: string; color: string; icon: string }[] = [];
  assessmentsData: { client: string; used: number; remaining: number }[] = [];
  projectsByClientData: { client: string; projects: number }[] = [];
  participantsByCategoryChart: any = null;
  totalActiveProjects = 0;

  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private translate = inject(TranslateService);

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
    this.clientId  = await this.authService.getCurrentClientId();

    const data = await this.fetchDashboardData();
    this.assessmentsData = await this.fetchAssessmentsData();
    await this.buildParticipantsByCategoryChart();

    this.pieCardsData = [
      { value: data.totalClients,              label: this.translate.instant('Clientes'),             color: '#1B84FF', icon: 'business' },
      { value: data.totalActiveProjects,       label: this.translate.instant('Projetos Ativos'),      color: '#26c6da', icon: 'folder_open' },
      { value: data.totalAssessments,          label: this.translate.instant('Avaliações'),           color: '#7c3aed', icon: 'assignment_turned_in' },
      { value: data.totalEvaluatedParticipants,label: this.translate.instant('Avaliados'),            color: '#fc4b6c', icon: 'groups' },
      { value: data.totalCreditOrders,         label: this.translate.instant('Pedidos de Crédito'),   color: '#ffb22b', icon: 'receipt_long' },
      { value: data.totalRemainingCredits,     label: this.translate.instant('Créditos Disponíveis'), color: '#4caf50', icon: 'toll' },
    ];

    this.cdr.markForCheck();
  }

  // ── Data loading ──────────────────────────────────────────────

  private async fetchDashboardData(): Promise<any> {
    const clientsCol      = collection(this.firestore, 'clients');
    const projectsCol     = collection(this.firestore, 'projects');
    const creditOrdersCol = collection(this.firestore, 'creditOrders');
    const participantsCol = collection(this.firestore, 'participants');
    const assessmentsCol  = collection(this.firestore, 'assessments');

    const isClient = this.userRole === 'admin_client' && this.clientId;

    const projectsQ     = isClient ? query(projectsCol,     where('clientId', '==', this.clientId)) : projectsCol;
    const participantsQ = isClient ? query(participantsCol, where('clientId', '==', this.clientId)) : participantsCol;
    const assessmentsQ  = isClient ? query(assessmentsCol,  where('clientId', '==', this.clientId)) : assessmentsCol;

    const [clientsSnap, projectsSnap, creditSnap, participantsSnap, assessmentsSnap] = await Promise.all([
      getDocs(clientsCol),
      getDocs(projectsQ),
      getDocs(creditOrdersCol),
      getDocs(participantsQ),
      getDocs(assessmentsQ),
    ]);

    const evaluatedParticipants = participantsSnap.docs.filter(d => d.data()['type'] === 'avaliado').length;
    const totalCredits = clientsSnap.docs.reduce((s, d) => s + (d.data()['credits'] || 0), 0);
    const activeProjects = projectsSnap.docs.filter(d => d.data()['status'] === 'Ativo');

    const projectCountByClient = new Map<string, number>();
    activeProjects.forEach(d => {
      const id = d.data()['clientId'];
      if (id) projectCountByClient.set(id, (projectCountByClient.get(id) || 0) + 1);
    });

    this.projectsByClientData = clientsSnap.docs.map(d => ({
      client:   d.data()['companyName'],
      projects: projectCountByClient.get(d.id) || 0,
    }));

    this.totalActiveProjects = activeProjects.length;

    let remainingCredits = 0;
    const today = new Date();
    clientsSnap.docs.forEach(d => {
      const data = d.data();
      const validityDate = data['validityDate'] ? new Date(data['validityDate'].seconds * 1000) : null;
      if (!validityDate || validityDate > today) remainingCredits += (data['credits'] || 0);
    });

    return {
      totalClients: clientsSnap.size,
      totalActiveProjects: this.totalActiveProjects,
      totalProjects: activeProjects,
      totalCreditOrders: creditSnap.size,
      totalEvaluatedParticipants: evaluatedParticipants,
      totalCredits,
      totalRemainingCredits: remainingCredits,
      totalAssessments: assessmentsSnap.size,
    };
  }

  private async fetchAssessmentsData(): Promise<{ client: string; used: number; remaining: number }[]> {
    const assessmentsCol = collection(this.firestore, 'assessments');
    const isClient = this.userRole === 'admin_client' && this.clientId;
    const q = isClient ? query(assessmentsCol, where('clientId', '==', this.clientId)) : assessmentsCol;

    const [assessmentsSnap, clientsSnap] = await Promise.all([
      getDocs(q),
      getDocs(collection(this.firestore, 'clients')),
    ]);

    const clientMap = new Map(clientsSnap.docs.map(d => [d.id, d.data()['companyName']]));
    const byClient = new Map<string, number>();
    assessmentsSnap.docs.forEach(d => {
      const id = d.data()['clientId'];
      if (id) byClient.set(id, (byClient.get(id) || 0) + 1);
    });

    return Array.from(byClient.entries()).map(([id, count]) => ({
      client: clientMap.get(id) || 'Desconhecido',
      used: count,
      remaining: 0,
    }));
  }

  private async buildParticipantsByCategoryChart(): Promise<void> {
    const participantsCol = collection(this.firestore, 'participants');
    const isClient = this.userRole === 'admin_client' && this.clientId;
    const q = isClient ? query(participantsCol, where('clientId', '==', this.clientId)) : participantsCol;

    const snap = await getDocs(q);
    const byCategory = new Map<string, number>();

    snap.docs.forEach(d => {
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

  // ── Exports ───────────────────────────────────────────────────

  async generatePDF(): Promise<void> {
    if (this.isExporting) return;
    this.isExporting = true;
    this.exportLabel = this.translate.instant('Exportando dashboard...');
    this.cdr.markForCheck();

    const el = document.getElementById('dashboard-content');
    if (!el) {
      this.snackBar.open(this.translate.instant('Elemento do dashboard não encontrado.'), this.translate.instant('Fechar'), { duration: 3000 });
      this.isExporting = false;
      this.exportLabel = '';
      this.cdr.markForCheck();
      return;
    }

    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');
      const canvas = await html2canvas(el, { scrollY: -window.scrollY, scale: 1.5, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let position = 0;

      if (imgHeight > pageHeight) {
        while (position < imgHeight) {
          pdf.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight);
          position += pageHeight;
          if (position < imgHeight) pdf.addPage();
        }
      } else {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      }

      pdf.save('dashboard.pdf');
      this.snackBar.open(this.translate.instant('Dashboard exportado com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
    } catch (err) {
      console.error(err);
      this.snackBar.open(this.translate.instant('Erro ao exportar o dashboard.'), this.translate.instant('Fechar'), { duration: 4000 });
    } finally {
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
