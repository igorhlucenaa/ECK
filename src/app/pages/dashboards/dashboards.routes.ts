import { Routes } from '@angular/router';

// dashboards
import { AppDashboard1Component } from './dashboard1/dashboard1.component';
import { AppDashboard2Component } from './dashboard2/dashboard2.component';
import { AppDashboard3Component } from './dashboard3/dashboard3.component';
import { AppDashboard4Component } from './dashboard4/dashboard4.component';
import { AppDashboard5Component } from './dashboard5/dashboard5.component';
import { AppDashboard6Component } from './dashboard6/dashboard6.component';

export const DashboardsRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'dashboard1',
        component: AppDashboard1Component,
        data: {
          title: 'Dashboard 1',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Dashboard 1' },
          ],
        },
      },
      {
        path: 'dashboard2',
        component: AppDashboard2Component,
        data: {
          title: 'Dashboard 2',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Dashboard 2' },
          ],
        },
      },
      {
        path: 'dashboard3',
        component: AppDashboard3Component,
        data: {
          title: 'Dashboard 3',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Dashboard 3' },
          ],
        },
      },
      {
        path: 'dashboard4',
        component: AppDashboard4Component,
        data: {
          title: 'Dashboard 4',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Dashboard 4' },
          ],
        },
      },
      {
        path: 'dashboard5',
        component: AppDashboard5Component,
        data: {
          title: 'Dashboard 5',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Dashboard 5' },
          ],
        },
      },
      {
        path: 'dashboard6',
        component: AppDashboard6Component,
        data: {
          title: 'Dashboard 6',
          urls: [
            { title: 'Dashboard', url: '/dashboards/dashboard1' },
            { title: 'Dashboard 6' },
          ],
        },
      },
    ],
  },
];
