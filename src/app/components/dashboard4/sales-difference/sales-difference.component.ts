import { Component, ViewChild } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import {
  ApexChart,
  ChartComponent,
  ApexDataLabels,
  ApexPlotOptions,
  ApexLegend,
  ApexTooltip,
  ApexNonAxisChartSeries,
  ApexResponsive,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { MaterialModule } from 'src/app/material.module';

export interface differenceChart {
  series: ApexNonAxisChartSeries | any;
  chart: ApexChart | any;
  responsive: ApexResponsive[] | any;
  labels: any;
  tooltip: ApexTooltip | any;
  legend: ApexLegend | any;
  colors: string[] | any;
  stroke: any;
  dataLabels: ApexDataLabels | any;
  plotOptions: ApexPlotOptions | any;
}
@Component({
  selector: 'app-sales-difference',
  standalone: true,
  imports: [NgApexchartsModule, MaterialModule, TablerIconsModule],
  templateUrl: './sales-difference.component.html',
})
export class AppSalesDifferenceComponent {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  public differenceChart!: Partial<differenceChart> | any;

  constructor() {
    this.differenceChart = {
      series: [25, 10],
      chart: {
        type: 'donut',
        foreColor: '#adb0bb',
        fontFamily: `inherit`,
        height: 130,
        width: 130,
      },
      colors: ['#26c6da', 'rgb(242, 244, 248)'],
      labels: ['Increase', 'Decrease'],
      dataLabels: {
        enabled: false,
      },
      plotOptions: {
        pie: {
          donut: {
            size: '60px',
          },
        },
      },
      stroke: {
        width: 0,
      },
      legend: {
        show: false,
      },
      tooltip: {
        enabled: true,
        theme: 'dark',
        fillSeriesColor: false,
      },
    };
  }
}
