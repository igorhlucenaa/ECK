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
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

export interface DuplicateTemplateDialogResult {
  name: string;
  clientId: string;
}

export interface DuplicateTemplateDialogData {
  suggestedName: string;
  clients: { id: string; name: string }[];
  allowClientSelection: boolean;
  initialClientId: string;
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
    MatSelectModule,
    MatIconModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'mailTemplates.duplicate.title' | translate }}</h2>
    <mat-dialog-content>
      <p class="mb-3">{{ 'mailTemplates.duplicate.intro' | translate }}</p>
      <mat-form-field appearance="outline" class="w-100">
        <mat-label>{{ 'Nome do template' | translate }}</mat-label>
        <input matInput [(ngModel)]="name" (keyup.enter)="confirm()" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="w-100" *ngIf="data.allowClientSelection">
        <mat-label>{{ 'Cliente' | translate }}</mat-label>
        <mat-icon matPrefix>business</mat-icon>
        <mat-select [(ngModel)]="selectedClientId">
          <mat-option [value]="globalClientValue">
            {{ 'mailTemplates.defaultClientLabel' | translate }}
          </mat-option>
          <mat-option *ngFor="let client of data.clients" [value]="client.id">
            {{ client.name }}
          </mat-option>
        </mat-select>
        <mat-hint>{{ 'mailTemplates.duplicate.clientHint' | translate }}</mat-hint>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'Cancelar' | translate }}</button>
      <button mat-flat-button color="primary" (click)="confirm()" [disabled]="!(name || '').trim()">
        {{ 'Duplicar' | translate }}
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
  selectedClientId: string;
  readonly globalClientValue = '';

  constructor(
    private dialogRef: MatDialogRef<
      DuplicateTemplateDialogComponent,
      DuplicateTemplateDialogResult | undefined
    >,
    @Inject(MAT_DIALOG_DATA) public data: DuplicateTemplateDialogData
  ) {
    this.name = data.suggestedName;
    this.selectedClientId = data.allowClientSelection
      ? data.initialClientId
      : data.initialClientId;
  }

  confirm(): void {
    const trimmed = (this.name || '').trim();
    if (!trimmed) {
      return;
    }
    this.dialogRef.close({
      name: trimmed,
      clientId: this.data.allowClientSelection
        ? this.selectedClientId
        : this.data.initialClientId,
    });
  }
}
