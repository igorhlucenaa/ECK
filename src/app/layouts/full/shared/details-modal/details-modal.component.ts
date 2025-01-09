import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

@Component({
  selector: 'app-details-modal',
  template: `
    <h1 mat-dialog-title>{{ data.title }}</h1>
    <div mat-dialog-content>
      <p *ngFor="let item of data.items">{{ item }}</p>
    </div>
    <div mat-dialog-actions>
      <button mat-button (click)="close()">Fechar</button>
    </div>
  `,
  styleUrls: ['./details-modal.component.scss'],
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, CommonModule],
})
export class DetailsModalComponent {
  constructor(
    public dialogRef: MatDialogRef<DetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; items: string[] }
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}
