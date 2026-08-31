import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../material.module';
import { TranslateModule } from '@ngx-translate/core';
import {
  ClientExportProjectOption,
  ReportClientExportService,
} from '../../../services/report-client-export.service';

export interface ClientExportDialogData {
  clients: { id: string; name: string }[];
  preselectedClientId?: string;
  releasedOnly?: boolean;
}

export interface ClientExportDialogResult {
  clientId: string;
  clientName: string;
  projectIds: string[];
  includeInactive: boolean;
}

@Component({
  selector: 'app-client-export-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule],
  templateUrl: './client-export-dialog.component.html',
  styleUrls: ['./client-export-dialog.component.scss'],
})
export class ClientExportDialogComponent implements OnInit {
  selectedClientId = '';
  projects: ClientExportProjectOption[] = [];
  selectedProjectIds = new Set<string>();
  includeInactive = false;
  loadingProjects = false;
  loadError = '';

  constructor(
    public dialogRef: MatDialogRef<ClientExportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ClientExportDialogData,
    private exportService: ReportClientExportService
  ) {}

  ngOnInit(): void {
    this.selectedClientId =
      this.data.preselectedClientId || this.data.clients[0]?.id || '';
    if (this.selectedClientId) {
      void this.onClientChange();
    }
  }

  get allProjectsSelected(): boolean {
    return this.projects.length > 0 && this.selectedProjectIds.size === this.projects.length;
  }

  get selectedCount(): number {
    return this.selectedProjectIds.size;
  }

  async onClientChange(): Promise<void> {
    this.projects = [];
    this.selectedProjectIds.clear();
    this.loadError = '';

    if (!this.selectedClientId) return;

    this.loadingProjects = true;
    try {
      this.projects = await this.exportService.loadProjectsForClient(
        this.selectedClientId,
        this.includeInactive
      );
      this.projects.forEach(p => this.selectedProjectIds.add(p.id));
    } catch {
      this.loadError = 'Erro ao carregar projetos deste cliente.';
    } finally {
      this.loadingProjects = false;
    }
  }

  async onIncludeInactiveChange(): Promise<void> {
    await this.onClientChange();
  }

  toggleProject(projectId: string, checked: boolean): void {
    if (checked) {
      this.selectedProjectIds.add(projectId);
    } else {
      this.selectedProjectIds.delete(projectId);
    }
  }

  toggleAllProjects(checked: boolean): void {
    this.selectedProjectIds.clear();
    if (checked) {
      this.projects.forEach(p => this.selectedProjectIds.add(p.id));
    }
  }

  confirm(): void {
    const client = this.data.clients.find(c => c.id === this.selectedClientId);
    if (!client || this.selectedProjectIds.size === 0) return;

    this.dialogRef.close({
      clientId: client.id,
      clientName: client.name,
      projectIds: Array.from(this.selectedProjectIds),
      includeInactive: this.includeInactive,
    } satisfies ClientExportDialogResult);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
