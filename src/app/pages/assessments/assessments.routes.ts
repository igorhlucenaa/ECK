import { Routes } from '@angular/router';
import { AssessmentsComponent } from './assessments.component';
import { AuthGuard } from 'src/app/guards/auth.guard';

export const AssessmentsRoutes: Routes = [
  {
    path: '',
    component: AssessmentsComponent,
    children: [
      {
        path: '',
        canActivate: [AuthGuard],
        data: { role: ['admin_master'] },
        loadComponent: () =>
          import('./assessment-list/assessment-list.component').then(
            (m) => m.AssessmentListComponent
          ),
      },
      {
        path: 'upload',
        canActivate: [AuthGuard],
        data: { role: ['admin_master'] },
        loadComponent: () =>
          import('./upload-list/upload-list.component').then(
            (m) => m.UploadListComponent
          ),
      },
      {
        path: 'dashboard',
        canActivate: [AuthGuard],
        data: { role: ['admin_master'] },
        loadComponent: () =>
          import('./dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'export',
        canActivate: [AuthGuard],
        data: { role: ['admin_master'] },
        loadComponent: () =>
          import('./export/export.component').then((m) => m.ExportComponent),
      },
      {
        path: 'new',
        canActivate: [AuthGuard],
        data: { role: ['admin_master'] },
        loadComponent: () =>
          import('./create-assessment/create-assessment.component').then(
            (m) => m.CreateAssessmentComponent
          ),
      },
      {
        path: ':id/edit',
        canActivate: [AuthGuard],
        data: { role: ['admin_master'] },
        loadComponent: () =>
          import('./create-assessment/create-assessment.component').then(
            (m) => m.CreateAssessmentComponent
          ),
      },
      {
        path: 'participants',
        canActivate: [AuthGuard],
        data: { role: ['admin_master', 'admin_client', 'viewer'] },
        loadComponent: () =>
          import('./participants/participants.component').then(
            (m) => m.ParticipantsComponent
          ),
      },
    ],
  },
];

