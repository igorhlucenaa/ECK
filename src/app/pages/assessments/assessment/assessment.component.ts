import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as Survey from 'survey-angular';
import { SurveyService } from './survey.service';
import { CommonModule } from '@angular/common';
import {
  Firestore,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  collection,
} from '@angular/fire/firestore'; // Adicionado para acessar o Firestore diretamente, se necessário

// Defina a interface para o objeto Assessment retornado pelo SurveyService
interface Assessment {
  surveyJSON: any;
  ['theme']?: any; // Usando any para flexibilidade, pois ITheme pode não existir nessa versão
  // Adicione outros campos, se necessário (ex.: clientId, name, etc.)
}

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
    private surveyService: SurveyService,
    private firestore: Firestore // Injetei Firestore para atualizações diretas, se necessário
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
    const assessment: any = await this.surveyService.getAssessment(
      assessmentId
    );

    if (assessment && assessment.surveyJSON) {
      this.surveyJSON = assessment.surveyJSON;

      // Carregar o tema do atributo 'theme' do documento, se existir
      const theme: any = assessment['theme']; // Usando any para flexibilidade

      console.log('Tema carregado do Firestore:', theme); // Log para depuração

      const survey = new Survey.Model(this.surveyJSON);

      // Aplicar o tema salvo, se existir, com validação para versão 1.12.23
      if (theme && theme.cssVariables) {
        try {
          // Tentar aplicar as variáveis CSS diretamente
          Object.entries(theme.cssVariables).forEach(([key, value]) => {
            // Usar notação de colchetes para acessar setCssVariable, se existir
            if ('setCssVariable' in survey) {
              (survey as any)['setCssVariable'](key, value as string);
            } else {
              // Alternativa: aplicar via CSS dinâmico (se setCssVariable não existe)
              const style = document.createElement('style');
              style.textContent = `:root { ${key}: ${value}; }`;
              document.head.appendChild(style);
              console.warn(
                'Usando CSS dinâmico, pois setCssVariable não está disponível.'
              );
            }
          });

          // Tentar aplicar o tema, se suportado
          if ('theme' in survey) {
            survey['theme'] = theme; // Usar notação de colchetes
            console.log('Tema aplicado ao survey:', survey['theme']); // Log para depuração
          } else {
            console.warn(
              'Propriedade theme não suportada nesta versão do SurveyJS.'
            );
          }
        } catch (error) {
          console.error('Erro ao aplicar o tema:', error);
        }
      } else {
        console.warn('Nenhum tema ou cssVariables encontrado no documento.');
      }

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
        // Chama o método do SurveyService para completar a avaliação
        await this.surveyService.completeAssessment(
          this.assessmentId,
          this.participantId,
          this.token,
          surveyData
        );

        // Atualiza o status em assessmentLinks para 'completed'
        await this.updateAssessmentLinkStatus(
          this.assessmentId,
          this.participantId
        );

        this.surveyCompleted = true;
      } catch (error) {
        console.error('Erro ao salvar conclusão:', error);
      }
    } else {
      console.warn('Faltam parâmetros para salvar a conclusão.');
    }
  }

  // Método para atualizar o status em assessmentLinks
  private async updateAssessmentLinkStatus(
    assessmentId: string,
    participantId: string
  ): Promise<void> {
    try {
      const assessmentLinksQuery = query(
        collection(this.firestore, 'assessmentLinks'),
        where('assessmentId', '==', assessmentId),
        where('participantId', '==', participantId)
      );
      const snapshot = await getDocs(assessmentLinksQuery);

      if (!snapshot.empty) {
        const linkDoc = doc(
          this.firestore,
          'assessmentLinks',
          snapshot.docs[0].id
        );
        await updateDoc(linkDoc, {
          status: 'completed',
          completedAt: new Date(), // Opcional: adicionar timestamp de conclusão
        });
        console.log('Status de assessmentLink atualizado para "completed".');
      } else {
        console.warn('Nenhum document link encontrado para atualização.');
      }
    } catch (error) {
      console.error('Erro ao atualizar status em assessmentLinks:', error);
      throw error; // Repropaga o erro para tratamento no onSurveyCompleted
    }
  }
}
