import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { ParticipantValidationService } from 'src/app/services/participant-validation.service';
import { getCargoSetorDisplay } from 'src/app/utils/participant-cargo.utils';

@Component({
  selector: 'app-participants-confirmation-dialog',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule],
  templateUrl: './participants-confirmation-dialog.component.html',
  styleUrls: ['./participants-confirmation-dialog.component.scss'],
})
export class ParticipantsConfirmationDialogComponent implements OnInit {
  displayedColumns = ['index', 'name', 'email', 'category', 'cargo'];

  selectedClientId: string;
  selectedProjectId: string;
  filteredProjects: { id: string; name: string; clientId: string }[] = [];
  evaluation: { id: string; name: string } | null = null;
  isLoadingEval = false;
  validationError: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<ParticipantsConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      participants: any[];
      clients: { id: string; name: string }[];
      projects: { id: string; name: string; clientId: string }[];
      preselectedClientId?: string;
      preselectedProjectId?: string;
      loadEvaluation: (projectId: string) => Promise<{ id: string; name: string } | null>;
    },
    private participantValidationService: ParticipantValidationService
  ) {
    this.selectedClientId = data.preselectedClientId || '';
    this.selectedProjectId = data.preselectedProjectId || '';
  }

  async ngOnInit(): Promise<void> {
    this.filteredProjects = this.selectedClientId
      ? this.data.projects.filter(p => p.clientId === this.selectedClientId)
      : [...this.data.projects];

    if (this.selectedProjectId) {
      await this.loadEval(this.selectedProjectId);
      // Executar validação quando o projeto já está pré-selecionado
      await this.onProjectChange();
    }
  }

  onClientChange(): void {
    this.selectedProjectId = '';
    this.evaluation = null;
    this.filteredProjects = this.selectedClientId
      ? this.data.projects.filter(p => p.clientId === this.selectedClientId)
      : [...this.data.projects];
  }

  async onProjectChange(): Promise<void> {
    this.evaluation = null;
    this.validationError = null;

    if (this.selectedProjectId) {
      await this.loadEval(this.selectedProjectId);

      const projectName = this.data.projects.find(p => p.id === this.selectedProjectId)?.name || 'projeto';

      // Valida o lote: >1 avaliado no arquivo OU arquivo só com avaliadores em projeto sem avaliado.
      const participantsWithProject = this.data.participants.map(p => ({
        ...p,
        projectId: this.selectedProjectId
      }));
      const excelValidation = await this.participantValidationService.validateExcelParticipants(
        participantsWithProject,
        this.selectedProjectId,
        projectName
      );

      if (!excelValidation.valid) {
        if (excelValidation.error) {
          this.validationError = excelValidation.error;
        } else if (excelValidation.errors.length > 0) {
          const error = excelValidation.errors[0];
          this.validationError = `O arquivo contém ${error.evaluateesCount} avaliados para o projeto "${projectName}". É permitido apenas um avaliado por projeto.`;
        }
        return;
      }
    }
  }

  private async loadEval(projectId: string): Promise<void> {
    this.isLoadingEval = true;
    try {
      this.evaluation = await this.data.loadEvaluation(projectId);
    } catch {
      this.evaluation = null;
    } finally {
      this.isLoadingEval = false;
    }
  }

  get isValid(): boolean {
    return !!this.selectedClientId && !!this.selectedProjectId && !this.validationError;
  }

  get countByType(): { avaliados: number; avaliadores: number } {
    return {
      avaliados: this.data.participants.filter(p => p.type === 'avaliado').length,
      avaliadores: this.data.participants.filter(p => p.type === 'avaliador').length,
    };
  }

  getParticipantCargoSetor(participant: { cargo?: string; setor?: string }): string {
    return getCargoSetorDisplay(participant.cargo, participant.setor);
  }

  confirmSelection(): void {
    if (!this.isValid) return;
    this.dialogRef.close({
      client: this.selectedClientId,
      project: this.selectedProjectId,
      evaluation: this.evaluation?.id || null,
    });
  }
}
