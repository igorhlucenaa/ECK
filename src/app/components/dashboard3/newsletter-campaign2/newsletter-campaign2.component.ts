import { CommonModule } from '@angular/common';
import { Component, ViewChild, Input, OnInit } from '@angular/core';
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

export interface NewsChartOptions {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  stroke: any;
  tooltip: ApexTooltip;
  dataLabels: ApexDataLabels;
  legend: ApexLegend;
  colors: string[];
  markers: any;
  grid: ApexGrid;
  fill: ApexFill;
}

@Component({
  selector: 'app-newsletter-campaign2',
  standalone: true,
  imports: [NgApexchartsModule, MaterialModule, CommonModule],
  templateUrl: './newsletter-campaign2.component.html',
})
export class AppNewsletterCampaign2Component implements OnInit {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);
  @Input() creditUsageData: {
    month: string;
    used: number;
    remaining: number;
  }[] = [];

  public newschartOptions!: Partial<NewsChartOptions>;

  ngOnInit(): void {
    this.updateChart();
  }

  private updateChart(): void {
    const months = this.creditUsageData.map((data) => data.month) || [];
    const usedCredits = this.creditUsageData.map((data) => data.used) || [];
    const remainingCredits =
      this.creditUsageData.map((data) => data.remaining) || [];

    this.newschartOptions = {
      series: [
        { name: 'Créditos Usados', data: usedCredits },
        { name: 'Créditos Restantes', data: remainingCredits },
      ],
      chart: {
        height: 260,
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
        show: true,
        position: 'top',
      },
      xaxis: {
        categories: months,
        labels: {
          rotate: -45,
        },
      },
      grid: {
        show: true,
        borderColor: 'rgba(0, 0, 0, .2)',
        strokeDashArray: 2,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
      },
      stroke: {
        curve: 'smooth',
        width: 3,
      },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'vertical',
          opacityFrom: 0.4,
          opacityTo: 0.1,
        },
      },
      tooltip: {
        theme: 'dark',
      },
    };
  }
}
