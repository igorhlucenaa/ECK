import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface EditParticipantDialogData {
  name: string;
  email: string;
}

export interface EditParticipantDialogResult {
  name: string;
  email: string;
}

@Component({
  selector: 'app-edit-participant-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './edit-participant-dialog.component.html',
  styleUrls: ['./edit-participant-dialog.component.scss'],
})
export class EditParticipantDialogComponent {
  name: string;
  email: string;

  constructor(
    public dialogRef: MatDialogRef<EditParticipantDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditParticipantDialogData
  ) {
    this.name = data.name;
    this.email = data.email;
  }

  get isValid(): boolean {
    return this.name.trim().length > 0 && this.email.trim().length > 0;
  }

  confirm(): void {
    if (!this.isValid) return;
    this.dialogRef.close({ name: this.name.trim(), email: this.email.trim() });
  }
}
