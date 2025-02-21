import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as Survey from 'survey-angular';
import { SurveyService } from './survey.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-assessment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assessment.component.html',
  styleUrls: ['./assessment.component.scss'],
})
export class AssessmentComponent implements OnInit {
  surveyJSON: any;
  token: string | null = null;
  participantId: string | null = null;
  assessmentId: string | null = null;
  surveyCompleted = false;
  alreadyCompleted = false;

  constructor(
    private route: ActivatedRoute,
    private surveyService: SurveyService
  ) {}

  ngOnInit(): void {
    this.assessmentId = this.route.snapshot.queryParamMap.get('assessment');
    this.token = this.route.snapshot.queryParamMap.get('token');
    this.participantId = this.route.snapshot.queryParamMap.get('participant');

    if (this.assessmentId && this.participantId) {
      this.checkAndLoadSurvey(this.assessmentId, this.participantId);
    } else {
      console.error('ID da avaliação ou participantId não fornecido na URL.');
    }
  }

  async checkAndLoadSurvey(
    assessmentId: string,
    participantId: string
  ): Promise<void> {
    this.alreadyCompleted = await this.surveyService.checkIfAssessmentCompleted(
      assessmentId,
      participantId
    );

    if (this.alreadyCompleted) {
      console.log('Bloqueando carregamento: avaliação já concluída.');
      return;
    }

    await this.loadSurvey(assessmentId, participantId);
  }

  async loadSurvey(assessmentId: string, participantId: string): Promise<void> {
    const assessment = await this.surveyService.getAssessment(assessmentId);

    if (assessment && assessment.surveyJSON) {
      this.surveyJSON = assessment.surveyJSON;

      const survey = new Survey.Model(this.surveyJSON);

      // Carrega progresso anterior, se houver
      const existingData = await this.surveyService.getAssessmentProgress(
        assessmentId,
        participantId
      );
      if (existingData) {
        survey.data = existingData;
      }

      survey.onValueChanged.add(this.onValueChanged.bind(this));
      survey.onComplete.add(this.onSurveyCompleted.bind(this));

      survey.render('surveyContainer');
    } else {
      console.error('Avaliação inválida ou surveyJSON não encontrado.');
    }
  }

  async onValueChanged(sender: Survey.SurveyModel): Promise<void> {
    const surveyData = sender.data;
    console.log('Resposta alterada:', surveyData);

    if (this.assessmentId && this.token && this.participantId) {
      try {
        await this.surveyService.saveAssessmentProgress(
          this.assessmentId,
          this.participantId,
          this.token,
          surveyData
        );
      } catch (error) {
        console.error('Erro ao salvar progresso:', error);
      }
    } else {
      console.warn('Faltam parâmetros para salvar o progresso.');
    }
  }

  async onSurveyCompleted(sender: Survey.SurveyModel): Promise<void> {
    const surveyData = sender.data;
    console.log('Survey completed:', surveyData);

    if (this.assessmentId && this.token && this.participantId) {
      try {
        await this.surveyService.completeAssessment(
          this.assessmentId,
          this.participantId,
          this.token,
          surveyData
        );
        this.surveyCompleted = true;
      } catch (error) {
        console.error('Erro ao salvar conclusão:', error);
      }
    } else {
      console.warn('Faltam parâmetros para salvar a conclusão.');
    }
  }
}
