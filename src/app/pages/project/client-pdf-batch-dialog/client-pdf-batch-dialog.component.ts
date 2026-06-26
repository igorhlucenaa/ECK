import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { MaterialModule } from 'src/app/material.module';
import { TranslateModule } from '@ngx-translate/core';

export interface ClientPdfBatchProjectItem {
  id: string;
  name: string;
  reportTemplateId?: string;
}

export interface ClientPdfBatchDialogData {
  clientId: string;
  clientName: string;
  projects: ClientPdfBatchProjectItem[];
}

export interface ClientPdfBatchProjectTemplate {
  projectId: string;
  templateId: string;
}

export interface ClientPdfBatchDialogResult {
  projectTemplates: ClientPdfBatchProjectTemplate[];
}

interface ReportTemplateOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-client-pdf-batch-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, TranslateModule],
  templateUrl: './client-pdf-batch-dialog.component.html',
  styleUrls: ['./client-pdf-batch-dialog.component.scss'],
})
export class ClientPdfBatchDialogComponent implements OnInit {
  reportTemplates: ReportTemplateOption[] = [];
  projectTemplateControls: Record<string, FormControl<string>> = {};
  isLoading = true;
  loadError = '';

  constructor(
    public dialogRef: MatDialogRef<ClientPdfBatchDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ClientPdfBatchDialogData,
    private firestore: Firestore
  ) {}

  get projectCount(): number {
    return this.data.projects.length;
  }

  ngOnInit(): void {
    void this.loadTemplates();
  }

  isLinkedTemplatePreselected(project: ClientPdfBatchProjectItem): boolean {
    const linked = project.reportTemplateId;
    if (!linked) return false;
    return this.projectTemplateControls[project.id]?.value === linked;
  }

  get canConfirm(): boolean {
    if (this.isLoading || this.reportTemplates.length === 0) return false;
    return this.data.projects.every(p => this.projectTemplateControls[p.id]?.valid);
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

      this.initProjectControls();
    } catch {
      this.loadError = 'Erro ao carregar templates de relatório.';
    } finally {
      this.isLoading = false;
    }
  }

  private initProjectControls(): void {
    this.projectTemplateControls = {};
    for (const project of this.data.projects) {
      this.projectTemplateControls[project.id] = new FormControl(
        this.resolveDefaultTemplate(project.reportTemplateId),
        { nonNullable: true, validators: [Validators.required] }
      );
    }
  }

  private resolveDefaultTemplate(linkedTemplateId?: string): string {
    if (linkedTemplateId && this.reportTemplates.some(t => t.id === linkedTemplateId)) {
      return linkedTemplateId;
    }
    if (this.reportTemplates.length === 1) {
      return this.reportTemplates[0].id;
    }
    return '';
  }

  confirm(): void {
    if (!this.canConfirm) return;

    this.dialogRef.close({
      projectTemplates: this.data.projects.map(project => ({
        projectId: project.id,
        templateId: this.projectTemplateControls[project.id].value,
      })),
    } satisfies ClientPdfBatchDialogResult);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
