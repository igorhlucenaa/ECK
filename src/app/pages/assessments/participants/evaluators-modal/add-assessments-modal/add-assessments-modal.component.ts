import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';

interface ModalData {
  availableAssessments: AssessmentDetail[];
}

interface AssessmentDetail {
  id: string;
  name: string;
  status: string; // 'Respondido' ou 'Pendente'
  linkSent: boolean; // Se o link foi enviado por e-mail
}

@Component({
  selector: 'app-add-assessments-modal',
  standalone: true,
  imports: [MaterialModule, CommonModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>Adicionar Avaliações</h2>
    <mat-dialog-content>
      <mat-form-field class="w-100">
        <mat-label>Selecione as Avaliações</mat-label>
        <mat-select formControlName="selectedAssessments" multiple>
          <mat-option
            *ngFor="let assessment of data.availableAssessments"
            [value]="assessment.id"
          >
            {{ assessment.name }}
          </mat-option>
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="confirm()">Adicionar</button>
      <button mat-button mat-dialog-close>Cancelar</button>
    </mat-dialog-actions>
  `,
  styleUrls: ['./add-assessments-modal.component.scss'],
})
export class AddAssessmentsModalComponent {
  assessmentForm: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<AddAssessmentsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ModalData,
    private fb: FormBuilder
  ) {
    this.assessmentForm = this.fb.group({
      selectedAssessments: [[], Validators.required],
    });
  }

  confirm(): void {
    if (this.assessmentForm.valid) {
      this.dialogRef.close({
        selectedAssessments: this.assessmentForm.get('selectedAssessments')
          ?.value,
      });
    }
  }
}
