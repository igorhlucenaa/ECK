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

export interface totalsalesOptions {
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
  selector: 'app-total-sales',
  standalone: true,
  imports: [NgApexchartsModule, TablerIconsModule, MaterialModule],
  templateUrl: './total-sales.component.html',
})
export class AppTotalSalesComponent {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  public totalsalesOptions!: Partial<totalsalesOptions> | any;

  months: month[] = [
    { value: 'mar', viewValue: 'March 2023' },
    { value: 'apr', viewValue: 'April 2023' },
    { value: 'june', viewValue: 'June 2023' },
  ];

  constructor() {
    this.totalsalesOptions = {
      series: [25, 35, 35],
      labels: ['2021', '2022', '2023'],
      chart: {
        height: 280,
        type: 'donut',
        foreColor: '#adb0bb',
        fontFamily: `inherit`,
      },
      colors: ['#1e88e5', '#26c6da', '#ecf0f2'],
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: {
        show: false,
        borderColor: 'transparent',
        padding: { top: 0, right: 0 },
      },
      stroke: { colors: ['transparent'] },
      plotOptions: {
        pie: {
          donut: {
            size: '78%',
            background: 'transparent',
            labels: {
              show: false,
              name: {
                show: true,
                fontSize: '18px',
                color: undefined,
                offsetY: -10,
              },
              value: { show: false, color: '#98aab4' },
              total: { show: false, label: 'Our Visitors', color: '#98aab4' },
            },
          },
        },
      },
      tooltip: { theme: 'dark', fillSeriesColor: false },
      responsive: [{ breakpoint: 480, options: { chart: { height: 250 } } }],
    };
  }
}
