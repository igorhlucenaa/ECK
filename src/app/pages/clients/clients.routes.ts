import { Routes } from '@angular/router';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';
import { AuthGuard } from 'src/app/guards/auth.guard';
import { ClientDetailsViewComponent } from './client-detail-view/client-detail-view.component';

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
    path: ':id/edit',
    component: ClientDetailComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_master' }, // Apenas admin_master pode editar
  },

  {
    path: ':id',
    component: ClientDetailsViewComponent, // Novo componente para detalhes do cliente
    canActivate: [AuthGuard],
    data: { role: 'admin_master' },
  },
];
