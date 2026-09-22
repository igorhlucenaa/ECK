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
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

@Component({
  selector: 'app-boxed-forgot-password',
  standalone: true,
  imports: [
    RouterModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    TranslateModule,
  ],
  templateUrl: './boxed-forgot-password.component.html',
})
export class AppBoxedForgotPasswordComponent {
  options = this.settings.getOptions();
  isSubmitting = false;

  constructor(
    private settings: CoreService,
    private router: Router,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private translate: TranslateService
  ) {}

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
  });

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
        { duration: 5000 }
      );
      void this.router.navigate(['/authentication/boxed-login']);
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
