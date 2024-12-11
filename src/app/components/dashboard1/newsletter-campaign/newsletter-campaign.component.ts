import { Component, ViewChild } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import {
  ApexChart,
  ChartComponent,
  ApexDataLabels,
  ApexLegend,
  ApexTooltip,
  ApexAxisChartSeries,
  ApexXAxis,
  ApexGrid,
  ApexFill,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { MaterialModule } from 'src/app/material.module';

export interface newsletterchartOptions {
  series: ApexAxisChartSeries | any;
  chart: ApexChart | any;
  xaxis: ApexXAxis | any;
  stroke: any | any;
  tooltip: ApexTooltip | any;
  dataLabels: ApexDataLabels | any;
  legend: ApexLegend | any;
  colors: string[] | any;
  markers: any;
  grid: ApexGrid | any;
  fill: ApexFill | any;
}

@Component({
  selector: 'app-newsletter-campaign',
  standalone: true,
  imports: [NgApexchartsModule, MaterialModule, TablerIconsModule],
  templateUrl: './newsletter-campaign.component.html',
})
export class AppNewsletterCampaignComponent {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  public newsletterchartOptions!: Partial<newsletterchartOptions> | any;

  constructor() {
    this.newsletterchartOptions = {
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
      chart: {
        height: 365,
        fontFamily: 'Poppins,sans-serif',
        type: 'area',
        foreColor: '#adb0bb',
      },
      colors: ['#1e88e5', '#26c6da'],
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
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
      },
      grid: {
        show: true,
        borderColor: 'rgba(0, 0, 0, .2)',
        color: 'rgba(0, 0, 0, .2)',
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
      fill: {
        type: 'gradient',
        opacity: ['0.1', '0.1'],
      },
      tooltip: {
        theme: 'dark',
        x: {
          format: 'dd/MM/yy HH:mm',
        },
      },
    };
  }
}
