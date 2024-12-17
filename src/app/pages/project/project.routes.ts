import { Routes } from '@angular/router';
import { ProjectsListComponent } from './projects-list/projects-list.component';
import { ProjectDetailComponent } from './project-detail/project-detail.component';
import { AuthGuard } from 'src/app/guards/auth.guard';

export const ProjectsRoutes: Routes = [
  {
    path: '',
    component: ProjectsListComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' }, // Apenas admin_client pode acessar
  },
  {
    path: 'new',
    component: ProjectDetailComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' }, // Apenas admin_client pode criar
  },
  {
    path: ':id/edit',
    component: ProjectDetailComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' }, // Apenas admin_client pode editar
  },
];
