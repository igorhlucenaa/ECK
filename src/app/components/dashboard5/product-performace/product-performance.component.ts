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

export interface performanceChart {
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
  selector: 'app-product-performance',
  standalone: true,
  imports: [NgApexchartsModule, MaterialModule, TablerIconsModule],
  templateUrl: './product-performance.component.html',
})
export class AppProductPerformanceComponent {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  public performanceChart!: Partial<performanceChart> | any;
  public p1Chart!: Partial<performanceChart> | any;

  constructor() {
    // 1
    this.p1Chart = {
      series: [
        {
          name: 'Products Performance',
          data: [35, 60, 30, 55, 40],
        },
      ],

      grid: {
        show: false,
      },
      colors: ['#26c6da'],
      chart: {
        toolbar: {
          show: false,
        },
        foreColor: '#adb0bb',
        fontFamily: `inherit`,
        type: 'line',
        height: 30,
        sparkline: {
          enabled: true,
        },
      },
      markers: {
        size: 0,
      },
      legend: {
        show: false,
      },
      stroke: {
        show: true,
        width: 2,
        curve: 'smooth',
      },
      tooltip: {
        theme: 'dark',
      },
    };

    // 2
    this.performanceChart = {
      series: [
        {
          name: 'Expence',
          data: [300, 300, 180, 320, 250, 300, 300],
        },
        {
          name: 'Budget',
          data: [60, 90, 80, 60, 70, 100, 80],
        },
      ],
      chart: {
        type: 'bar',
        height: 285,
        stacked: true,
        toolbar: {
          show: false,
        },
        foreColor: '#adb0bb',
        fontFamily: `inherit`,
        sparkline: {
          enabled: false,
        },
      },
      grid: {
        show: false,
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '25%',
          borderRadius: [7],
          borderRadiusApplication: 'end',
        },
      },
      colors: ['#1e88e5', '#26c6da'],
      fill: {
        type: 'solid',
        opacity: 1,
      },

      dataLabels: {
        enabled: false,
      },
      markers: {
        size: 0,
      },
      legend: {
        show: false,
      },
      xaxis: {
        type: 'category',
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'July'],
        axisBorder: {
          show: false,
        },
        axisTicks: {
          show: false,
        },
      },
      yaxis: {
        show: true,
        min: 100,
        max: 400,
        tickAmount: 3,
      },

      stroke: {
        show: true,
        width: 2,
        curve: 'smooth',
      },
      tooltip: {
        theme: 'dark',
      },
    };
  }
}
