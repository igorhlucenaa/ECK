import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import {
  FormGroup,
  FormControl,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { MaterialModule } from 'src/app/material.module';
import { NgIf } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';


@Component({
  selector: 'app-side-login',
  standalone: true,
  imports: [
    RouterModule,
    MaterialModule,
    NgIf,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
  ],
  templateUrl: './side-login.component.html',
  styleUrls: ['./side-login.component.scss'],
})
export class AppSideLoginComponent {
  options = this.settings.getOptions();
  form = new FormGroup({
    uname: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
    ]),
    rememberMe: new FormControl(false),
  });

  errorMessage: string = '';
  isLoading: boolean = false;
  hidePassword = true;
  currentYear = new Date().getFullYear();

  constructor(
    private settings: CoreService,
    private authService: AuthService,
    private router: Router,
    private translate: TranslateService
  ) {}

  get f() {
    return this.form.controls;
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage = this.translate.instant('auth.login.fillFieldsError');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { uname, password, rememberMe } = this.form.value;

    try {
      await this.authService.login(uname!, password!, !!rememberMe);
    } catch (error: any) {
      this.errorMessage = this.getFriendlyLoginError(error);
    } finally {
      this.isLoading = false;
    }
  }

  private getFriendlyLoginError(error: any): string {
    const code: string = error?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return this.translate.instant('auth.login.error.invalidCredential');
      case 'auth/invalid-email':
        return this.translate.instant('auth.login.error.invalidEmail');
      case 'auth/user-disabled':
        return this.translate.instant('auth.login.error.userDisabled');
      case 'auth/too-many-requests':
        return this.translate.instant('auth.login.error.tooManyRequests');
      case 'auth/network-request-failed':
        return this.translate.instant('auth.login.error.network');
      default:
        return this.translate.instant('auth.login.error.generic');
    }
  }
}
