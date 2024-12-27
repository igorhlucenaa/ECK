import { Routes } from '@angular/router';
import { UsersComponent } from './users.component'; // Página principal de usuários

export const UsersRoutes: Routes = [
  {
    path: '', // Rota principal que exibe as tabelas de usuários e grupos
    component: UsersComponent,
  },
  {
    path: 'group/create', // Rota para criar um novo grupo de usuários
    loadComponent: () =>
      import('./create-user-group/create-user-group.component').then(
        (c) => c.CreateUserGroupComponent
      ),
  },
  {
    path: 'group/:groupId/details', // Rota para detalhes de um grupo de usuários
    loadComponent: () =>
      import('./group-details/group-details.component').then(
        (c) => c.GroupDetailsComponent
      ),
  },
  {
    path: ':id/edit', // Rota para editar um usuário
    loadComponent: () =>
      import('./edit-user/edit-user.component').then(
        (c) => c.EditUserComponent
      ),
  },
  {
    path: ':id/details', // Rota para detalhes de um usuário
    loadComponent: () =>
      import('./user-details/user-details.component').then(
        (c) => c.UserDetailsComponent
      ),
  },
];
