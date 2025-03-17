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
      <!-- Exibir Cliente como texto readonly -->
      <div class="mb-3">
        <mat-form-field class="w-100" appearance="outline">
          <mat-label>Cliente</mat-label>
          <input matInput [value]="data.clientName" readonly />
        </mat-form-field>
      </div>

      <!-- Exibir Projeto como texto readonly -->
      <div class="mb-3">
        <mat-form-field class="w-100" appearance="outline">
          <mat-label>Projeto</mat-label>
          <input matInput [value]="data.projectName" readonly />
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
      <button mat-flat-button color="primary" (click)="confirmSelection()">
        Confirmar
      </button>
    </div>
  `,
  styleUrls: ['./participants-confirmation-dialog.component.scss'],
})
export class ParticipantsConfirmationDialogComponent implements OnInit {
  displayedColumns = ['name', 'email'];
  evaluation: { id: string; name: string } | null = null;

  constructor(
    public dialogRef: MatDialogRef<ParticipantsConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      participants: any[];
      clientId: string; // Novo: ID do cliente
      clientName: string; // Novo: Nome do cliente
      projectId: string; // Novo: ID do projeto
      projectName: string; // Novo: Nome do projeto
      loadEvaluation: (projectId: string) => Promise<any>; // Manter para carregar a avaliação
    }
  ) {}

  async ngOnInit() {
    // Carregar a avaliação associada ao projectId fornecido
    if (this.data.projectId) {
      try {
        const evalResult = await this.data.loadEvaluation(this.data.projectId);
        this.evaluation = evalResult || null;
      } catch (error) {
        console.error('Erro ao carregar avaliação no modal:', error);
      }
    }
  }

  confirmSelection(): void {
    this.dialogRef.close({
      client: this.data.clientId, // Retorna o clientId fornecido
      project: this.data.projectId, // Retorna o projectId fornecido
      evaluation: this.evaluation?.id || null, // Retorna o ID da avaliação associada
    });
  }
}
