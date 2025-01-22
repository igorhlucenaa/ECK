import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { AssessmentListComponent } from '../assessment-list/assessment-list.component';

@Component({
  selector: 'app-assessment-preview',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  templateUrl: './assessment-preview.component.html',
  styles: [
    `
      mat-dialog-content {
        font-size: 14px;
      }
      h3 {
        margin-top: 20px;
      }
      .container {
        width: 100%;
        margin: auto;
      }

      mat-form-field {
        margin-bottom: 15px;
      }

      .text-end {
        margin-top: 20px;
      }
    `,
  ],
})
export class AssessmentPreviewComponent {
  constructor(
    public dialogRef: MatDialogRef<AssessmentPreviewComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  closeDialog(): void {
    this.dialogRef.close();
  }
}
