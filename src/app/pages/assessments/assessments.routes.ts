import { Routes } from '@angular/router';
import { AssessmentsComponent } from './assessments.component';

export const AssessmentsRoutes: Routes = [
  {
    path: '',
    component: AssessmentsComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./assessment-list/assessment-list.component').then(
            (m) => m.AssessmentListComponent
          ),
      },
      {
        path: 'upload',
        loadComponent: () =>
          import('./upload-list/upload-list.component').then(
            (m) => m.UploadListComponent
          ),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'export',
        loadComponent: () =>
          import('./export/export.component').then((m) => m.ExportComponent),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./create-assessment/create-assessment.component').then(
            (m) => m.CreateAssessmentComponent
          ),
      },
    ],
  },
];
