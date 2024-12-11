import { Routes } from '@angular/router';
import { ProjectsListComponent } from './projects-list/projects-list.component';
import { ProjectDetailComponent } from './project-detail/project-detail.component';

export const ProjectsRoutes: Routes = [
  {
    path: '',
    component: ProjectsListComponent,
  },
  {
    path: ':id',
    component: ProjectDetailComponent,
  },
];
