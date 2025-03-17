import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import * as Survey from 'survey-angular';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

interface ResponseData {
  assessmentId: string;
  participantId: string;
  surveyData: any; // Dados das respostas do usuário
  assessmentName: string; // Nome da avaliação para exibição
}

@Component({
  selector: 'app-assessment-responses-modal',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  template: `
    <h2 mat-dialog-title style="text-align: center; margin-bottom: 20px">
      Respostas do Participante - {{ data.assessmentName }}
    </h2>
    <mat-dialog-content style="height: calc(100vh - 200px); overflow: auto;">
      <div
        id="responsesContainer"
        style="width: 100%; max-width: 800px; margin: 0 auto;"
      ></div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Fechar</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-container {
        max-width: 100vw !important;
        max-height: 100vh !important;
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      mat-dialog-content {
        padding: 20px !important;
      }
    `,
  ],
})
export class AssessmentResponsesModalComponent implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<AssessmentResponsesModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ResponseData,
    private firestore: Firestore
  ) {
    
  }

  async ngOnInit(): Promise<void> {
    await this.loadAndRenderResponses();
  }

  async loadAndRenderResponses(): Promise<void> {
    try {
      // Buscar os dados da avaliação (surveyJSON) pelo assessmentId
      const assessmentRef = doc(
        this.firestore,
        `assessments/${this.data.assessmentId}`
      );
      const assessmentSnap = await getDoc(assessmentRef);

      if (!assessmentSnap.exists()) {
        console.error('Avaliação não encontrada.');
        return;
      }

      const assessmentData = assessmentSnap.data();
      const surveyJSON = assessmentData['surveyJSON'];

      if (!surveyJSON) {
        console.error('surveyJSON não encontrado na avaliação.');
        return;
      }

      // Buscar os dados das respostas do participante
      const responseData = this.data.surveyData;

      // Criar uma instância do Survey em modo de visualização (read-only)
      const survey = new Survey.Model(surveyJSON);
      survey.mode = 'display'; // Modo de visualização (read-only)
      survey.data = responseData; // Carregar as respostas do usuário

      // Desabilitar todas as interações
      survey.onValueChanging.add((sender, options) => {
        options.value = options.oldValue; // Impede alterações
      });
      survey.onValueChanged.add((sender) => {
        // Não permite salvar ou editar
      });

      // Renderizar o survey no container
      survey.render('responsesContainer');
    } catch (error) {
      console.error('Erro ao carregar e renderizar as respostas:', error);
    }
  }
}
