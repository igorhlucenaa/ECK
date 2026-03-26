import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { SurveyModel } from 'survey-core';
import { SurveyModule } from 'survey-angular-ui';

@Component({
  selector: 'app-assessment-preview',
  standalone: true,
  imports: [MaterialModule, CommonModule, SurveyModule],
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

      .text-end {
        margin-top: 20px;
      }
    `,
  ],
})
export class AssessmentPreviewComponent implements OnInit {
  surveyModel: SurveyModel;

  constructor(
    public dialogRef: MatDialogRef<AssessmentPreviewComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {
    // Certifique-se de que 'data.surveyJSON' existe e contém JSON válido para o survey
    if (this.data.surveyJSON) {
      this.surveyModel = new SurveyModel(this.data.surveyJSON);
      this.surveyModel.locale = 'pt'; // Configura a localização se necessário
    }
  }

  closeDialog(): void {
    this.dialogRef.close();
  }
}
