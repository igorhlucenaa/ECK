import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

@Component({
  selector: 'app-details-modal',
  template: `
    <div class="modal-header">
      <div class="modal-icon"><span class="modal-icon__dot"></span></div>
      <h2 class="modal-title">{{ data.title }}</h2>
      <button mat-icon-button class="modal-close" (click)="close()">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <div mat-dialog-content class="modal-body">
      <div class="item-list">
        <div class="item-row" *ngFor="let item of getItems()">
          <mat-icon class="item-icon">chevron_right</mat-icon>
          <span class="item-label">{{ item }}</span>
        </div>
        <div class="item-empty" *ngIf="getItems().length === 0">
          <mat-icon>inbox</mat-icon>
          <span>Nenhum item para exibir</span>
        </div>
      </div>
    </div>
    <div mat-dialog-actions class="modal-footer">
      <button mat-raised-button class="btn-close" (click)="close()">
        <mat-icon>check</mat-icon>
        Fechar
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 20px 16px;
      background: linear-gradient(135deg, #1B2D56 0%, #1B84FF 100%);
    }
    .modal-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: rgba(255,255,255,0.18);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .modal-icon__dot {
      width: 14px; height: 14px; border-radius: 50%;
      background: #fff; opacity: 0.9;
    }
    .modal-title {
      flex: 1; margin: 0;
      font-size: 16px; font-weight: 700; color: #fff;
    }
    .modal-close { color: rgba(255,255,255,0.8) !important; }
    .modal-body { padding: 16px 20px !important; min-width: 280px; max-height: 340px; }
    .item-list { display: flex; flex-direction: column; gap: 4px; }
    .item-row {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-radius: 10px; background: #f8faff;
      border: 1px solid #e8edf3;
    }
    .item-icon { font-size: 16px; width: 16px; height: 16px; color: #1B84FF; flex-shrink: 0; }
    .item-label { font-size: 14px; color: #1a1a2e; font-weight: 500; }
    .item-empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 32px 0; color: #94a3b8;
    }
    .item-empty mat-icon { font-size: 32px; width: 32px; height: 32px; opacity: 0.5; }
    .item-empty span { font-size: 13px; }
    .modal-footer { padding: 12px 20px !important; justify-content: flex-end !important; border-top: 1px solid #f1f5f9; }
    .btn-close {
      background: linear-gradient(135deg, #1B2D56, #1B84FF) !important;
      color: #fff !important; font-weight: 600; border-radius: 8px;
      height: 36px; display: flex; align-items: center; gap: 4px;
    }
    .btn-close mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `],
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, CommonModule],
})
export class DetailsModalComponent {
  constructor(
    public dialogRef: MatDialogRef<DetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: { title: string; items: string | string[] }
  ) {}

  close(): void {
    this.dialogRef.close();
  }

  getItems(): string[] {
    return Array.isArray(this.data.items) ? this.data.items : [this.data.items];
  }
}
