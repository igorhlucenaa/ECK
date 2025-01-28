import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  ApexChart,
  ApexDataLabels,
  ApexLegend,
  ApexPlotOptions,
  ApexTooltip,
  ApexNonAxisChartSeries,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { MaterialModule } from 'src/app/material.module';

export interface PiechartOptions {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  colors: string[];
  plotOptions: ApexPlotOptions;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  legend: ApexLegend;
}

@Component({
  selector: 'app-pie-cards',
  standalone: true,
  imports: [NgApexchartsModule, MaterialModule, CommonModule],
  templateUrl: './pie-cards.component.html',
})
export class AppPieCardsComponent {
  @Input() pieChartsData!: { value: number; label: string; color: string }[];

  generateChartData(): Partial<PiechartOptions>[] {
    return this.pieChartsData.map((data) => ({
      series: [data.value],
      chart: {
        type: 'donut',
        fontFamily: 'Poppins,sans-serif',
        height: 100,
      },
      labels: ['Total'], // Alterado para "Total"
      colors: [data.color, 'rgba(0, 0, 0, 0.1)'],
      plotOptions: {
        pie: {
          donut: {
            size: '85px',
          },
        },
      },
      dataLabels: {
        enabled: false,
      },
      tooltip: {
        fillSeriesColor: false,
      },
      legend: {
        show: false,
      },
    }));
  }
}
