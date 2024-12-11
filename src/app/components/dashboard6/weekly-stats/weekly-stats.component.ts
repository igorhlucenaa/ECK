import { Component, ViewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
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

export interface statsOptions {
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

interface stats {
  id: number;
  icon: string;
  color: string;
  title: string;
  subtitle: string;
  percent: string;
}

@Component({
  selector: 'app-weekly-stats',
  standalone: true,
  imports:[NgApexchartsModule, TablerIconsModule, MatIconModule, MaterialModule],
  templateUrl: './weekly-stats.component.html',
})
export class AppWeeklyStatsComponent {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  public statsOptions!: Partial<statsOptions> | any;

  constructor() {
    this.statsOptions = {
      series: [
        {
          name: 'Weekly Stats',
           data: [40, 60, 50, 65],
        },
      ],
      chart: {
        type: 'area',
        height: 135,
        toolbar: {
          show: false,
        },
        foreColor: '#adb0bb',
        fontFamily: "'Poppins',sans-serif",
        sparkline: {
          enabled: true,
        },
      },
      colors:[ '#26c6da'],
      fill: {
        colors: '#26c6da',
        opacity: 0.05,
        type: 'solid',
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

  stats: stats[] = [
    {
      id: 1,
      color: 'primary',
      icon: 'shopping-cart',
      title: 'Top Sales',
      subtitle: 'Johnathan Doe',
      percent: '68',
    },
    {
      id: 2,
      color: 'warning',
      icon: 'star',
      title: 'Best Seller',
      subtitle: 'MaterialPro Admin',
      percent: '45',
    },
    {
      id: 3,
      color: 'success',
      icon: 'message',
      title: 'Most Commented',
      subtitle: 'Ample Admin',
      percent: '10',
    },
    {
        id: 4,
        color: 'error',
        icon: 'basket',
        title: 'Recent Commented',
        subtitle: 'Modernize Admin',
        percent: '100',
      },
  ];
}
