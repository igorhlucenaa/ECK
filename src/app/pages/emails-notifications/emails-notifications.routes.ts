import { Routes } from '@angular/router';
import { EmailsNotificationsComponent } from './emails-notifications.component';
import { AuthGuard } from 'src/app/guards/auth.guard';

export const EmailsNotificationsRoutes: Routes = [
  {
    path: '',
    component: EmailsNotificationsComponent,
    canActivate: [AuthGuard],
    data: { role: ['admin_master', 'admin_client'] }, // Acessível para admin_master e admin_client
  },
];
