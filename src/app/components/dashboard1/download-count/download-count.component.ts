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

export interface chartOption {
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

@Component({
  selector: 'app-download-count',
  standalone: true,
  imports: [NgApexchartsModule, MaterialModule, TablerIconsModule],
  templateUrl: './download-count.component.html',
})
export class AppDownloadCountComponent {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  public downloadOptions!: Partial<chartOption> | any;

  constructor() {
    // download
    this.downloadOptions = {
      series: [
        {
          name: '',
          data: [4, 5, 2, 10, 9, 12, 4, 9, 4, 5, 3, 10, 9, 12, 10, 9, 12, 4, 9],
        },
      ],
      chart: {
        type: 'bar',
        height: 70,
        fontFamily: 'Poppins,sans-serif',
        toolbar: {
          show: false,
        },
        offsetY: 15,
        sparkline: {
          enabled: true,
        },
      },

      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '20%',
        },
      },
      grid: {
        show: false,
        padding: {
          left: 0,
          right: 0,
        },
      },
      colors: 'rgba(255, 255, 255, 0.5)',

      dataLabels: {
        enabled: false,
      },
      tooltip: {
        theme: 'dark',
      },
    };
  }
}
