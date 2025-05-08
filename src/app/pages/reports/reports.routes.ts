import { Routes } from '@angular/router';
import { ReportsListComponent } from './reports-list/reports-list.component';
import { ReportEditorComponent } from './report-editor/report-editor.component';

export const ReportsRoutes: Routes = [
  {
    path: '',
    component: ReportsListComponent
  },
  {
    path: 'new',
    component: ReportEditorComponent
  },
  {
    path: ':id/edit',
    component: ReportEditorComponent
  }
];
