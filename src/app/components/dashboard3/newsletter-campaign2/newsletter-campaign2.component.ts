import { CommonModule } from '@angular/common';
import {
  Component,
  ViewChild,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import {
  ApexChart,
  ChartComponent,
  ApexDataLabels,
  ApexLegend,
  ApexStroke,
  ApexTooltip,
  ApexAxisChartSeries,
  ApexXAxis,
  ApexYAxis,
  ApexGrid,
  ApexPlotOptions,
  ApexFill,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { MaterialModule } from 'src/app/material.module';
import { TranslateModule } from '@ngx-translate/core';

export interface AssessmentsChart {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  yaxis: ApexYAxis;
  xaxis: ApexXAxis;
  fill: ApexFill;
  tooltip: ApexTooltip;
  stroke: ApexStroke;
  legend: ApexLegend;
  grid: ApexGrid;
}

@Component({
  selector: 'app-newsletter-campaign2',
  standalone: true,
  imports: [NgApexchartsModule, MaterialModule, CommonModule, TranslateModule],
  templateUrl: './newsletter-campaign2.component.html',
})
export class AppNewsletterCampaign2Component implements OnChanges {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  @Input() creditUsageData: { client: string; used: number; remaining: number }[] = [];
  @Input() projectsData: { client: string; projects: number }[] = [];

  public assessmentsChart!: Partial<AssessmentsChart>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['creditUsageData'] || changes['projectsData']) {
      this.updateChart();
    }
  }

  private updateChart(): void {
    if (!this.creditUsageData?.length && !this.projectsData?.length) return;

    // Une todos os clientes presentes em qualquer dataset
    const allClients = Array.from(new Set([
      ...this.creditUsageData.map(d => d.client),
      ...this.projectsData.map(d => d.client),
    ])).sort();

    const avaliacoesMap = new Map(this.creditUsageData.map(d => [d.client, d.used]));
    const projetosMap   = new Map(this.projectsData.map(d => [d.client, d.projects]));

    const avaliacoes = allClients.map(c => avaliacoesMap.get(c) ?? 0);
    const projetos   = allClients.map(c => projetosMap.get(c) ?? 0);

    // Abreviação de nomes longos de clientes para o eixo X
    const labels = allClients.map(c => c.length > 14 ? c.slice(0, 13) + '…' : c);

    this.assessmentsChart = {
      series: [
        { name: 'Avaliações', data: avaliacoes },
        { name: 'Projetos Ativos', data: projetos },
      ],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: false },
        foreColor: '#64748b',
        fontFamily: 'Poppins, sans-serif',
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '55%',
          borderRadius: 4,
          borderRadiusApplication: 'end',
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => val > 0 ? String(val) : '',
        style: { fontSize: '11px', fontFamily: 'Poppins', colors: ['#374151'] },
        offsetY: -6,
      },
      xaxis: {
        categories: labels,
        labels: {
          style: { fontSize: '11px', fontFamily: 'Poppins' },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        show: true,
        min: 0,
        tickAmount: 4,
        labels: { style: { fontSize: '11px', fontFamily: 'Poppins' } },
      },
      grid: {
        borderColor: '#f1f5f9',
        yaxis: { lines: { show: true } },
        xaxis: { lines: { show: false } },
      },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'right',
        fontSize: '12px',
        fontFamily: 'Poppins',
        markers: { strokeWidth: 0 },
      },
      fill: {
        colors: ['#7c3aed', '#26c6da'],
        opacity: 1,
      },
      tooltip: {
        theme: 'light',
        shared: true,
        intersect: false,
        y: { formatter: (val: number, opts: any) => {
          const name = opts?.seriesIndex === 0 ? 'avaliação' : 'projeto';
          return `${val} ${name}${val !== 1 ? 's' : ''}`;
        }},
      },
    };
  }
}
