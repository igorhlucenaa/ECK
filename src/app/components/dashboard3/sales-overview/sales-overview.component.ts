import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
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

export interface SalesOverviewChart {
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
  selector: 'app-sales-overview2',
  standalone: true,
  imports: [NgApexchartsModule, MaterialModule, CommonModule, TranslateModule],
  templateUrl: './sales-overview.component.html',
})
export class AppSalesOverview2Component implements OnChanges {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  // Alterado para receber projetos ativos por cliente
  @Input() projectsByClientData!: { client: string; projects: number }[];

  public salesoverChart!: Partial<SalesOverviewChart>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['projectsByClientData']) {
      this.updateChart();
    }
  }

  private updateChart(): void {
    // Filtra clientes sem projetos e ordena do maior para o menor
    const sorted = [...this.projectsByClientData]
      .filter(d => d.projects > 0)
      .sort((a, b) => b.projects - a.projects);

    if (sorted.length === 0) return;

    const clients  = sorted.map(d => d.client);
    const projects = sorted.map(d => d.projects);
    const maxVal   = Math.max(...projects);

    this.salesoverChart = {
      series: [{ name: 'Projetos Ativos', data: projects }],
      chart: {
        type: 'bar',
        // Altura dinâmica: cada cliente ocupa ~36px, mínimo 200px
        height: Math.max(200, clients.length * 36 + 60),
        toolbar: { show: false },
        foreColor: '#64748b',
        fontFamily: 'Poppins, sans-serif',
      },
      plotOptions: {
        bar: {
          horizontal: true,   // Horizontal: nomes de clientes ficam legíveis
          barHeight: '60%',
          borderRadius: 4,
          dataLabels: { position: 'right' },
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => String(val),
        style: { fontSize: '12px', fontFamily: 'Poppins', colors: ['#374151'] },
        offsetX: 8,
      },
      xaxis: {
        categories: clients,
        labels: {
          style: { fontSize: '12px', fontFamily: 'Poppins' },
        },
        max: maxVal + 1,  // Folga para o data label não cortar
      },
      yaxis: {
        labels: {
          style: { fontSize: '12px', fontFamily: 'Poppins', colors: ['#374151'] },
          maxWidth: 140,
        },
      },
      grid: {
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: false } },
        borderColor: '#f1f5f9',
      },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'horizontal',
          gradientToColors: ['#1B84FF'],
          stops: [0, 100],
        },
        colors: ['#26c6da'],
      },
      legend: { show: false },
      tooltip: {
        theme: 'light',
        y: { formatter: (val: number) => `${val} projeto${val !== 1 ? 's' : ''}` },
      },
    };
  }
}
