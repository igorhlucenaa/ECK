import { Component, Inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
// Importe o componente de preview real se existir, senão use um placeholder
// import { RelatorioPreviewComponent } from './relatorio-preview.component';

@Component({
  selector: 'app-relatorio-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    // RelatorioPreviewComponent, // descomente se existir
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <h2 mat-dialog-title style="display: flex; align-items: center; justify-content: space-between;">
      <span>Relatório de {{ data.participante.name }}</span>
      <button mat-icon-button (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
    </h2>
    <mat-dialog-content style="min-width: 700px; min-height: 400px; max-height: 70vh; overflow: auto;">
      <ng-container *ngIf="!loading; else loadingTpl">
        <!-- Aqui renderiza a prévia do relatório -->
        <!-- <app-relatorio-preview [participante]="data.participante" [template]="data.template"></app-relatorio-preview> -->
        <div style="padding: 32px; text-align: center; color: #888;">
          <mat-icon style="font-size: 48px;">description</mat-icon>
          <p>Pré-visualização do relatório para <b>{{ data.participante.name }}</b> usando o template <b>{{ data.template?.name }}</b>.</p>
          <p style="font-size: 13px;">(Aqui será renderizado o relatório real.)</p>
        </div>
      </ng-container>
      <ng-template #loadingTpl>
        <div style="display: flex; align-items: center; justify-content: center; height: 200px;">
          <mat-spinner></mat-spinner>
        </div>
      </ng-template>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" (click)="exportarPDF()">
        <mat-icon>picture_as_pdf</mat-icon>
        Exportar PDF
      </button>
    </mat-dialog-actions>
  `,
  styleUrls: []
})
export class RelatorioPreviewDialogComponent {
  loading = false;
  constructor(
    public dialogRef: MatDialogRef<RelatorioPreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { participante: any, template: any }
  ) {}

  exportarPDF() {
    // Aqui você pode chamar a lógica de exportação já existente
    // Por enquanto, apenas um log
    console.log('Exportar PDF para', this.data.participante);
  }
}
