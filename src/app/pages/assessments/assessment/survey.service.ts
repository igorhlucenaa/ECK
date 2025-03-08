import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { Assessment } from './assessment.model';

@Injectable({
  providedIn: 'root',
})
export class SurveyService {
  constructor(private firestore: Firestore) {}

  async getAssessment(assessmentId: string): Promise<Assessment | null> {
    try {
      const assessmentRef = doc(this.firestore, `assessments/${assessmentId}`);
      const docSnap = await getDoc(assessmentRef);

      if (!docSnap.exists()) {
        console.warn(`Nenhuma avaliação encontrada com ID: ${assessmentId}`);
        return null;
      }

      return docSnap.data() as Assessment;
    } catch (error) {
      console.error('Erro ao obter avaliação:', error);
      return null;
    }
  }

  async saveAssessmentProgress(
    assessmentId: string,
    participantId: string,
    token: string,
    surveyData: any
  ): Promise<void> {
    try {
      const resultRef = doc(
        this.firestore,
        `assessments/${assessmentId}/results/${participantId}`
      );
      await setDoc(
        resultRef,
        {
          token,
          participantId,
          surveyData,
          lastUpdatedAt: new Date(),
          clientId: (await this.getAssessment(assessmentId))?.clientId || null,
        },
        { merge: true }
      );
          } catch (error) {
      console.error('Erro ao salvar progresso:', error);
      throw error;
    }
  }

  async completeAssessment(
    assessmentId: string,
    participantId: string,
    token: string,
    surveyData: any
  ): Promise<void> {
    try {
      const resultRef = doc(
        this.firestore,
        `assessments/${assessmentId}/results/${participantId}`
      );
      await setDoc(
        resultRef,
        {
          token,
          participantId,
          surveyData,
          completedAt: new Date(),
          clientId: (await this.getAssessment(assessmentId))?.clientId || null,
        },
        { merge: true }
      );
          } catch (error) {
      console.error('Erro ao salvar conclusão da avaliação:', error);
      throw error;
    }
  }

  async checkIfAssessmentCompleted(
    assessmentId: string,
    participantId: string
  ): Promise<boolean> {
    try {
      const resultRef = doc(
        this.firestore,
        `assessments/${assessmentId}/results/${participantId}`
      );
      const resultSnap = await getDoc(resultRef);

      if (resultSnap.exists() && resultSnap.data()?.['completedAt']) {
                return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao verificar conclusão da avaliação:', error);
      return false; // Assume não concluído em caso de erro
    }
  }

  async getAssessmentProgress(
    assessmentId: string,
    participantId: string
  ): Promise<any | null> {
    try {
      const resultRef = doc(
        this.firestore,
        `assessments/${assessmentId}/results/${participantId}`
      );
      const resultSnap = await getDoc(resultRef);

      if (resultSnap.exists() && resultSnap.data()?.['surveyData']) {
        console.log(
          'Carregando progresso anterior:',
          resultSnap.data()['surveyData']
        );
        return resultSnap.data()['surveyData'];
      }
      return null;
    } catch (error) {
      console.error('Erro ao carregar progresso da avaliação:', error);
      return null;
    }
  }
}
