import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReportListComponent } from './report-list/report-list.component';
import { ReportDetailComponent } from './report-detail/report-detail.component';
import { ReportMetricsComponent } from './report-metrics/report-metrics.component';
import { ExportComponent } from '../assessments/export/export.component';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ReportsRoutes } from './reports.routes';
import { MetricsService } from './services/metrics.service';
import { ReportExportService } from './services/report-export.service';
import { NgxChartsModule } from '@swimlane/ngx-charts';

@NgModule({
  imports: [
    CommonModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    NgApexchartsModule,
    RouterModule.forChild(ReportsRoutes),
    ReportListComponent,
    ReportDetailComponent,
    ReportMetricsComponent,
    ExportComponent,
    NgxChartsModule
  ],
  providers: [
    MetricsService,
    ReportExportService
  ]
})
export class ReportsModule { }
