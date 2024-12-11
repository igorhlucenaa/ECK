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

export interface visitorChart {
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
  selector: 'app-visitors',
  standalone: true,
  imports:[NgApexchartsModule, MaterialModule, TablerIconsModule],
  templateUrl: './visitors.component.html',
})
export class AppVisitorsComponent {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  public visitorChart!: Partial<visitorChart> | any;

  constructor() {
    this.visitorChart = {
      series: [45, 15, 27, 18],
      chart: {
        type: 'donut',
        fontFamily: 'Poppins,sans-serif',
        height: 200,
      },
      plotOptions: {
        pie: {
          donut: {
            size: '80%',
            background: 'transparent',
          },
        },
      },
      tooltip: {
        fillSeriesColor: false,
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        width: 0,
      },
      legend: {
        show: false,
      },
      labels: ['Mobile', 'Tablet', 'Desktop', 'Other'],
      colors: ['#1e88e5', '#26c6da', '#745af2', '#eceff1'],
      responsive: [{ breakpoint: 480, options: { chart: { height: 230 } } }],
    };
  }
}
