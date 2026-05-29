import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as Survey from 'survey-angular';
import { SurveyService } from './survey.service';
import { CommonModule } from '@angular/common';
import {
  Firestore,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  collection,
  onSnapshot,
  Timestamp,
  updateDoc,
} from '@angular/fire/firestore';
import { ProjectService } from 'src/app/services/project.service';

interface Assessment {
  surveyJSON: any;
  ['theme']?: any;
}

@Component({
  selector: 'app-assessment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assessment.component.html',
  styleUrls: ['./assessment.component.scss'],
})
export class AssessmentComponent implements OnInit, OnDestroy {
  surveyJSON: any;
  token: string | null = null;
  participantId: string | null = null;
  assessmentId: string | null = null;

  surveyCompleted = false;
  alreadyCompleted = false;
  linkCancelled = false;
  showExpiredScreen = false;
  showMidFillExpiredModal = false;
  formSubmitted = false;

  private linkUnsubscribe: (() => void) | null = null;

  constructor(
    private route: ActivatedRoute,
    private surveyService: SurveyService,
    private firestore: Firestore,
    private projectService: ProjectService,
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

  ngOnDestroy(): void {
    this.linkUnsubscribe?.();
  }

  async checkAndLoadSurvey(
    assessmentId: string,
    participantId: string
  ): Promise<void> {
    const linkQuery = query(
      collection(this.firestore, 'assessmentLinks'),
      where('assessmentId', '==', assessmentId),
      where('participantId', '==', participantId)
    );
    const linkSnap = await getDocs(linkQuery);

    if (linkSnap.empty) {
      this.linkCancelled = true;
      return;
    }

    // Encontra o link mais relevante (prioritize: pending > completed > others)
    const docs = linkSnap.docs;
    const pendingDoc = docs.find(d => d.data()['status'] === 'pending');
    const completedDoc = docs.find(d => d.data()['status'] === 'completed');
    const activeDoc = pendingDoc ?? completedDoc ?? docs[0];
    const activeStatus: string = activeDoc.data()['status'];

    if (activeStatus === 'expired') {
      this.showExpiredScreen = true;
      return;
    }

    if (activeStatus === 'cancelled') {
      // Verifica se há algum link que não seja cancelled
      const hasActive = docs.some(d => !['cancelled', 'expired'].includes(d.data()['status']));
      if (!hasActive) {
        this.linkCancelled = true;
        return;
      }
    }

    this.alreadyCompleted = await this.surveyService.checkIfAssessmentCompleted(
      assessmentId,
      participantId
    );

    if (this.alreadyCompleted) {
      return;
    }

    // Listener em tempo real: exibe modal se link expirar durante o preenchimento
    const linkDocRef = doc(this.firestore, 'assessmentLinks', activeDoc.id);
    this.linkUnsubscribe = onSnapshot(linkDocRef, (snap) => {
      const data = snap.data();
      if (data?.['status'] === 'expired' && !this.formSubmitted && !this.showMidFillExpiredModal) {
        this.showMidFillExpiredModal = true;
      }
    });

    await this.loadSurvey(assessmentId, participantId);
  }

  async loadSurvey(assessmentId: string, participantId: string): Promise<void> {
    const assessment: any = await this.surveyService.getAssessment(assessmentId);

    if (assessment && assessment.surveyJSON) {
      this.surveyJSON = assessment.surveyJSON;

      // Substituir {{nome_avaliado}} pelo nome do avaliado correto
      let surveyJSONFinal = this.surveyJSON;
      try {
        let avaliadoName = '';

        const participantRef = doc(this.firestore, `participants/${participantId}`);
        const participantSnap = await getDoc(participantRef);

        if (participantSnap.exists()) {
          const participantData = participantSnap.data();
          const participantType: string = participantData['type'] || '';

          if (participantType === 'avaliador') {
            const linkQuery = query(
              collection(this.firestore, 'assessmentLinks'),
              where('participantId', '==', participantId),
              where('assessmentId', '==', assessmentId)
            );
            const linkSnap = await getDocs(linkQuery);
            if (!linkSnap.empty) {
              const avaliadoId: string = linkSnap.docs[0].data()['avaliadoId'] || '';
              if (avaliadoId) {
                const avaliadoSnap = await getDoc(doc(this.firestore, `participants/${avaliadoId}`));
                if (avaliadoSnap.exists()) {
                  avaliadoName = avaliadoSnap.data()['name'] || avaliadoSnap.data()['nome'] || '';
                }
              }
            }
          } else {
            avaliadoName = participantData['name'] || participantData['nome'] || '';
          }
        }

        const jsonStr = JSON.stringify(surveyJSONFinal)
          .replace(/\{\{nome_avaliado\}\}/g, avaliadoName);
        surveyJSONFinal = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('Não foi possível substituir {{nome_avaliado}}:', e);
      }

      const theme: any = assessment['theme'];
      const survey = new Survey.Model(surveyJSONFinal);

      const browserLang = navigator.language?.split('-')[0]?.toLowerCase();
      const supportedLocales = ['pt', 'en', 'es'];
      survey.locale = supportedLocales.includes(browserLang) ? browserLang : 'pt';

      if (theme && theme.cssVariables) {
        try {
          Object.entries(theme.cssVariables).forEach(([key, value]) => {
            if ('setCssVariable' in survey) {
              (survey as any)['setCssVariable'](key, value as string);
            } else {
              const style = document.createElement('style');
              style.textContent = `:root { ${key}: ${value}; }`;
              document.head.appendChild(style);
            }
          });

          if ('theme' in survey) {
            survey['theme'] = theme;
          }
        } catch (error) {
          console.error('Erro ao aplicar o tema:', error);
        }
      }

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
    }
  }

  async onSurveyCompleted(sender: Survey.SurveyModel): Promise<void> {
    const surveyData = sender.data;

    if (this.assessmentId && this.token && this.participantId) {
      try {
        await this.surveyService.completeAssessment(
          this.assessmentId,
          this.participantId,
          this.token,
          surveyData
        );

        this.formSubmitted = true;
        this.linkUnsubscribe?.(); // Para o listener — formulário já foi enviado

        await this.markLinkCompletedAndCheckProject(this.assessmentId, this.participantId);

        this.surveyCompleted = true;
      } catch (error) {
        console.error('Erro ao salvar conclusão:', error);
      }
    } else {
      console.warn('Faltam parâmetros para salvar a conclusão.');
    }
  }

  /**
   * 1. Marca o assessmentLink como completed.
   * 2. Verifica se todos os outros links do projeto (mesmo projectId) estão
   *    concluídos (completed, expired ou cancelled).
   * 3. Se sim → chama concludeProject('system') via ProjectService.
   */
  private async markLinkCompletedAndCheckProject(
    assessmentId: string,
    participantId: string
  ): Promise<void> {
    try {
      // Resolve o link ativo
      const linkQ = query(
        collection(this.firestore, 'assessmentLinks'),
        where('assessmentId', '==', assessmentId),
        where('participantId', '==', participantId),
        where('status', '==', 'pending')
      );
      const linkSnap = await getDocs(linkQ);
      if (linkSnap.empty) return;

      const linkDocRef = doc(this.firestore, 'assessmentLinks', linkSnap.docs[0].id);
      const projectId: string = linkSnap.docs[0].data()['projectId'] || '';

      // Marca o link como completed
      await updateDoc(linkDocRef, {
        status: 'completed',
        completedAt: Timestamp.now(),
      });

      if (!projectId) return;

      // Verifica se ainda há links pendentes no projeto
      const pendingQ = query(
        collection(this.firestore, 'assessmentLinks'),
        where('projectId', '==', projectId),
        where('status', '==', 'pending')
      );
      const pendingSnap = await getDocs(pendingQ);

      if (pendingSnap.empty) {
        // Todos responderam → conclui o projeto automaticamente
        await this.projectService.concludeProject(projectId, 'system');
      }
    } catch (error) {
      // Não bloqueia a tela de conclusão
      console.error('Erro ao registrar conclusão e verificar projeto:', error);
    }
  }
}
