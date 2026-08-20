import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import {
  formatCargoSetorForInput,
  parseCargoSetorInput,
} from 'src/app/utils/participant-cargo.utils';

export interface EditParticipantDialogData {
  name: string;
  email: string;
  category: string;
  type: 'avaliado' | 'avaliador';
  cargo?: string;
  setor?: string;
  canSelectAvaliado: boolean;
  existingEvaluateeName?: string;
}

export interface EditParticipantDialogResult {
  name: string;
  email: string;
  category: string;
  type: 'avaliado' | 'avaliador';
  cargo?: string;
}

export const PARTICIPANT_CATEGORIES = [
  'Avaliado',
  'Gestor',
  'Par',
  'Subordinado',
  'Outros',
] as const;

@Component({
  selector: 'app-edit-participant-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule],
  templateUrl: './edit-participant-dialog.component.html',
  styleUrls: ['./edit-participant-dialog.component.scss'],
})
export class EditParticipantDialogComponent {
  name: string;
  email: string;
  category: string;
  cargoSetor: string;
  readonly categoryOptions = PARTICIPANT_CATEGORIES;
  readonly canSelectAvaliado: boolean;
  readonly existingEvaluateeName?: string;

  constructor(
    public dialogRef: MatDialogRef<EditParticipantDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditParticipantDialogData
  ) {
    this.name = data.name;
    this.email = data.email;
    this.category = data.category || (data.type === 'avaliado' ? 'Avaliado' : '');
    this.cargoSetor = formatCargoSetorForInput(data.cargo, data.setor);
    this.canSelectAvaliado = data.canSelectAvaliado;
    this.existingEvaluateeName = data.existingEvaluateeName;
  }

  get isValid(): boolean {
    const email = this.email.trim();
    return (
      this.name.trim().length > 0 &&
      email.length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      this.category.trim().length > 0 &&
      this.cargoSetor.trim().length > 0
    );
  }

  confirm(): void {
    if (!this.isValid) return;
    const category = this.category.trim();
    const parsed = parseCargoSetorInput(this.cargoSetor);
    this.dialogRef.close({
      name: this.name.trim(),
      email: this.email.trim(),
      category,
      type: category === 'Avaliado' ? 'avaliado' : 'avaliador',
      ...parsed,
    });
  }
}
