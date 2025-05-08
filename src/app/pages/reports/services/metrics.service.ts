import { Injectable } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';

export interface MetricConfig {
  name: string;
  type: 'media' | 'contagem' | 'percentual' | 'distribuicao' | 'ranking' | 'desvio';
  agruparPor: 'pergunta' | 'linha' | 'participante' | 'avaliador' | 'competencia' | 'valor';
  filtro?: {
    avaliador?: string;
    linha?: string;
    valor?: string;
    [key: string]: any;
  };
}

export interface MetricResult {
  x: string;
  y: number;
  extra?: any;
}

@Injectable({
  providedIn: 'root'
})
export class MetricsService {
  constructor(private firestore: Firestore) {}

  async getAssessmentResults(assessmentId: string) {
    const resultsRef = collection(this.firestore, `assessments/${assessmentId}/results`);
    const snapshot = await getDocs(resultsRef);
    return snapshot.docs.map(doc => doc.data());
  }

  async calculateMetric(assessmentId: string, config: MetricConfig): Promise<MetricResult[]> {
    const results = await this.getAssessmentResults(assessmentId);
    switch (config.type) {
      case 'media':
        return this.calculateAverage(results, config);
      case 'contagem':
        return this.calculateCount(results, config);
      case 'percentual':
        return this.calculatePercentage(results, config);
      case 'distribuicao':
        return this.calculateDistribution(results, config);
      case 'ranking':
        return this.calculateRanking(results, config);
      case 'desvio':
        return this.calculateStdDev(results, config);
      default:
        return [];
    }
  }

  // 1. Média
  private calculateAverage(results: any[], config: MetricConfig): MetricResult[] {
    const agrupamento = config.agruparPor;
    const medias: { [key: string]: number[] } = {};
    results.forEach(result => {
      const surveyData = result.surveyData || {};
      Object.entries(surveyData || {}).forEach(([pergunta, resposta]) => {
        if (agrupamento === 'pergunta') {
          if (!medias[pergunta]) medias[pergunta] = [];
          if (typeof resposta === 'object' && resposta !== null) {
            Object.values(resposta || {}).forEach((valor: any) => {
              const num = this.tryParseNumber(valor);
              if (num !== null) medias[pergunta].push(num);
            });
          } else {
            const num = this.tryParseNumber(resposta);
            if (num !== null) medias[pergunta].push(num);
          }
        }
        if (agrupamento === 'linha' && typeof resposta === 'object' && resposta !== null) {
          Object.entries(resposta || {}).forEach(([linha, valor]) => {
            if (!medias[linha]) medias[linha] = [];
            const num = this.tryParseNumber(valor);
            if (num !== null) medias[linha].push(num);
          });
        }
      });
      if (agrupamento === 'participante') {
        let soma = 0, count = 0;
        Object.values(surveyData || {}).forEach((resposta: any) => {
          if (typeof resposta === 'object' && resposta !== null) {
            Object.values(resposta || {}).forEach((valor: any) => {
              const num = this.tryParseNumber(valor);
              if (num !== null) { soma += num; count++; }
            });
          } else {
            const num = this.tryParseNumber(resposta);
            if (num !== null) { soma += num; count++; }
          }
        });
        if (count > 0) medias[result.participantId || 'participante'] = [soma / count];
      }
    });
    return Object.entries(medias).map(([x, arr]) => ({ x, y: arr.reduce((a, b) => a + b, 0) / arr.length }));
  }

  // 2. Contagem
  private calculateCount(results: any[], config: MetricConfig): MetricResult[] {
    const agrupamento = config.agruparPor;
    const counts: { [key: string]: number } = {};
    results.forEach(result => {
      const surveyData = result.surveyData || {};
      Object.entries(surveyData || {}).forEach(([pergunta, resposta]) => {
        if (agrupamento === 'pergunta') {
          counts[pergunta] = (counts[pergunta] || 0) + 1;
        }
        if (agrupamento === 'linha' && typeof resposta === 'object' && resposta !== null) {
          Object.keys(resposta || {}).forEach(linha => {
            counts[linha] = (counts[linha] || 0) + 1;
          });
        }
        if (agrupamento === 'valor' && typeof resposta === 'object' && resposta !== null) {
          Object.values(resposta || {}).forEach((valor: any) => {
            counts[valor] = (counts[valor] || 0) + 1;
          });
        }
      });
      if (agrupamento === 'participante') {
        const pid = result.participantId || 'participante';
        counts[pid] = (counts[pid] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([x, y]) => ({ x, y }));
  }

  // 3. Percentual
  private calculatePercentage(results: any[], config: MetricConfig): MetricResult[] {
    const total = results.length;
    const counts = this.calculateCount(results, config);
    return counts.map(item => ({ x: item.x, y: (item.y / total) * 100 }));
  }

  // 4. Distribuição (histograma)
  private calculateDistribution(results: any[], config: MetricConfig): MetricResult[] {
    const valores: number[] = [];
    results.forEach(result => {
      const surveyData = result.surveyData || {};
      Object.values(surveyData || {}).forEach((resposta: any) => {
        if (typeof resposta === 'object' && resposta !== null) {
          Object.values(resposta || {}).forEach((valor: any) => {
            const num = this.tryParseNumber(valor);
            if (num !== null) valores.push(num);
          });
        } else {
          const num = this.tryParseNumber(resposta);
          if (num !== null) valores.push(num);
        }
      });
    });
    // Exemplo de faixas: 1-2, 3-4, 5
    const faixas = { '1-2': 0, '3-4': 0, '5': 0 };
    valores.forEach(num => {
      if (num <= 2) faixas['1-2']++;
      else if (num <= 4) faixas['3-4']++;
      else faixas['5']++;
    });
    return Object.entries(faixas).map(([x, y]) => ({ x, y }));
  }

  // 5. Ranking
  private calculateRanking(results: any[], config: MetricConfig): MetricResult[] {
    // Ranking de participantes por média
    const medias = this.calculateAverage(results, { ...config, agruparPor: 'participante' });
    return medias.sort((a, b) => b.y - a.y).map((item, idx) => ({ ...item, extra: { rank: idx + 1 } }));
  }

  // 6. Desvio padrão
  private calculateStdDev(results: any[], config: MetricConfig): MetricResult[] {
    const agrupamento = config.agruparPor;
    const valores: { [key: string]: number[] } = {};
    results.forEach(result => {
      const surveyData = result.surveyData || {};
      Object.entries(surveyData || {}).forEach(([pergunta, resposta]) => {
        if (agrupamento === 'pergunta') {
          if (!valores[pergunta]) valores[pergunta] = [];
          if (typeof resposta === 'object' && resposta !== null) {
            Object.values(resposta || {}).forEach((valor: any) => {
              const num = this.tryParseNumber(valor);
              if (num !== null) valores[pergunta].push(num);
            });
          } else {
            const num = this.tryParseNumber(resposta);
            if (num !== null) valores[pergunta].push(num);
          }
        }
        if (agrupamento === 'linha' && typeof resposta === 'object' && resposta !== null) {
          Object.entries(resposta || {}).forEach(([linha, valor]) => {
            if (!valores[linha]) valores[linha] = [];
            const num = this.tryParseNumber(valor);
            if (num !== null) valores[linha].push(num);
          });
        }
      });
    });
    return Object.entries(valores).map(([x, arr]) => ({ x, y: this.stdDev(arr) }));
  }

  // Funções auxiliares
  private tryParseNumber(valor: any): number | null {
    if (typeof valor === 'number') return valor;
    if (typeof valor === 'string') {
      const num = parseFloat(valor.replace(/[^0-9.,-]/g, '').replace(',', '.'));
      return isNaN(num) ? null : num;
    }
    return null;
  }

  private stdDev(arr: number[]): number {
    if (!arr.length) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }
}
