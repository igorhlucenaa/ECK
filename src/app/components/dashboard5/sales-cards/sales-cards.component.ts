import { Component, ViewChild } from '@angular/core';
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

export interface productsChart {
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
  selector: 'app-sales-cards',
  standalone: true,
  imports: [NgApexchartsModule, MaterialModule],
  templateUrl: './sales-cards.component.html',
})
export class AppSalesCardsComponent {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  public productAChart!: Partial<productsChart> | any;
  public productBChart!: Partial<productsChart> | any;
  public productCChart!: Partial<productsChart> | any;

  constructor() {
    this.productAChart = {
      series: [
        {
          name: 'Sales A',
          data: [2, 4, 4, 6, 8, 5, 6, 4, 8, 6, 6, 2],
        },
      ],
      chart: {
        type: 'area',
        foreColor: '#adb0bb',
        fontFamily: `inherit`,
        height: 50,
        sparkline: {
          enabled: true,
        },
      },
      grid: {
        show: false,
        padding: {
          left: 0,
          right: 0,
        },
      },
      colors: ['#1e88e5'],
      fill: {
        type: 'solid',
        opacity: 1,
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        curve: 'straight',
        width: 0,
      },
      tooltip: {
        theme: 'dark',
        fillSeriesColor: false,
      },
    };
    // 2
    this.productBChart = {
      series: [
        {
          name: 'Sales A',
          data: [2, 4, 4, 6, 8, 5, 6, 4, 8, 6, 6, 2],
        },
      ],
      chart: {
        type: 'area',
        foreColor: '#adb0bb',
        fontFamily: `inherit`,
        height: 50,
        sparkline: {
          enabled: true,
        },
      },
      grid: {
        show: false,
        padding: {
          left: 0,
          right: 0,
        },
      },
      colors: ['#26c6da'],
      fill: {
        type: 'solid',
        opacity: 1,
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        curve: 'straight',
        width: 0,
      },
      tooltip: {
        theme: 'dark',
        fillSeriesColor: false,
      },
    };
    // 3
    this.productCChart = {
      series: [
        {
          name: 'Sales A',
          data: [2, 4, 4, 6, 8, 5, 6, 4, 8, 6, 6, 2],
        },
      ],
      chart: {
        type: 'area',
        foreColor: '#adb0bb',
        fontFamily: `inherit`,
        height: 50,
        sparkline: {
          enabled: true,
        },
      },
      grid: {
        show: false,
        padding: {
          left: 0,
          right: 0,
        },
      },
      colors: ['#7460ee'],
      fill: {
        type: 'solid',
        opacity: 1,
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        curve: 'straight',
        width: 0,
      },
      tooltip: {
        theme: 'dark',
        fillSeriesColor: false,
      },
    };
  }
}
