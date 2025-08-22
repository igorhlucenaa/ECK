import { Routes } from '@angular/router';
import { CompetenciesComponent } from './competencies.component';

export const CompetenciesRoutes: Routes = [
  {
    path: '',
    component: CompetenciesComponent,
    data: {
      title: 'Competências',
      urls: [
        { title: 'Definições', url: '/competencies' },
        { title: 'Competências' },
      ],
    },
  },
];
