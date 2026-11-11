import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../material.module';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogService } from '../../../shared/confirm-dialog/confirm-dialog.service';

export interface ReportTemplateManageDialogData {
  templates: { id: string; name: string }[];
  /** Cliente escolhido no topo da tela de Relatórios (destino da cópia). */
  targetClientName?: string;
  /** Admin master vê templates de todos os clientes só neste modal. */
  showTemplatesFromOtherClients?: boolean;
  onCreate: (name: string) => Promise<boolean>;
  onDuplicate: (sourceId: string, name: string) => Promise<string | null>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onListRefresh: () => Promise<{ id: string; name: string }[]>;
  onUpdate: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export interface ReportTemplateManageDialogResult {
  refresh: boolean;
  selectedTemplateId?: string;
}

function stripTemplateOptionSuffix(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim() || label;
}

@Component({
  selector: 'app-report-template-manage-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, TranslateModule],
  templateUrl: './report-template-manage-dialog.component.html',
  styleUrls: ['./report-template-manage-dialog.component.scss'],
})
export class ReportTemplateManageDialogComponent implements OnInit, OnDestroy {
  nomeNovoTemplate = new FormControl('');
  nomeDuplicata = new FormControl('');
  nomeRenomear = new FormControl('');
  selectedId = new FormControl('');
  busy = false;
  duplicateOkMessage = '';
  private destroy$ = new Subject<void>();
  private lastSelectedId = '';
  private duplicateBaseName = '';

  constructor(
    public dialogRef: MatDialogRef<ReportTemplateManageDialogComponent, ReportTemplateManageDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: ReportTemplateManageDialogData,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService
  ) {}

  get suggestedDuplicateName(): string {
    if (!this.duplicateBaseName) {
      return '';
    }
    return this.translate.instant('reportTemplates.manage.copyOfSuggestion', {
      name: this.duplicateBaseName,
    });
  }

  ngOnInit(): void {
    this.selectedId.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      this.duplicateOkMessage = '';
      if (!id) {
        this.nomeDuplicata.reset('');
        this.nomeRenomear.reset('');
        this.duplicateBaseName = '';
        this.lastSelectedId = '';
        return;
      }
      const label = this.data.templates.find((t) => t.id === id)?.name ?? '';
      const base = stripTemplateOptionSuffix(label);
      this.duplicateBaseName = base;
      if (id !== this.lastSelectedId) {
        this.nomeDuplicata.reset('');
        this.nomeRenomear.setValue(base);
        this.lastSelectedId = id;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get selectedTemplateName(): string {
    return this.data.templates.find(t => t.id === this.selectedId.value)?.name || '';
  }

  usarSugestaoDuplicata(): void {
    const suggestion = this.suggestedDuplicateName;
    if (suggestion) {
      this.nomeDuplicata.setValue(suggestion);
    }
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

  async duplicarTemplate(): Promise<void> {
    const id = this.selectedId.value;
    const nome = (this.nomeDuplicata.value || '').trim();
    if (!id || !nome || this.busy) return;

    this.busy = true;
    try {
      const newId = await this.data.onDuplicate(id, nome);
      if (newId) {
        this.data.templates = await this.data.onListRefresh();
        this.lastSelectedId = newId;
        this.selectedId.setValue(newId, { emitEvent: false });
        this.nomeRenomear.setValue(nome);
        this.nomeDuplicata.reset('');
        this.duplicateBaseName = '';
        this.duplicateOkMessage = this.translate.instant('reportTemplates.manage.duplicateOk');
        this.cdr.markForCheck();
      }
    } finally {
      this.busy = false;
    }
  }

  async salvarNomeTemplate(): Promise<void> {
    const id = this.selectedId.value;
    const nome = (this.nomeRenomear.value || '').trim();
    if (!id || !nome || this.busy) return;

    this.busy = true;
    try {
      const ok = await this.data.onRename(id, nome);
      if (ok) {
        this.data.templates = await this.data.onListRefresh();
        const row = this.data.templates.find((t) => t.id === id);
        if (row) {
          this.nomeRenomear.setValue(stripTemplateOptionSuffix(row.name));
        }
        this.duplicateOkMessage = '';
        this.cdr.markForCheck();
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
      this.translate.instant('reportTemplates.manage.deleteConfirmBody')
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
    this.dialogRef.close({ refresh: true, selectedTemplateId: id });
  }

  fechar(): void {
    this.dialogRef.close({ refresh: false });
  }

  concluir(): void {
    const id = this.selectedId.value || undefined;
    this.dialogRef.close({ refresh: true, selectedTemplateId: id });
  }

  private closeWithRefresh(selectedTemplateId?: string): void {
    this.dialogRef.close({ refresh: true, selectedTemplateId });
  }
}
