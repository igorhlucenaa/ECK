import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { MaterialModule } from 'src/app/material.module';
import { TranslateModule } from '@ngx-translate/core';

export type ProjectExportAction =
  | 'individualPdf'
  | 'batchPdf'
  | 'excelBase'
  | 'excelClient'
  | 'docx'
  | 'openReports';

export interface ProjectExportDialogData {
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  assessmentId?: string;
  reportTemplateId?: string;
  userRole: string;
}

export interface ProjectExportDialogResult {
  action: ProjectExportAction;
  templateId?: string;
}

interface ReportTemplateOption {
  id: string;
  name: string;
}

interface ExportOption {
  id: ProjectExportAction;
  icon: string;
  title: string;
  description: string;
  requiresTemplate: boolean;
  roles: string[];
}

@Component({
  selector: 'app-project-export-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, TranslateModule],
  templateUrl: './project-export-dialog.component.html',
  styleUrls: ['./project-export-dialog.component.scss'],
})
export class ProjectExportDialogComponent implements OnInit {
  templateControl = new FormControl<string>('', { nonNullable: true });
  selectedAction: ProjectExportAction = 'individualPdf';

  reportTemplates: ReportTemplateOption[] = [];
  isLoading = true;
  loadError = '';

  readonly exportOptions: ExportOption[] = [
    {
      id: 'individualPdf',
      icon: 'picture_as_pdf',
      title: 'PDF individual',
      description: 'Gera o relatório formatado do avaliado do projeto.',
      requiresTemplate: true,
      roles: ['admin_master', 'admin_client', 'viewer'],
    },
    /*
    {
      id: 'batchPdf',
      icon: 'archive',
      title: 'PDF em lote (ZIP)',
      description: 'Gera um PDF por avaliado e baixa tudo em um arquivo ZIP.',
      requiresTemplate: true,
      roles: ['admin_master', 'admin_client', 'viewer'],
    },
    */
    {
      id: 'excelBase',
      icon: 'grid_on',
      title: 'Base de respostas (Excel)',
      description: 'Planilha plana com todas as respostas do projeto.',
      requiresTemplate: false,
      roles: ['admin_master', 'admin_client'],
    },
    {
      id: 'excelClient',
      icon: 'table_view',
      title: 'Extrato do projeto (Excel)',
      description: 'Abas Resumo e Respostas com médias por competência.',
      requiresTemplate: false,
      roles: ['admin_master', 'admin_client'],
    },
    {
      id: 'docx',
      icon: 'description',
      title: 'Relatório formatado (DOCX)',
      description: 'Documento Word com layout do template (1 avaliado por vez).',
      requiresTemplate: true,
      roles: ['admin_master'],
    },
    {
      id: 'openReports',
      icon: 'open_in_new',
      title: 'Abrir tela de relatórios',
      description: 'Configurar seções, preview e exportações manualmente.',
      requiresTemplate: false,
      roles: ['admin_master', 'admin_client', 'viewer'],
    },
  ];

  constructor(
    public dialogRef: MatDialogRef<ProjectExportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProjectExportDialogData,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    void this.loadTemplates();
  }

  get visibleExportOptions(): ExportOption[] {
    return this.exportOptions.filter(o => o.roles.includes(this.data.userRole));
  }

  get selectedOption(): ExportOption | undefined {
    return this.visibleExportOptions.find(o => o.id === this.selectedAction);
  }

  /** Template vinculado ao projeto e encontrado na lista do cliente. */
  get linkedTemplate(): ReportTemplateOption | undefined {
    if (!this.data.reportTemplateId) return undefined;
    return this.reportTemplates.find(t => t.id === this.data.reportTemplateId);
  }

  /** Exibe seletor só quando PDF/DOCX precisam de template e o projeto não tem um válido. */
  get showTemplateField(): boolean {
    if (!this.templateRequiredForAction) return false;
    return !this.linkedTemplate;
  }

  get templateRequiredForAction(): boolean {
    return this.selectedOption?.requiresTemplate === true;
  }

  get canConfirm(): boolean {
    if (this.isLoading) return false;
    if (this.templateRequiredForAction && !this.resolvedTemplateId) return false;
    return !!this.selectedAction;
  }

  get resolvedTemplateId(): string {
    if (this.linkedTemplate) return this.linkedTemplate.id;
    return this.templateControl.value || '';
  }

  isExportOptionDisabled(opt: ExportOption): boolean {
    return opt.requiresTemplate && !this.resolvedTemplateId && this.reportTemplates.length === 0;
  }

  selectAction(action: ProjectExportAction): void {
    this.selectedAction = action;
  }

  private async loadTemplates(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      const snap = await getDocs(
        query(
          collection(this.firestore, 'reportTemplates'),
          where('clientId', '==', this.data.clientId)
        )
      );

      this.reportTemplates = snap.docs
        .map(d => ({
          id: d.id,
          name: d.data()['name'] || d.data()['nome'] || 'Template sem nome',
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      const defaultId = this.data.reportTemplateId || '';
      if (defaultId && this.reportTemplates.some(t => t.id === defaultId)) {
        this.templateControl.setValue(defaultId);
      } else if (this.reportTemplates.length === 1) {
        this.templateControl.setValue(this.reportTemplates[0].id);
      }

      if (this.templateRequiredForAction && this.showTemplateField) {
        this.templateControl.setValidators([Validators.required]);
      } else {
        this.templateControl.clearValidators();
      }
      this.templateControl.updateValueAndValidity({ emitEvent: false });
    } catch {
      this.loadError = 'Erro ao carregar templates de relatório.';
    } finally {
      this.isLoading = false;

      if (this.reportTemplates.length === 0) {
        const fallback = this.visibleExportOptions.find(o => !o.requiresTemplate);
        if (fallback) {
          this.selectedAction = fallback.id;
        }
      }
    }
  }

  confirm(): void {
    if (!this.canConfirm) return;

    const result: ProjectExportDialogResult = {
      action: this.selectedAction,
    };

    const templateId = this.resolvedTemplateId;
    if (templateId && (this.templateRequiredForAction || this.selectedAction === 'openReports')) {
      result.templateId = templateId;
    }

    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
