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
  styleUrls: ['./assessment-preview.component.scss'],
})
export class AssessmentPreviewComponent implements OnInit {
  surveyModel: SurveyModel;

  constructor(
    public dialogRef: MatDialogRef<AssessmentPreviewComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {
    if (this.data.surveyJSON) {
      this.surveyModel = new SurveyModel(this.data.surveyJSON);
      this.surveyModel.locale = '';  // compatível com títulos em texto puro e localizados
      this.surveyModel.showCompletedPage = false;
      // Impede envio real — apenas fecha o dialog ao concluir
      this.surveyModel.onComplete.add(() => this.dialogRef.close());
    }
  }

  closeDialog(): void {
    this.dialogRef.close();
  }
}
