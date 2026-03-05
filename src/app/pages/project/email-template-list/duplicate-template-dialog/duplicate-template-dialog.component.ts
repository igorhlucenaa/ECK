import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

export interface DuplicateTemplateDialogData {
  suggestedName: string;
}

@Component({
  selector: 'app-duplicate-template-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Duplicar template</h2>
    <mat-dialog-content>
      <p class="mb-3">Defina o nome do novo template (copiado do original):</p>
      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Nome do template</mat-label>
        <input matInput [(ngModel)]="name" (keyup.enter)="confirm()" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" (click)="confirm()">
        Duplicar
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .w-100 {
        width: 100%;
      }
      .mb-3 {
        margin-bottom: 1rem;
      }
    `,
  ],
})
export class DuplicateTemplateDialogComponent {
  name: string;

  constructor(
    private dialogRef: MatDialogRef<DuplicateTemplateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DuplicateTemplateDialogData
  ) {
    this.name = data.suggestedName;
  }

  confirm(): void {
    const trimmed = (this.name || '').trim();
    this.dialogRef.close(trimmed || this.data.suggestedName);
  }
}
