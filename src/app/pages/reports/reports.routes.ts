import { Routes } from '@angular/router';
import { ReportListComponent } from './report-list/report-list.component';
import { ReportDetailComponent } from './report-detail/report-detail.component';

export const ReportsRoutes: Routes = [
  {
    path: '',
    component: ReportListComponent,
  },
  {
    path: ':id',
    component: ReportDetailComponent,
  },
];
