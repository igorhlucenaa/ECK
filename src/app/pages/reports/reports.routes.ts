import { Routes } from '@angular/router';
import { ReportListComponent } from './report-list/report-list.component';
import { ReportDetailComponent } from './report-detail/report-detail.component';
import { ReportsComponent } from './reports.component';

export const ReportsRoutes: Routes = [
  {
    path: '',
    component: ReportsComponent,
  },
  {
    path: ':id',
    component: ReportDetailComponent,
  },
];
