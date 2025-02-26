import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { MatDialog } from '@angular/material/dialog';
import { AssessmentResponsesModalComponent } from './assessment-responses-modal/assessment-responses-modal.component'; // Importe o novo componente
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

interface Participant {
  id: string;
  name: string;
  email: string;
  sentAt?: Date; // Data de envio do e-mail
  completedAt?: Date; // Data de resposta do usuário
}

@Component({
  selector: 'app-participant-responses-modal',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  template: `
    <h2 mat-dialog-title>
      Participantes que Responderam: {{ data.assessmentName }}
    </h2>
    <mat-dialog-content>
      <table
        mat-table
        [dataSource]="data.participants"
        class="mat-elevation-z8 w-100"
      >
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Nome</th>
          <td mat-cell *matCellDef="let participant">{{ participant.name }}</td>
        </ng-container>
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>E-mail</th>
          <td mat-cell *matCellDef="let participant">
            {{ participant.email }}
          </td>
        </ng-container>
        <ng-container matColumnDef="sentAt">
          <th mat-header-cell *matHeaderCellDef>Data de Envio</th>
          <td mat-cell *matCellDef="let participant">
            {{ participant.sentAt | date : 'short' }}
          </td>
        </ng-container>
        <ng-container matColumnDef="completedAt">
          <th mat-header-cell *matHeaderCellDef>Data de Resposta</th>
          <td mat-cell *matCellDef="let participant">
            {{ participant.completedAt | date : 'short' }}
          </td>
        </ng-container>
        <ng-container matColumnDef="viewResponses">
          <th mat-header-cell *matHeaderCellDef>Ver Respostas</th>
          <td mat-cell *matCellDef="let participant">
            <button
              mat-icon-button
              color="primary"
              matTooltip="Ver Respostas"
              (click)="viewParticipantResponses(participant.id)"
            >
              <mat-icon>visibility</mat-icon>
            </button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
      </table>
      <mat-dialog-actions align="end">
        <button mat-button (click)="dialogRef.close()">Fechar</button>
      </mat-dialog-actions>
    </mat-dialog-content>
  `,
  styleUrls: ['./participant-responses-modal.component.scss'],
})
export class ParticipantResponsesModalComponent {
  displayedColumns: string[] = [
    'name',
    'email',
    'sentAt',
    'completedAt',
    'viewResponses',
  ]; // Adicionei 'viewResponses'

  constructor(
    public dialogRef: MatDialogRef<ParticipantResponsesModalComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      participants: Participant[];
      assessmentName: string;
      assessmentId: string;
    }, // Adicionei assessmentId
    private dialog: MatDialog,
    private firestore: Firestore
  ) {
    console.log('Dados recebidos no modal:', this.data);
  }

  async viewParticipantResponses(participantId: string): Promise<void> {
    try {
      // Usar o assessmentId passado no data
      const assessmentId = this.data.assessmentId;
      if (!assessmentId) {
        console.error('assessmentId não encontrado para o participante.');
        return;
      }

      // Buscar os dados da avaliação e as respostas do participante
      const assessmentRef = doc(this.firestore, `assessments/${assessmentId}`);
      const assessmentSnap = await getDoc(assessmentRef);
      if (!assessmentSnap.exists()) {
        console.error('Avaliação não encontrada.');
        return;
      }

      const assessmentData = assessmentSnap.data();
      const surveyJSON = assessmentData['surveyJSON'];
      const assessmentName = assessmentData['name'] || 'Avaliação';

      // Buscar os dados das respostas do participante
      const resultRef = doc(
        this.firestore,
        `assessments/${assessmentId}/results/${participantId}`
      );
      const resultSnap = await getDoc(resultRef);
      if (!resultSnap.exists()) {
        console.error('Respostas do participante não encontradas.');
        return;
      }

      const surveyData = resultSnap.data()['surveyData'];

      // Abrir o modal de visualização em tela cheia
      this.dialog.open(AssessmentResponsesModalComponent, {
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        panelClass: 'full-screen-modal', // Classe CSS para estilizar como tela cheia
        data: {
          assessmentId,
          participantId,
          surveyData,
          assessmentName,
        },
      });
    } catch (error) {
      console.error('Erro ao carregar respostas do participante:', error);
    }
  }
}
