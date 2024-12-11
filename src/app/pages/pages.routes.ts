import { Routes } from '@angular/router';
import { StarterComponent } from './starter/starter.component';

export const PagesRoutes: Routes = [
  {
    path: '', // Caminho vazio, pois já está configurado como 'starter' em app.routes.ts
    component: StarterComponent,
    data: {
      title: 'Starter Page',
      urls: [
        { title: 'Home', url: '/starter' },
        { title: 'Starter' },
      ],
    },
  },
];
