import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-export-dialog',
  standalone: true,
  imports: [FormsModule, MaterialModule, CommonModule],
  templateUrl: './export-dialog.component.html',
})
export class ExportDialogComponent {
  selectedTable: { key: string; label: string } | null = null;
  selectedFormat: string = '';

  constructor(
    public dialogRef: MatDialogRef<ExportDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: { availableTables: { key: string; label: string }[] }
  ) {}

  confirm(): void {
    // Retorna os dados selecionados para o componente pai
    this.dialogRef.close({
      selectedTable: this.selectedTable,
      selectedFormat: this.selectedFormat,
    });
  }

  cancel(): void {
    // Fecha o modal sem realizar nenhuma ação
    this.dialogRef.close();
  }
}
