import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Firestore, collection, doc, getDoc, getDocs, query, where } from '@angular/fire/firestore';
import { MaterialModule } from 'src/app/material.module';
import { TranslateModule } from '@ngx-translate/core';

export type ProjectExportAction =
  | 'individualPdf'
  | 'batchPdf'
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
  imports: [CommonModule, MaterialModule, TranslateModule],
  templateUrl: './project-export-dialog.component.html',
  styleUrls: ['./project-export-dialog.component.scss'],
})
export class ProjectExportDialogComponent implements OnInit {
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
    private firestore: Firestore,
    private router: Router
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

  /** Template vinculado ao projeto (fixo na criação do projeto). */
  get linkedTemplate(): ReportTemplateOption | undefined {
    if (!this.data.reportTemplateId) return undefined;
    return this.reportTemplates.find(t => t.id === this.data.reportTemplateId);
  }

  get hasProjectTemplateId(): boolean {
    return !!this.data.reportTemplateId;
  }

  get projectTemplateMissing(): boolean {
    return this.hasProjectTemplateId && !this.linkedTemplate;
  }

  get projectNeedsTemplateSetup(): boolean {
    return !this.hasProjectTemplateId;
  }

  get templateRequiredForAction(): boolean {
    return this.selectedOption?.requiresTemplate === true;
  }

  get canConfirm(): boolean {
    if (this.isLoading) return false;
    const opt = this.selectedOption;
    if (!opt || this.isExportOptionDisabled(opt)) return false;
    return true;
  }

  get resolvedTemplateId(): string {
    return this.data.reportTemplateId || '';
  }

  isExportOptionDisabled(opt: ExportOption): boolean {
    if (!opt.requiresTemplate) return false;
    if (!this.hasProjectTemplateId) return true;
    return this.projectTemplateMissing;
  }

  selectAction(action: ProjectExportAction): void {
    const opt = this.visibleExportOptions.find(o => o.id === action);
    if (opt && this.isExportOptionDisabled(opt)) return;
    this.selectedAction = action;
  }

  editProject(): void {
    this.dialogRef.close();
    void this.router.navigate([`/projects/${this.data.projectId}/edit`], {
      queryParams: { clientId: this.data.clientId },
    });
  }

  private selectFirstEnabledAction(): void {
    const fallback = this.visibleExportOptions.find(o => !this.isExportOptionDisabled(o));
    if (fallback) {
      this.selectedAction = fallback.id;
    }
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

      if (this.data.reportTemplateId && !this.reportTemplates.some(t => t.id === this.data.reportTemplateId)) {
        try {
          const templateDoc = await getDoc(doc(this.firestore, 'reportTemplates', this.data.reportTemplateId));
          if (templateDoc.exists()) {
            this.reportTemplates.push({
              id: templateDoc.id,
              name: templateDoc.data()['name'] || templateDoc.data()['nome'] || 'Template sem nome',
            });
          }
        } catch {
          // Mantém aviso de template ausente no modal.
        }
      }

      if (this.projectNeedsTemplateSetup || this.projectTemplateMissing) {
        this.selectFirstEnabledAction();
      }
    } catch {
      this.loadError = 'Erro ao carregar templates de relatório.';
    } finally {
      this.isLoading = false;
      if (this.projectNeedsTemplateSetup || this.projectTemplateMissing) {
        this.selectFirstEnabledAction();
      }
    }
  }

  confirm(): void {
    if (!this.canConfirm) return;

    const result: ProjectExportDialogResult = {
      action: this.selectedAction,
    };

    const templateId = this.resolvedTemplateId;
    if (templateId && this.templateRequiredForAction) {
      result.templateId = templateId;
    }

    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
