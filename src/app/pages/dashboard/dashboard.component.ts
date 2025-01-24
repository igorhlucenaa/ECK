import { Component, inject, OnInit } from '@angular/core';
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
  pieCardsData: { value: number; label: string; color: string }[] = [];
  totalEvaluatedParticipants: number = 0;
  activeProjects: number = 0;
  totalCredits: number = 0;
  creditOrdersData: { date: string; credits: number }[] = [];
  creditUsageData: { month: string; used: number; remaining: number }[] = [];

  private firestore = inject(Firestore);

  async ngOnInit(): Promise<void> {
    const data = await this.fetchDashboardData();
    this.creditOrdersData = await this.fetchCreditOrdersData();
    // Dados para os gráficos de pizza
    this.pieCardsData = [
      { value: data.totalClients, label: 'Clientes', color: '#1e88e5' },
      { value: data.totalProjects, label: 'Projetos Ativos', color: '#26c6da' },
      {
        value: data.totalCreditOrders,
        label: 'Pedidos de Crédito',
        color: '#ffb22b',
      },
      {
        value: data.totalEvaluatedParticipants,
        label: 'Avaliados',
        color: '#fc4b6c',
      },
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

    const activeProjects = projectsSnapshot.docs.filter(
      (doc) => doc.data()['status'] === 'Ativo'
    ).length;

    const evaluatedParticipants = participantsSnapshot.docs.filter(
      (doc) => doc.data()['type'] === 'avaliado'
    ).length;

    const totalCredits = clientsSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data['credits'] || 0);
    }, 0);

    return {
      totalClients: clientsSnapshot.size || 0,
      totalProjects: activeProjects || 0,
      totalCreditOrders: creditOrdersSnapshot.size || 0,
      totalEvaluatedParticipants: evaluatedParticipants || 0,
      totalCredits,
    };
  }
}
