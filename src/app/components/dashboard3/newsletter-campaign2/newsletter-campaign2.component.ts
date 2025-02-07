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
  imports: [NgApexchartsModule, MaterialModule, CommonModule],
  templateUrl: './newsletter-campaign2.component.html',
})
export class AppNewsletterCampaign2Component implements OnChanges {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  @Input() creditUsageData: {
    client: string;
    used: number;
    remaining: number;
  }[] = [];

  public assessmentsChart!: Partial<AssessmentsChart>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['creditUsageData'] && changes['creditUsageData'].currentValue) {
      this.updateChart();
    }
  }

  private updateChart(): void {
    if (!this.creditUsageData || this.creditUsageData.length === 0) {
      console.warn('Nenhum dado disponível para o gráfico.');
      return;
    }

    const clientNames = this.creditUsageData.map((data) => data.client);
    const assessmentsCounts = this.creditUsageData.map((data) => data.used);

    console.log('Clientes:', clientNames);
    console.log('Avaliações cadastradas:', assessmentsCounts);

    this.assessmentsChart = {
      series: [
        {
          name: 'Avaliações Cadastradas',
          data: assessmentsCounts,
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
        categories: clientNames,
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
        colors: ['#1e88e5'],
        opacity: 1,
      },
      tooltip: {
        theme: 'dark',
      },
    };
  }
}
