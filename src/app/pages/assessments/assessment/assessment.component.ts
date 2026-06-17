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
  QueryDocumentSnapshot,
} from '@angular/fire/firestore';
import { ProjectService } from 'src/app/services/project.service';

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
  activeLinkId: string | null = null;

  surveyCompleted = false;
  alreadyCompleted = false;
  linkCancelled = false;
  invalidToken = false;
  surveyEmpty = false;
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

  private resolveActiveLink(
    docs: QueryDocumentSnapshot[],
    token: string | null
  ): QueryDocumentSnapshot | null {
    if (token) {
      const match = docs.find((d) => d.data()['token'] === token);
      return match ?? null;
    }

    const pendingDoc = docs.find((d) => d.data()['status'] === 'pending');
    if (pendingDoc) return pendingDoc;

    const completedDoc = docs.find((d) => d.data()['status'] === 'completed');
    if (completedDoc) return completedDoc;

    const activeDoc = docs.find(
      (d) => !['cancelled', 'expired'].includes(d.data()['status'] || '')
    );
    return activeDoc ?? docs[0] ?? null;
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

    const activeDoc = this.resolveActiveLink(linkSnap.docs, this.token);
    if (!activeDoc) {
      this.invalidToken = true;
      return;
    }

    this.activeLinkId = activeDoc.id;
    const activeStatus: string = activeDoc.data()['status'] || '';

    if (activeStatus === 'expired') {
      this.showExpiredScreen = true;
      return;
    }

    if (activeStatus === 'cancelled') {
      const hasActive = linkSnap.docs.some(
        (d) => !['cancelled', 'expired'].includes(d.data()['status'] || '')
      );
      if (!hasActive) {
        this.linkCancelled = true;
        return;
      }
    }

    if (activeStatus === 'completed') {
      this.alreadyCompleted = true;
      return;
    }

    this.alreadyCompleted = await this.surveyService.checkIfAssessmentCompleted(
      assessmentId,
      participantId
    );

    if (this.alreadyCompleted) {
      return;
    }

    const linkDocRef = doc(this.firestore, 'assessmentLinks', activeDoc.id);
    this.linkUnsubscribe = onSnapshot(linkDocRef, (snap) => {
      const data = snap.data();
      if (
        data?.['status'] === 'expired' &&
        !this.formSubmitted &&
        !this.showMidFillExpiredModal
      ) {
        this.showMidFillExpiredModal = true;
      }
    });

    await this.loadSurvey(assessmentId, participantId, activeDoc);
  }

  private isSurveyJsonEmpty(surveyJSON: unknown): boolean {
    if (!surveyJSON || typeof surveyJSON !== 'object') return true;
    const json = surveyJSON as { pages?: Array<{ elements?: unknown[] }> };
    const pages = json.pages;
    if (!Array.isArray(pages) || pages.length === 0) return true;
    return pages.every(
      (page) => !Array.isArray(page.elements) || page.elements.length === 0
    );
  }

  async loadSurvey(
    assessmentId: string,
    participantId: string,
    activeLinkDoc: QueryDocumentSnapshot
  ): Promise<void> {
    const assessment: any = await this.surveyService.getAssessment(assessmentId);

    if (!assessment?.surveyJSON) {
      this.surveyEmpty = true;
      return;
    }

    if (this.isSurveyJsonEmpty(assessment.surveyJSON)) {
      this.surveyEmpty = true;
      return;
    }

    this.surveyJSON = assessment.surveyJSON;

    let surveyJSONFinal = this.surveyJSON;
    try {
      let avaliadoName = '';
      const participantRef = doc(this.firestore, `participants/${participantId}`);
      const participantSnap = await getDoc(participantRef);

      if (participantSnap.exists()) {
        const participantData = participantSnap.data();
        const participantType: string = participantData['type'] || '';

        if (participantType === 'avaliador') {
          const avaliadoId: string =
            activeLinkDoc.data()['avaliadoId'] ||
            participantData['avaliadoId'] ||
            '';
          if (avaliadoId) {
            const avaliadoSnap = await getDoc(
              doc(this.firestore, `participants/${avaliadoId}`)
            );
            if (avaliadoSnap.exists()) {
              avaliadoName =
                avaliadoSnap.data()['name'] || avaliadoSnap.data()['nome'] || '';
            }
          }
        } else {
          avaliadoName =
            participantData['name'] || participantData['nome'] || '';
        }
      }

      const jsonStr = JSON.stringify(surveyJSONFinal).replace(
        /\{\{nome_avaliado\}\}/g,
        avaliadoName
      );
      surveyJSONFinal = JSON.parse(jsonStr);
    } catch (e) {
      console.warn('Não foi possível substituir {{nome_avaliado}}:', e);
    }

    const theme: any = assessment['theme'];
    const survey = new Survey.Model(surveyJSONFinal);

    const browserLang = navigator.language?.split('-')[0]?.toLowerCase();
    const supportedLocales = ['pt', 'en', 'es'];
    survey.locale = supportedLocales.includes(browserLang) ? browserLang : 'pt';

    if (theme?.cssVariables) {
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
        this.linkUnsubscribe?.();

        await this.markLinkCompletedAndCheckProject();

        this.surveyCompleted = true;
      } catch (error) {
        console.error('Erro ao salvar conclusão:', error);
      }
    } else {
      console.warn('Faltam parâmetros para salvar a conclusão.');
    }
  }

  private async markLinkCompletedAndCheckProject(): Promise<void> {
    try {
      if (!this.activeLinkId) return;

      const linkDocRef = doc(this.firestore, 'assessmentLinks', this.activeLinkId);
      const linkSnap = await getDoc(linkDocRef);
      if (!linkSnap.exists()) return;

      const linkData = linkSnap.data();
      if (linkData['status'] !== 'pending') return;

      const projectId: string = linkData['projectId'] || '';

      await updateDoc(linkDocRef, {
        status: 'completed',
        completedAt: Timestamp.now(),
      });

      if (!projectId) return;

      const projectLinksSnap = await getDocs(
        query(
          collection(this.firestore, 'assessmentLinks'),
          where('projectId', '==', projectId)
        )
      );

      const sentStatuses = new Set(['pending', 'completed', 'expired']);
      const sentLinks = projectLinksSnap.docs.filter((d) =>
        sentStatuses.has(d.data()['status'] || '')
      );

      if (sentLinks.length === 0) return;

      const hasPending = sentLinks.some((d) => d.data()['status'] === 'pending');
      if (!hasPending) {
        await this.projectService.concludeProject(projectId, 'system');
      }
    } catch (error) {
      console.error('Erro ao registrar conclusão e verificar projeto:', error);
    }
  }
}
