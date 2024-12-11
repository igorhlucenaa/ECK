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

export interface customersOptions {
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
  selector: 'app-customers',
  standalone: true,
  imports: [NgApexchartsModule, MaterialModule, TablerIconsModule],
  templateUrl: './customers.component.html',
})
export class AppCustomersComponent {
  @ViewChild('chart') chart: ChartComponent = Object.create(null);

  public customersOptions!: Partial<customersOptions> | any;

  constructor() {
    this.customersOptions = {
      series: [
        {
          name: '',
          data: [1, 19, 3, 13, 2, 19],
        },
      ],
      chart: {
        type: 'line',
        toolbar: {
          show: false,
        },
        foreColor: '#adb0bb',
        fontFamily: `inherit`,
        height: 55,
        sparkline: {
          enabled: true,
        },
      },
      colors: ['rgb(255,255,255)'],

      marker: {
        size: 0,
      },

      tooltip: {
        theme: 'dark',
      },

      grid: {
        show: false,
      },

      stroke: {
        show: true,
        width: 2,
        curve: 'smooth',
      },
    };
  }
}
