import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  AppBandwidthUsageComponent,
  AppCurrentVisitsComponent,
  AppDownloadCountComponent,
  AppFavouriteContactsComponent,
  AppFeedsComponent,
  AppNewsletterCampaign2Component,
  AppPieCardsComponent,
  AppProfileCardComponent,
  AppProjectDataComponent,
  AppRecentCommentsComponent,
  AppSalesOverview2Component,
  AppTodoListComponent,
} from 'src/app/components';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';
import { MaterialModule } from 'src/app/material.module';
import { ExportDialogComponent } from './export-dialog/export-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-dashboard3',
  standalone: true,
  imports: [
    MaterialModule,
    AppPieCardsComponent,
    AppSalesOverview2Component,
    AppCurrentVisitsComponent,
    AppProjectDataComponent,
    AppProfileCardComponent,
    AppBandwidthUsageComponent,
    AppDownloadCountComponent,
    AppFavouriteContactsComponent,
    AppFeedsComponent,
    AppRecentCommentsComponent,
    AppTodoListComponent,
    AppNewsletterCampaign2Component,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  constructor(private dialog: MatDialog, private cdr: ChangeDetectorRef) {}

  pieCardsData: { value: number; label: string; color: string }[] = [];
  totalEvaluatedParticipants: number = 0;
  activeProjects: number = 0;
  totalCredits: number = 0;
  creditOrdersData: { date: string; credits: number }[] = [];
  creditUsageData: { month: string; used: number; remaining: number }[] = [];

  private firestore = inject(Firestore);

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
    users: [
      { key: 'name', header: 'Nome' },
      { key: 'surname', header: 'Sobrenome' },
      { key: 'email', header: 'E-mail' },
      { key: 'role', header: 'Papel' },
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
  assessmentsData: { client: string; used: number; remaining: number }[] = [];

  projectsByClientData: { client: string; projects: number }[] = [];
  totalActiveProjects: number = 0;

  availableTables = [
    { key: 'clients', label: 'Clientes' },
    { key: 'projects', label: 'Projetos' },
    { key: 'creditOrders', label: 'Pedidos de Crédito' },
    { key: 'participants', label: 'Participantes' },
  ];

  async ngOnInit(): Promise<void> {
    // Teste de collections
    const col = collection(this.firestore, 'users');

    const snap = await getDocs(col);

    
    const data = await this.fetchDashboardData();
    this.creditOrdersData = await this.fetchCreditOrdersData();
    this.assessmentsData = await this.fetchAssessmentsData();
    
    this.cdr.detectChanges();
    // await this.fetchProjectsByClient();
    // Dados para os gráficos de pizza
    this.pieCardsData = [
      { value: data.totalClients, label: 'Clientes', color: '#1e88e5' },
      {
        value: data.totalActiveProjects,
        label: 'Projetos Ativos',
        color: '#26c6da',
      },
      {
        value: data.totalEvaluatedParticipants,
        label: 'Avaliados',
        color: '#fc4b6c',
      },
      {
        value: data.totalCreditOrders,
        label: 'Pedidos de Crédito',
        color: '#ffb22b',
      },
      {
        value: data.totalRemainingCredits,
        label: 'Créditos Remanescentes',
        color: '#4caf50',
      }, // Novo KPI!
    ];

    // Dados vazios (placeholder)
    this.creditUsageData = [
      { month: 'Jan', used: 0, remaining: 0 },
      { month: 'Feb', used: 0, remaining: 0 },
      { month: 'Mar', used: 0, remaining: 0 },
      { month: 'Apr', used: 0, remaining: 0 },
      { month: 'May', used: 0, remaining: 0 },
    ];

    // Outras métricas do dashboard
    this.totalEvaluatedParticipants = data.totalEvaluatedParticipants;
    this.activeProjects = data.totalProjects;
    this.totalCredits = data.totalCredits;
  }

  private async fetchAssessmentsData(): Promise<
    { client: string; used: number; remaining: number }[]
  > {
    const assessmentsCollection = collection(this.firestore, 'assessments');
    const clientsCollection = collection(this.firestore, 'clients');

    const assessmentsSnapshot = await getDocs(assessmentsCollection);
    const clientsSnapshot = await getDocs(clientsCollection);

    // Criar um mapa para associar clientId ao nome do cliente
    const clientMap = new Map(
      clientsSnapshot.docs.map((doc) => [doc.id, doc.data()['companyName']])
    );

    // Criar um mapa para contar avaliações por cliente
    const assessmentsByClient = new Map<string, number>();

    assessmentsSnapshot.docs.forEach((doc) => {
      const clientId = doc.data()['clientId'];
      if (clientId) {
        assessmentsByClient.set(
          clientId,
          (assessmentsByClient.get(clientId) || 0) + 1
        );
      }
    });

    // Transformar os dados para o formato esperado
    return Array.from(assessmentsByClient.entries()).map(
      ([clientId, count]) => ({
        client: clientMap.get(clientId) || 'Desconhecido',
        used: count, // Número de avaliações cadastradas por cliente
        remaining: 0, // Não usado aqui, mas mantido para compatibilidade com o gráfico
      })
    );
  }

  async generatePDF(): Promise<void> {
    const dashboardElement = document.getElementById('dashboard-content');

    if (!dashboardElement) {
      console.error('Elemento do dashboard não encontrado.');
      return;
    }

    const canvas = await html2canvas(dashboardElement, {
      scrollY: -window.scrollY,
    });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210; // Largura da página A4 em mm
    const pageHeight = 297; // Altura da página A4 em mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let position = 0;

    if (imgHeight > pageHeight) {
      // Adicionar paginação, caso necessário
      while (position < imgHeight) {
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, pageHeight);
        position += pageHeight;

        if (position < imgHeight) {
          pdf.addPage();
        }
      }
    } else {
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    }

    pdf.save('dashboard.pdf');
  }

  private async fetchCreditOrdersData(): Promise<
    { date: string; credits: number }[]
  > {
    const creditOrdersCollection = collection(this.firestore, 'creditOrders');
    const snapshot = await getDocs(creditOrdersCollection);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        date: new Date(data['startDate'].seconds * 1000).toLocaleDateString(),
        credits: data['credits'] || 0,
      };
    });
  }

  private async fetchDashboardData(): Promise<any> {
    const clientsCollection = collection(this.firestore, 'clients');
    const projectsCollection = collection(this.firestore, 'projects');
    const creditOrdersCollection = collection(this.firestore, 'creditOrders');
    const participantsCollection = collection(this.firestore, 'participants');

    const clientsSnapshot = await getDocs(clientsCollection);
    const projectsSnapshot = await getDocs(projectsCollection);
    const creditOrdersSnapshot = await getDocs(creditOrdersCollection);
    const participantsSnapshot = await getDocs(participantsCollection);

    const evaluatedParticipants = participantsSnapshot.docs.filter(
      (doc) => doc.data()['type'] === 'avaliado'
    ).length;

    const totalCredits = clientsSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data['credits'] || 0);
    }, 0);

    const activeProjects = projectsSnapshot.docs.filter(
      (doc) => doc.data()['status'] === 'Ativo'
    );

    // Criar um mapa de clientes para contar projetos ativos
    const projectCountByClient = new Map<string, number>();

    activeProjects.forEach((doc) => {
      const clientId = doc.data()['clientId'];
      if (clientId) {
        projectCountByClient.set(
          clientId,
          (projectCountByClient.get(clientId) || 0) + 1
        );
      }
    });

    // Transformar os dados para incluir o nome dos clientes e corrigir os nomes das propriedades
    this.projectsByClientData = clientsSnapshot.docs.map((doc) => ({
      client: doc.data()['companyName'], // Nome do cliente
      projects: projectCountByClient.get(doc.id) || 0, // Número de projetos ativos do cliente
    }));

    this.totalActiveProjects = activeProjects.length;

    let remainingCredits = 0;
    clientsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const credits = data['credits'] || 0;
      const validityDate = data['validityDate']
        ? new Date(data['validityDate'].seconds * 1000)
        : null;
      const today = new Date();

      // Apenas créditos não expirados são somados
      if (!validityDate || validityDate > today) {
        remainingCredits += credits;
      }
    });

    return {
      totalClients: clientsSnapshot.size || 0,
      totalProjects: activeProjects || 0,
      totalCreditOrders: creditOrdersSnapshot.size || 0,
      totalEvaluatedParticipants: evaluatedParticipants || 0,
      totalCredits,
      totalRemainingCredits: remainingCredits,
      totalActiveProjects: this.totalActiveProjects,
    };
  }

  openExportDialog(): void {
    const dialogRef = this.dialog.open(ExportDialogComponent, {
      width: '400px',
      data: { availableTables: this.availableTables },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const { selectedTable, selectedFormat } = result;

        if (selectedFormat === 'excel') {
          await this.exportToExcel(selectedTable.key, selectedTable.label);
        } else if (selectedFormat === 'pdf') {
          await this.exportToPDF(selectedTable.key, selectedTable.label);
        }
      }
    });
  }

  // Função para exportar dados para Excel
  private async exportToExcel(
    tableKey: string,
    tableLabel: string
  ): Promise<void> {
    const data = await this.getFormattedData(tableKey);
    const headers = this.headersMap[tableKey] || [];

    // Importar e configurar ExcelJS
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(tableLabel);

    // Adicionar cabeçalhos com estilos
    const headerRow = worksheet.addRow(headers.map(({ header }) => header));
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4CAF50' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Adicionar dados
    data.forEach((row) => {
      const dataRow = worksheet.addRow(
        headers.map(({ key }) => row[key] || '')
      );
      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Ajustar largura das colunas
    worksheet.columns = headers.map(() => ({ width: 20 }));

    // Salvar arquivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tableLabel}.xlsx`;
    link.click();
  }

  // Função para exportar dados para PDF
  private async exportToPDF(
    tableKey: string,
    tableLabel: string
  ): Promise<void> {
    const data = await this.getFormattedData(tableKey);
    const headers = this.headersMap[tableKey] || [];

    // Importar jsPDF e autoTable
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF();

    // Adicionar título
    doc.setFontSize(18);
    doc.text(`${tableLabel}`, 14, 20);

    // Configurar autoTable
    autoTable(doc, {
      startY: 30,
      head: [headers.map(({ header }) => header)],
      body: data.map((row) => headers.map(({ key }) => row[key] || '')),
      theme: 'grid',
      headStyles: {
        fillColor: [76, 175, 80],
        textColor: 255,
        fontStyle: 'bold',
      },
      bodyStyles: { textColor: 50 },
      styles: { cellPadding: 3, fontSize: 10 },
    });

    // Salvar arquivo
    doc.save(`${tableLabel}.pdf`);
  }

  private formatDate(timestamp: any): string {
    if (!timestamp || !timestamp.seconds) return ''; // Se for indefinido, retorna vazio
    const date = new Date(timestamp.seconds * 1000);
    return isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
  }

  private async getFormattedData(tableKey: string): Promise<any[]> {
    const collectionRef = collection(this.firestore, tableKey);
    const snapshot = await getDocs(collectionRef);
    let data = snapshot.docs.map((doc) => ({ ...doc.data() }));

    // Buscar nomes de clientes e projetos para substituição
    const clientsSnapshot = await getDocs(
      collection(this.firestore, 'clients')
    );
    const clientsMap = new Map(
      clientsSnapshot.docs.map((doc) => [doc.id, doc.data()['companyName']])
    );

    const projectsSnapshot = await getDocs(
      collection(this.firestore, 'projects')
    );
    const projectsMap = new Map(
      projectsSnapshot.docs.map((doc) => [doc.id, doc.data()['name']])
    );

    // Substituir clientId, projectId e tratar datas corretamente
    return data.map((item: any) => ({
      ...item,
      clientId: item.clientId
        ? clientsMap.get(item.clientId) || 'Desconhecido'
        : '',
      projectId: item.projectId
        ? projectsMap.get(item.projectId) || 'Desconhecido'
        : '',
      createdAt: this.formatDate(item.createdAt),
      startDate: this.formatDate(item.startDate),
      validityDate: this.formatDate(item.validityDate),
      deadline: this.formatDate(item.deadline),
    }));
  }
}
