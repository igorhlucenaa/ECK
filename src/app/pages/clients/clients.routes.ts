import { Routes } from '@angular/router';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';
import { AuthGuard } from 'src/app/guards/auth.guard';
import { ClientDetailsViewComponent } from './client-detail-view/client-detail-view.component';

export const ClientsRoutes: Routes = [
  {
    path: '',
    component: ClientsListComponent,
    canActivate: [AuthGuard],
    data: { appRoute: 'clients' },
  },
  {
    path: 'new',
    component: ClientDetailComponent,
    canActivate: [AuthGuard],
    data: { role: ['admin_master'] },
  },
  {
    path: ':id/edit',
    component: ClientDetailComponent,
    canActivate: [AuthGuard],
    data: { role: ['admin_master'] },
  },

  {
    path: ':id',
    component: ClientDetailsViewComponent,
    canActivate: [AuthGuard],
    data: { role: ['admin_master'] },
  },
];
