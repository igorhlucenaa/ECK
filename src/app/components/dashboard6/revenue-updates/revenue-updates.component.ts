import { Component, ViewChild } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
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
  ApexMarkers,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { MaterialModule } from 'src/app/material.module';

export interface revenueOptions {
  series: ApexAxisChartSeries | any;
  chart: ApexChart | any;
  dataLabels: ApexDataLabels | any;
  plotOptions: ApexPlotOptions | any;
  yaxis: ApexYAxis | any;
  xaxis: ApexXAxis | any;
  fill: ApexFill | any;
  tooltip: ApexTooltip | any;
  stroke: ApexStroke | any;
  legend: ApexLegend | any;
  grid: ApexGrid | any;
  marker: ApexMarkers | any;
}
interface month {
  value: string;
  viewValue: string;
}

@Component({
  selector: 'app-revenue-updates',
  standalone: true,
  imports: [NgApexchartsModule, TablerIconsModule, MaterialModule],
  templateUrl: './revenue-updates.component.html',
})
export class AppRevenueUpdatesComponent {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  public revenueOptions!: Partial<revenueOptions> | any;

  months: month[] = [
    { value: 'mar', viewValue: 'March 2023' },
    { value: 'apr', viewValue: 'April 2023' },
    { value: 'june', viewValue: 'June 2023' },
  ];

  constructor() {
    this.revenueOptions = {
      series: [
        {
          name: 'Earnings',
          data: [0, 5, 6, 8, 25, 9, 11, 24],
        },
        {
          name: 'Expense',
          data: [0, 3, 1, 2, 8, 1, 5, 1],
        },
      ],
      colors: ['#26c6da', '#1e88e5'],
      fill: {
        type: 'solid',
        opacity: 1,
      },
      chart: {
        toolbar: {
          show: false,
        },
        type: 'line',
        foreColor: '#adb0bb',
        fontFamily: `inherit`,
        height: 300,
      },
      dataLabels: {
        enabled: false,
      },
      markers: {
        size: 4,
        border: 1,
      },
      legend: {
        show: false,
      },
      xaxis: {
        categories: [
          '16/08',
          '17/08',
          '18/08',
          '19/08',
          '20/08',
          '21/08',
          '22/08',
          '23/08',
        ],
      },
      grid: {
        show: true,
        borderColor: 'rgba(0, 0, 0, .2)',
        color: '#777e89',
        strokeDashArray: 2,
        xaxis: {
          lines: {
            show: false,
          },
        },
        yaxis: {
          lines: {
            show: true,
          },
        },
      },
      stroke: {
        curve: 'smooth',
        width: 3,
      },
      tooltip: {
        x: {
          format: 'dd/MM/yy HH:mm',
        },
        theme: 'dark',
      },
    };
  }
}
