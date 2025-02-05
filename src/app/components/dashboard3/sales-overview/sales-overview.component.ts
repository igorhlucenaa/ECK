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
  imports: [NgApexchartsModule, MaterialModule, CommonModule],
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
    const clients = this.projectsByClientData.map((data) => data.client);
    const projects = this.projectsByClientData.map((data) => data.projects);

    this.salesoverChart = {
      series: [
        {
          name: 'Projetos Ativos',
          data: projects,
        },
      ],
      chart: {
        type: 'bar',
        height: 280,
        toolbar: { show: false },
        foreColor: '#adb0bb',
        fontFamily: 'Poppins',
        sparkline: { enabled: false },
      },
      grid: {
        show: true,
      },
      plotOptions: {
        bar: { horizontal: false, columnWidth: '35%', borderRadius: 5 },
      },
      dataLabels: {
        enabled: false,
      },
      xaxis: {
        type: 'category',
        categories: clients, // Agora exibe os clientes
      },
      yaxis: {
        show: true,
        min: 0,
        tickAmount: 5,
      },
      stroke: {
        show: true,
        width: 2,
        colors: ['transparent'],
      },
      legend: {
        show: true,
        position: 'top',
      },
      fill: {
        colors: ['#26c6da'],
        opacity: 1,
      },
      tooltip: {
        theme: 'dark',
      },
    };
  }
}
