import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-participants-confirmation-dialog',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule],
  template: `
    <h1 mat-dialog-title>Confirmar Participantes</h1>
    <div mat-dialog-content>
      <div class="mb-3">
        <mat-form-field class="w-100" appearance="outline">
          <mat-label>Selecionar Cliente</mat-label>
          <mat-select
            [(ngModel)]="selectedClient"
            (selectionChange)="loadProjects()"
          >
            <mat-option *ngFor="let client of data.clients" [value]="client.id">
              {{ client.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div class="mb-3">
        <mat-form-field class="w-100" appearance="outline">
          <mat-label>Selecionar Projeto</mat-label>
          <mat-select
            [(ngModel)]="selectedProject"
            (selectionChange)="loadEvaluation()"
            [disabled]="!selectedClient"
          >
            <mat-option *ngFor="let project of projects" [value]="project.id">
              {{ project.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Exibir a avaliação associada ao projeto (opcional, apenas para feedback visual) -->
      <div class="mb-3" *ngIf="evaluation">
        <mat-form-field class="w-100" appearance="outline">
          <mat-label>Avaliação Associada</mat-label>
          <input matInput [value]="evaluation.name" readonly />
        </mat-form-field>
      </div>

      <table mat-table [dataSource]="data.participants" class="w-100">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Nome</th>
          <td mat-cell *matCellDef="let participant">{{ participant.name }}</td>
        </ng-container>

        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>Email</th>
          <td mat-cell *matCellDef="let participant">
            {{ participant.email }}
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
      </table>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(null)">Cancelar</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!selectedClient || !selectedProject"
        (click)="confirmSelection()"
      >
        Confirmar
      </button>
    </div>
  `,
  styleUrls: ['./participants-confirmation-dialog.component.scss'],
})
export class ParticipantsConfirmationDialogComponent implements OnInit {
  displayedColumns = ['name', 'email'];
  selectedClient: string | null = null;
  selectedProject: string | null = null;
  projects: { id: string; name: string }[] = [];
  evaluation: { id: string; name: string } | null = null; // Avaliação associada ao projeto

  constructor(
    public dialogRef: MatDialogRef<ParticipantsConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      participants: any[];
      clients: { id: string; name: string }[];
      loadProjects: (clientId: string) => Promise<any>;
      loadEvaluation: (projectId: string) => Promise<any>;
    }
  ) {}

  ngOnInit(): void {}

  loadProjects(): void {
    if (this.selectedClient) {
      this.data
        .loadProjects(this.selectedClient)
        .then((projects: any) => {
          this.projects = projects;
          this.selectedProject = null; // Limpa o projeto ao mudar o cliente
          this.evaluation = null; // Limpa a avaliação
        })
        .catch((error: any) =>
          console.error('Erro ao carregar projetos no modal:', error)
        );
    } else {
      this.projects = [];
      this.selectedProject = null;
      this.evaluation = null;
    }
  }

  loadEvaluation(): void {
    if (this.selectedProject) {
      this.data
        .loadEvaluation(this.selectedProject)
        .then((evaluation: any) => {
          this.evaluation = evaluation; // Carrega a avaliação associada ao projeto
        })
        .catch((error: any) =>
          console.error('Erro ao carregar avaliação no modal:', error)
        );
    } else {
      this.evaluation = null;
    }
  }

  confirmSelection(): void {
    this.dialogRef.close({
      client: this.selectedClient,
      project: this.selectedProject,
      evaluation: this.evaluation?.id || null, // Passa o ID da avaliação associada
    });
  }
}
