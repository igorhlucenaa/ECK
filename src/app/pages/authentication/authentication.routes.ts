import { Routes } from "@angular/router";
import { AppSideForgotPasswordComponent } from "./side-forgot-password/side-forgot-password.component";
import { AppSideLoginComponent } from "./side-login/side-login.component";

export const AuthenticationRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'login',
        component: AppSideLoginComponent,
      },
      {
        path: 'forgot-password',
        component: AppSideForgotPasswordComponent,
      },
      {
        path: 'boxed-forgot-pwd',
        redirectTo: 'forgot-password',
        pathMatch: 'full',
      },
      {
        path: 'side-forgot-pwd',
        redirectTo: 'forgot-password',
        pathMatch: 'full',
      },
      {
        path: 'side-register',
        redirectTo: 'login',
        pathMatch: 'full',
      },
    ],
  },
];
