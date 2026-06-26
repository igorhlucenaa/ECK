import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../material.module';
import { ConfirmDialogService } from '../../../shared/confirm-dialog/confirm-dialog.service';

export interface ReportTemplateManageDialogData {
  templates: { id: string; name: string }[];
  onCreate: (name: string) => Promise<boolean>;
  onUpdate: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export interface ReportTemplateManageDialogResult {
  refresh: boolean;
  selectedTemplateId?: string;
}

@Component({
  selector: 'app-report-template-manage-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './report-template-manage-dialog.component.html',
  styleUrls: ['./report-template-manage-dialog.component.scss'],
})
export class ReportTemplateManageDialogComponent {
  nomeNovoTemplate = new FormControl('');
  selectedId = new FormControl('');
  busy = false;

  constructor(
    public dialogRef: MatDialogRef<ReportTemplateManageDialogComponent, ReportTemplateManageDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: ReportTemplateManageDialogData,
    private confirmDialog: ConfirmDialogService
  ) {}

  get selectedTemplateName(): string {
    return this.data.templates.find(t => t.id === this.selectedId.value)?.name || '';
  }

  async criarTemplate(): Promise<void> {
    const nome = (this.nomeNovoTemplate.value || '').trim();
    if (!nome || this.busy) return;

    this.busy = true;
    try {
      const ok = await this.data.onCreate(nome);
      if (ok) {
        this.nomeNovoTemplate.reset();
        this.closeWithRefresh();
      }
    } finally {
      this.busy = false;
    }
  }

  async atualizarTemplate(): Promise<void> {
    const id = this.selectedId.value;
    if (!id || this.busy) return;

    this.busy = true;
    try {
      const ok = await this.data.onUpdate(id);
      if (ok) {
        this.closeWithRefresh(id);
      }
    } finally {
      this.busy = false;
    }
  }

  async excluirTemplate(): Promise<void> {
    const id = this.selectedId.value;
    if (!id || this.busy) return;

    const nome = this.selectedTemplateName || id;
    const confirmado = await this.confirmDialog.confirmDelete(
      nome,
      'O template será removido permanentemente e não poderá ser recuperado.'
    );
    if (!confirmado) return;

    this.busy = true;
    try {
      const ok = await this.data.onDelete(id);
      if (ok) {
        this.selectedId.setValue('');
        this.closeWithRefresh();
      }
    } finally {
      this.busy = false;
    }
  }

  usarNoEditor(): void {
    const id = this.selectedId.value;
    if (!id) return;
    this.dialogRef.close({ refresh: false, selectedTemplateId: id });
  }

  fechar(): void {
    this.dialogRef.close({ refresh: false });
  }

  private closeWithRefresh(selectedTemplateId?: string): void {
    this.dialogRef.close({ refresh: true, selectedTemplateId });
  }
}
