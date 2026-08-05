import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly DURATION = 4000;

  constructor(private snackBar: MatSnackBar, private translate: TranslateService) {}

  success(message: string, duration = this.DURATION) {
    this.show(message, 'toast-success', duration);
  }

  error(message: string, duration = this.DURATION) {
    this.show(message, 'toast-error', duration);
  }

  warning(message: string, duration = this.DURATION) {
    this.show(message, 'toast-warning', duration);
  }

  info(message: string, duration = this.DURATION) {
    this.show(message, 'toast-info', duration);
  }

  private show(message: string, type: string, duration: number) {
    this.snackBar.open(message, this.translate.instant('Fechar'), {
      duration,
      panelClass: ['app-toast', `app-toast--${type.replace('toast-', '')}`],
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }
}
