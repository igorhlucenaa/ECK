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
        path: 'dashboard-builder',
        loadComponent: () =>
          import('../../components/dashboard-builder/dashboard-builder.component').then(
            (m) => m.DashboardBuilderComponent
          ),
      },
      {
        path: 'dashboard-builder/:id',
        loadComponent: () =>
          import('../../components/dashboard-builder/dashboard-builder.component').then(
            (m) => m.DashboardBuilderComponent
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
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./create-assessment/create-assessment.component').then(
            (m) => m.CreateAssessmentComponent
          ),
      },
      {
        path: 'participants',
        loadComponent: () =>
          import('./participants/participants.component').then(
            (m) => m.ParticipantsComponent
          ),
      },
    ],
  },
  {
    path: 'take/:token',
    loadComponent: () =>
      import('./assessment/assessment.component').then(
        (m) => m.AssessmentComponent
      ),
  },
];
