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

export interface sparkchart {
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
  selector: 'app-sparkline-cards',
  standalone: true,
  imports: [NgApexchartsModule, MaterialModule, TablerIconsModule],
  templateUrl: './sparkline-cards.component.html',
})
export class AppSparklineCardsComponent {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  public spark1Chart!: Partial<sparkchart> | any;
  public spark2Chart!: Partial<sparkchart> | any;
  public spark3Chart!: Partial<sparkchart> | any;
  public spark4Chart!: Partial<sparkchart> | any;

  constructor() {
    // 1
    this.spark1Chart = {
      series: [
        {
          name: '',
          data: [4, 5, 2, 10, 9, 12, 4, 9],
        },
      ],
      chart: {
        type: 'bar',
        fontFamily: 'Poppins,sans-serif',
        height: 65,
        sparkline: { enabled: true },
      },
      plotOptions: {
        bar: {
          horizontal: false,
          endingShape: 'flat',
          columnWidth: '65%',
        },
      },
      xaxis: {
        show: false,
        labels: {
          show: false,
        },
      },
      yaxis: {
        show: false,
      },
      grid: {
        show: false,
        stroke: {
          show: false,
        },
        padding: {
          top: 0,
          bottom: 0,
        },
      },
      fill: {
        opacity: 1,
      },
      tooltip: {
        enabled: true,
        theme: 'dark',
        x: {
          show: false,
        },
      },
      colors: ['#1e88e5'],
    };
    // 2
    this.spark2Chart = {
      series: [
        {
          name: '',
          data: [2, 5, 6, 10, 9, 12, 4, 9],
        },
      ],
      chart: {
        type: 'bar',
        fontFamily: 'Poppins,sans-serif',
        height: 65,
        sparkline: { enabled: true },
      },
      plotOptions: {
        bar: {
          horizontal: false,
          endingShape: 'flat',
          columnWidth: '65%',
        },
      },
      xaxis: {
        show: false,
        labels: {
          show: false,
        },
      },
      yaxis: {
        show: false,
      },
      grid: {
        show: false,
        stroke: {
          show: false,
        },
        padding: {
          top: 0,
          bottom: 0,
        },
      },
      fill: {
        opacity: 1,
      },
      tooltip: {
        enabled: true,
        theme: 'dark',
        x: {
          show: false,
        },
      },
      colors: ['#26c6da'],
    };
    // 3
    this.spark3Chart = {
      series: [
        {
          name: '',
          data: [4, 5, 6, 10, 9, 12, 4, 9],
        },
      ],
      chart: {
        type: 'bar',
        fontFamily: 'Poppins,sans-serif',
        height: 65,
        sparkline: { enabled: true },
      },
      plotOptions: {
        bar: {
          horizontal: false,
          endingShape: 'flat',
          columnWidth: '65%',
        },
      },
      xaxis: {
        show: false,
        labels: {
          show: false,
        },
      },
      yaxis: {
        show: false,
      },
      grid: {
        show: false,
        stroke: {
          show: false,
        },
        padding: {
          top: 0,
          bottom: 0,
        },
      },
      fill: {
        opacity: 1,
      },
      tooltip: {
        enabled: true,
        theme: 'dark',
        x: {
          show: false,
        },
      },
      colors: ['#ffb22b'],
    };
    // 4
    this.spark4Chart = {
      series: [
        {
          name: '',
          data: [2, 5, 6, 10, 9, 12, 4, 9],
        },
      ],
      chart: {
        type: 'bar',
        fontFamily: 'Poppins,sans-serif',
        height: 65,
        sparkline: { enabled: true },
      },
      plotOptions: {
        bar: {
          horizontal: false,
          endingShape: 'flat',
          columnWidth: '65%',
        },
      },
      xaxis: {
        show: false,
        labels: {
          show: false,
        },
      },
      yaxis: {
        show: false,
      },
      grid: {
        show: false,
        stroke: {
          show: false,
        },
        padding: {
          top: 0,
          bottom: 0,
        },
      },
      fill: {
        opacity: 1,
      },
      tooltip: {
        enabled: true,
        theme: 'dark',
        x: {
          show: false,
        },
      },
      colors: ['#fc4b6c'],
    };
  }
}
