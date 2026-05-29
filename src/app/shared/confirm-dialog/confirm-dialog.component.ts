import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';

export interface ConfirmDialogData {
  title?: string;
  message?: string;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning';
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  get icon(): string {
    return this.data.type === 'warning' ? 'warning_amber' : 'delete_forever';
  }

  get confirmText(): string {
    return this.data.confirmText ?? 'Sim, excluir';
  }

  get cancelText(): string {
    return this.data.cancelText ?? 'Não, cancelar';
  }

  get title(): string {
    return this.data.title ?? 'Confirmar exclusão';
  }
}
