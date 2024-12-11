import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';

import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
@Component({
  selector: 'app-confirmation-dialog-delete',
  standalone: true,
  imports: [MatButtonModule,MatDialogModule],
  templateUrl: './confirmation-dialog-delete.component.html',
  styleUrl: './confirmation-dialog-delete.component.css'
})
export class ConfirmationDialogDeleteComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmationDialogDeleteComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { message: string }
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
