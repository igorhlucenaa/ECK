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

export interface piechart {
  series: ApexNonAxisChartSeries | any;
  chart: ApexChart | any;
  responsive: ApexResponsive[] | any;
  labels: any | any;
  tooltip: ApexTooltip | any;
  legend: ApexLegend | any;
  colors: string[] | any;
  stroke: any | any;
  dataLabels: ApexDataLabels | any;
  plotOptions: ApexPlotOptions | any;
}

@Component({
  selector: 'app-pie-cards',
  standalone: true,
  imports: [NgApexchartsModule, MaterialModule, TablerIconsModule],
  templateUrl: './pie-cards.component.html',
})
export class AppPieCardsComponent {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  public pie1Chart!: Partial<piechart> | any;
  public pie2Chart!: Partial<piechart> | any;
  public pie3Chart!: Partial<piechart> | any;
  public pie4Chart!: Partial<piechart> | any;

  constructor() {
    // 1
    this.pie1Chart = {
      series: [5, 15],
      chart: {
        type: 'donut',
        fontFamily: 'Poppins,sans-serif',
        height: 100,
        offsetY: 0,
      },
      plotOptions: {
        pie: {
          donut: {
            size: '85px',
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
        fillSeriesColor: false,
      },
      dataLabels: {
        enabled: false,
      },
      labels: ['New', 'Old'],
      colors: ['#1e88e5', 'rgba(0, 0, 0, 0.1)'],
    };

    // 2
    this.pie2Chart = {
      series: [4, 15],
      chart: {
        type: 'donut',
        fontFamily: 'Poppins,sans-serif',
        height: 100,
        offsetY: 0,
      },
      plotOptions: {
        pie: {
          donut: {
            size: '85px',
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
        fillSeriesColor: false,
      },
      dataLabels: {
        enabled: false,
      },
      labels: ['New', 'Old'],
      colors: ['#26c6da', 'rgba(0, 0, 0, 0.1)'],
    };

    // 3
    this.pie3Chart = {
      series: [11, 15],
      chart: {
        type: 'donut',
        fontFamily: 'Poppins,sans-serif',
        height: 100,
        offsetY: 0,
      },
      plotOptions: {
        pie: {
          donut: {
            size: '85px',
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
        fillSeriesColor: false,
      },
      dataLabels: {
        enabled: false,
      },
      labels: ['New', 'Old'],
      colors: ['#ffb22b', 'rgba(0, 0, 0, 0.1)'],
    };

    // 4
    this.pie4Chart = {
      series: [20, 15],
      chart: {
        type: 'donut',
        fontFamily: 'Poppins,sans-serif',
        height: 100,
        offsetY: 0,
      },
      plotOptions: {
        pie: {
          donut: {
            size: '85px',
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
        fillSeriesColor: false,
      },
      dataLabels: {
        enabled: false,
      },
      labels: ['New', 'Old'],
      colors: ['#fc4b6c', 'rgba(0, 0, 0, 0.1)'],
    };
  }
}
