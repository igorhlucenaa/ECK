import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

export interface DuplicateAssessmentDialogData {
  sourceName: string;
  clients: { id: string; companyName: string }[];
}

@Component({
  selector: 'app-duplicate-assessment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'assessments.duplicate.title' | translate }}</h2>
    <mat-dialog-content>
      <p class="dup-hint">
        {{ 'assessments.duplicate.hint' | translate : { name: data.sourceName } }}
      </p>
      <mat-form-field appearance="outline" class="w-full">
        <mat-label>{{ 'assessments.duplicate.targetClient' | translate }}</mat-label>
        <mat-select name="targetClientId" [(ngModel)]="targetClientId">
          <mat-option *ngFor="let c of data.clients" [value]="c.id">
            {{ c.companyName }}
          </mat-option>
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'Cancelar' | translate }}</button>
      <button mat-flat-button color="primary" [disabled]="!targetClientId" (click)="confirm()">
        {{ 'assessments.duplicate.confirm' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .w-full {
        width: 100%;
        min-width: 280px;
      }
      .dup-hint {
        font-size: 13px;
        color: #64748b;
        margin: 0 0 12px;
      }
    `,
  ],
})
export class DuplicateAssessmentDialogComponent {
  targetClientId = '';

  constructor(
    private dialogRef: MatDialogRef<DuplicateAssessmentDialogComponent, string | undefined>,
    @Inject(MAT_DIALOG_DATA) public data: DuplicateAssessmentDialogData
  ) {}

  confirm(): void {
    if (!this.targetClientId) return;
    this.dialogRef.close(this.targetClientId);
  }
}
