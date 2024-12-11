import { Routes } from '@angular/router';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';

export const ClientsRoutes: Routes = [
  {
    path: '',
    component: ClientsListComponent,
  },
  {
    path: ':id',
    component: ClientDetailComponent,
  },
];
