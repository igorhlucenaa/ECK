import { Routes } from '@angular/router';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';
import { AuthGuard } from 'src/app/guards/auth.guard';

export const ClientsRoutes: Routes = [
  {
    path: '',
    component: ClientsListComponent,
    canActivate: [AuthGuard], // Protege a rota
    data: { role: 'admin_master' }, // Apenas admin_master pode acessar
  },
  {
    path: 'new',
    component: ClientDetailComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_master' }, // Apenas admin_master pode adicionar
  },
  {
    path: ':id',
    component: ClientDetailComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_master' }, // Apenas admin_master pode editar
  },
];
