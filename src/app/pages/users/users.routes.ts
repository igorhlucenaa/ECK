import { Routes } from '@angular/router';
import { UsersComponent } from './users.component';
import { AuthGuard } from 'src/app/guards/auth.guard';

export const UsersRoutes: Routes = [
  {
    path: '',
    component: UsersComponent,
  },
  {
    path: 'group/create',
    loadComponent: () =>
      import('./create-user-group/create-user-group.component').then(
        (c) => c.CreateUserGroupComponent
      ),
  },
  {
    path: 'group/:groupId/details',
    loadComponent: () =>
      import('./group-details/group-details.component').then(
        (c) => c.GroupDetailsComponent
      ),
  },
  {
    path: 'group/:groupId/edit',
    loadComponent: () =>
      import('./edit-group/edit-group.component').then(
        (c) => c.EditGroupComponent
      ),
  },
  {
    // Editar usuário — restrito a admin_master (HTTP 403 equivalente para admin_client)
    path: ':id/edit',
    canActivate: [AuthGuard],
    data: { role: 'admin_master' },
    loadComponent: () =>
      import('./edit-user/edit-user.component').then(
        (c) => c.EditUserComponent
      ),
  },
  {
    path: ':id/details',
    loadComponent: () =>
      import('./user-details/user-details.component').then(
        (c) => c.UserDetailsComponent
      ),
  },
];
