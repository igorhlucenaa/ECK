import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
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
        redirectTo: 'starter', // Redireciona para starter como página inicial após autenticação
        pathMatch: 'full',
      },
      {
        path: 'starter',
        loadChildren: () =>
          import('./pages/pages.routes').then((m) => m.PagesRoutes),
        canActivate: [AuthGuard],
      },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./pages/dashboard/dashboard.routes').then(
            (m) => m.DashboardRoutes
          ),
        canActivate: [AuthGuard],
        data: { role: 'admin_master' },
      },
      {
        path: 'clients',
        loadChildren: () =>
          import('./pages/clients/clients.routes').then((m) => m.ClientsRoutes),
        canActivate: [AuthGuard],
        data: { role: 'admin_master' },
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
        path: 'reports',
        loadChildren: () =>
          import('./pages/reports/reports.routes').then((m) => m.ReportsRoutes),
        canActivate: [AuthGuard],
        data: { role: 'viewer' },
      },
      {
        path: 'dashboards',
        loadChildren: () =>
          import('./pages/dashboards/dashboards.routes').then(
            (m) => m.DashboardsRoutes
          ),
        canActivate: [AuthGuard],
        data: { role: 'admin_account' },
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'authentication/error',
  },
];
