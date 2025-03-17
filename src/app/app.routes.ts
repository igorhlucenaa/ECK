import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { AuthGuard } from './guards/auth.guard';
import { ClientCustomizationComponent } from './pages/client-customization/client-customization.component';
import { CreditOrdersComponent } from './pages/credit-orders/credit-orders.component';
import { NewCreditOrderComponent } from './pages/credit-orders/new-credit-order/new-credit-order.component';
import { EmailTemplateListComponent } from './pages/project/email-template-list/email-template-list.component';
import { AssessmentComponent } from './pages/assessments/assessment/assessment.component';

export const routes: Routes = [
  {
    path: 'assessment',
    component: AssessmentComponent,
  },
  {
    path: '',
    component: BlankComponent,
    children: [
      {
        path: '',
        redirectTo: 'authentication/login',
        pathMatch: 'full',
      },
      {
        path: 'authentication',
        loadChildren: () =>
          import('./pages/authentication/authentication.routes').then(
            (m) => m.AuthenticationRoutes
          ),
      },
    ],
  },
  {
    path: '',
    component: FullComponent,
    children: [
      {
        path: '',
        redirectTo: 'dashboard', // Redireciona para o Dashboard
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./pages/dashboard/dashboard.routes').then(
            (m) => m.DashboardRoutes
          ),
        canActivate: [AuthGuard],
        data: { role: ['admin_master', 'admin_client'] }, // Permissões ajustadas
      },
      {
        path: 'clients',
        loadChildren: () =>
          import('./pages/clients/clients.routes').then((m) => m.ClientsRoutes),
        canActivate: [AuthGuard],
        data: { role: 'admin_master' },
      },
      {
        path: 'mail-templates',
        component: EmailTemplateListComponent,
        canActivate: [AuthGuard],
        data: { role: 'admin_master' },
      },
      {
        path: 'clients/:id/customization',
        component: ClientCustomizationComponent,
        canActivate: [AuthGuard],
        data: { role: 'admin_client' },
      },
      {
        path: 'projects',
        loadChildren: () =>
          import('./pages/project/project.routes').then(
            (m) => m.ProjectsRoutes
          ),
        canActivate: [AuthGuard],
        data: { role: 'admin_client' },
      },
      {
        path: 'assessments',
        loadChildren: () =>
          import('./pages/assessments/assessments.routes').then(
            (m) => m.AssessmentsRoutes
          ),
        canActivate: [AuthGuard],
        data: { role: ['admin_master', 'admin_client', 'viewer'] },
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('./pages/reports/reports.routes').then((m) => m.ReportsRoutes),
        canActivate: [AuthGuard],
        data: { role: 'viewer' },
      },
      {
        path: 'orders',
        component: CreditOrdersComponent,
        canActivate: [AuthGuard],
        data: { role: ['admin_master', 'admin_client'] },
      },
      {
        path: 'emails-notifications',
        loadChildren: () =>
          import(
            './pages/emails-notifications/emails-notifications.routes'
          ).then((m) => m.EmailsNotificationsRoutes),
        canActivate: [AuthGuard],
        data: { role: ['admin_master', 'admin_client'] },
      },
      {
        path: 'orders/new',
        component: NewCreditOrderComponent,
        canActivate: [AuthGuard],
        data: { role: ['admin_master', 'admin_client'] },
      },
      {
        path: 'users',
        loadChildren: () =>
          import('./pages/users/users.routes').then((m) => m.UsersRoutes),
        canActivate: [AuthGuard],
        data: { role: ['admin_master', 'admin_client'] },
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'authentication/error',
  },
];
