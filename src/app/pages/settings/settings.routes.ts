import { Routes } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';
import { ReminderSettingsComponent } from './reminder-settings/reminder-settings.component';

export const SettingsRoutes: Routes = [
  {
    path: '',
    component: ReminderSettingsComponent,
    canActivate: [AuthGuard],
    data: { role: ['admin_master', 'admin_client'] },
  },
];
