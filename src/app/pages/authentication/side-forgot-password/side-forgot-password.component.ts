import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MaterialModule } from 'src/app/material.module';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

@Component({
  selector: 'app-side-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
  ],
  templateUrl: './side-forgot-password.component.html',
  styleUrls: ['../side-login/side-login.component.scss'],
})
export class AppSideForgotPasswordComponent {
  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  isSubmitting = false;
  currentYear = new Date().getFullYear();

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private translate: TranslateService
  ) {}

  get f() {
    return this.form.controls;
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }
    const email = (this.form.value.email || '').trim();
    this.isSubmitting = true;
    try {
      await this.authService.resetPassword(email);
      this.snackBar.open(
        this.translate.instant('auth.forgotPassword.emailSent'),
        this.translate.instant('Fechar'),
        { duration: 6000 }
      );
      await this.router.navigate(['/authentication/login']);
    } catch {
      this.snackBar.open(
        this.translate.instant('auth.forgotPassword.emailError'),
        this.translate.instant('Fechar'),
        { duration: 6000 }
      );
    } finally {
      this.isSubmitting = false;
    }
  }
}
