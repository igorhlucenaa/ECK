import { Injectable } from '@angular/core';
import { Firestore, collection, getDocs, query, where, documentId } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  constructor(private firestore: Firestore) {}

  /**
   * Calcula média geral de uma avaliação
   */
  async getAverageRating(assessmentId: string): Promise<number> {
    try {
      const resultsRef = collection(this.firestore, `assessments/${assessmentId}/results`);
      const resultsSnap = await getDocs(resultsRef);

      let totalSum = 0;
      let totalCount = 0;

      resultsSnap.forEach(doc => {
        const data = doc.data();
        if (data['surveyData']) {
          Object.values(data['surveyData']).forEach((value: any) => {
            if (typeof value === 'number') {
              totalSum += value;
              totalCount++;
            }
          });
        }
      });

      return totalCount > 0 ? totalSum / totalCount : 0;
    } catch (error) {
      console.error('Erro ao calcular média:', error);
      return 0;
    }
  }

  /**
   * Obtém dados de desempenho por competência
   */
  async getCompetencyPerformance(assessmentId: string): Promise<Array<{name: string, value: number}>> {
    try {
      const resultsRef = collection(this.firestore, `assessments/${assessmentId}/results`);
      const resultsSnap = await getDocs(resultsRef);

      const competencyData: { [key: string]: { sum: number, count: number } } = {};

      resultsSnap.forEach(doc => {
        const data = doc.data();
        if (data['surveyData']) {
          Object.entries(data['surveyData']).forEach(([key, value]) => {
            // Assumindo que as chaves das competências seguem um padrão
            const competencyMatch = key.match(/competency_(.*)/);
            if (competencyMatch && typeof value === 'number') {
              const competencyName = competencyMatch[1].replace(/_/g, ' ');
              if (!competencyData[competencyName]) {
                competencyData[competencyName] = { sum: 0, count: 0 };
              }
              competencyData[competencyName].sum += value;
              competencyData[competencyName].count++;
            }
          });
        }
      });

      return Object.entries(competencyData).map(([name, data]) => ({
        name,
        value: data.count > 0 ? data.sum / data.count : 0
      }));
    } catch (error) {
      console.error('Erro ao obter desempenho por competência:', error);
      return [];
    }
  }

  /**
   * Obtém evolução temporal das avaliações
   */
  async getTimelineData(assessmentId: string): Promise<Array<{name: string, series: Array<{name: string, value: number}>}>> {
    try {
      const resultsRef = collection(this.firestore, `assessments/${assessmentId}/results`);
      const resultsSnap = await getDocs(resultsRef);

      const timelineData: { [key: string]: { [date: string]: { sum: number, count: number } } } = {};

      resultsSnap.forEach(doc => {
        const data = doc.data();
        if (data['surveyData'] && data['timestamp']) {
          const date = new Date(data['timestamp'].seconds * 1000).toISOString().split('T')[0];

          Object.entries(data['surveyData']).forEach(([key, value]) => {
            const competencyMatch = key.match(/competency_(.*)/);
            if (competencyMatch && typeof value === 'number') {
              const competencyName = competencyMatch[1].replace(/_/g, ' ');

              if (!timelineData[competencyName]) {
                timelineData[competencyName] = {};
              }
              if (!timelineData[competencyName][date]) {
                timelineData[competencyName][date] = { sum: 0, count: 0 };
              }

              timelineData[competencyName][date].sum += value;
              timelineData[competencyName][date].count++;
            }
          });
        }
      });

      return Object.entries(timelineData).map(([competencyName, dates]) => ({
        name: competencyName,
        series: Object.entries(dates).map(([date, data]) => ({
          name: date,
          value: data.count > 0 ? data.sum / data.count : 0
        }))
      }));
    } catch (error) {
      console.error('Erro ao obter dados temporais:', error);
      return [];
    }
  }

  /**
   * Obtém estatísticas gerais da avaliação
   */
  async getAssessmentStats(assessmentId: string): Promise<{
    totalResponses: number;
    completionRate: number;
    averageTimeMin: number;
    lastResponse: Date | null;
  }> {
    try {
      const resultsRef = collection(this.firestore, `assessments/${assessmentId}/results`);
      const resultsSnap = await getDocs(resultsRef);

      let totalResponses = 0;
      let completedResponses = 0;
      let totalTime = 0;
      let lastResponse: Date | null = null;

      resultsSnap.forEach(doc => {
        const data = doc.data();
        totalResponses++;

        if (data['completed']) completedResponses++;
        if (data['duration']) totalTime += data['duration'];

        const timestamp = data['timestamp']?.seconds ? new Date(data['timestamp'].seconds * 1000) : null;
        if (timestamp && (!lastResponse || timestamp > lastResponse)) {
          lastResponse = timestamp;
        }
      });

      return {
        totalResponses,
        completionRate: totalResponses > 0 ? (completedResponses / totalResponses) * 100 : 0,
        averageTimeMin: totalResponses > 0 ? totalTime / totalResponses / 60 : 0,
        lastResponse
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return {
        totalResponses: 0,
        completionRate: 0,
        averageTimeMin: 0,
        lastResponse: null
      };
    }
  }
}
