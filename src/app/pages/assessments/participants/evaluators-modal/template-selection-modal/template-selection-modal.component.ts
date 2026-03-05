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
  mailTemplates: MailTemplate[];
  assessments: string[];
}

interface MailTemplate {
  id: string;
  name: string;
  content: string;
  emailType: string;
  subject: string;
}

@Component({
  selector: 'app-template-selection-modal',
  standalone: true,
  imports: [MaterialModule, CommonModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>Selecionar Template de Convite</h2>
    <mat-dialog-content>
      <form [formGroup]="templateForm">
        <mat-form-field class="w-100">
          <mat-label>Escolha um Template</mat-label>
          <mat-select formControlName="template">
            <mat-option
              *ngFor="let template of data.mailTemplates"
              [value]="template.id"
            >
              {{ template.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="confirm()" [disabled]="!templateForm.valid">
        Confirmar
      </button>
      <button mat-button mat-dialog-close>Cancelar</button>
    </mat-dialog-actions>
  `,
  styleUrls: ['./template-selection-modal.component.scss'],
})
export class TemplateSelectionModalComponent {
  templateForm: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<TemplateSelectionModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ModalData,
    private fb: FormBuilder
  ) {
    this.templateForm = this.fb.group({
      template: ['', Validators.required],
    });
  }

  confirm(): void {
    if (this.templateForm.valid) {
      this.dialogRef.close({
        selectedTemplate: this.templateForm.get('template')?.value,
      });
    }
  }
}
