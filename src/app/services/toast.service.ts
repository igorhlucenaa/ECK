import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly DURATION = 4000;
  private readonly ACTION = 'Fechar';

  constructor(private snackBar: MatSnackBar) {}

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
    this.snackBar.open(message, this.ACTION, {
      duration,
      panelClass: ['app-toast', `app-toast--${type.replace('toast-', '')}`],
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }
}
