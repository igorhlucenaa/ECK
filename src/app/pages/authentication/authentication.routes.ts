import { Routes } from "@angular/router";
import { AppBoxedForgotPasswordComponent } from "./boxed-forgot-password/boxed-forgot-password.component";
import { AppSideForgotPasswordComponent } from "./side-forgot-password/side-forgot-password.component";
import { AppSideLoginComponent } from "./side-login/side-login.component";
import { AppSideRegisterComponent } from "./side-register/side-register.component";

export const AuthenticationRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'login',
        component: AppSideLoginComponent, // Componente de login
      },
      {
        path: 'boxed-forgot-pwd',
        component: AppBoxedForgotPasswordComponent,
      },
      {
        path: 'side-forgot-pwd',
        component: AppSideForgotPasswordComponent,
      },
      {
        path: 'side-register',
        component: AppSideRegisterComponent,
      },
    ],
  },
];
