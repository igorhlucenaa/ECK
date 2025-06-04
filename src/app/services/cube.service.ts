import { Injectable } from '@angular/core';
import { CubeClient } from '@cubejs-client/ngx';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

// Essa é uma URL de exemplo - você precisará configurar o servidor Cube.js
// e substituir pela URL correta
const API_URL = 'http://localhost:4000/cubejs-api/v1';

@Injectable({
  providedIn: 'root'
})
export class CubeService {
  private cubeApi: CubeClient;
  private token = '';

  constructor(private http: HttpClient) {
    // Inicializar o cliente Cube.js
    this.initCubeClient();
  }

  private async initCubeClient() {
    // Em produção, você vai querer obter esse token do seu backend
    // por questões de segurança
    this.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1OTQ2NjE1NjZ9.qzH2EiVhyvoaRPGuZQpJlTnvqQK7PVqwgHuLbWL-Rbo';

    this.cubeApi = new CubeClient({
      apiUrl: API_URL,
      headers: {
        Authorization: this.token
      }
    });
  }

  /**
   * Obtém o cliente Cube.js
   */
  getClient(): CubeClient {
    return this.cubeApi;
  }

  /**
   * Executa uma consulta no Cube.js
   * @param query Objeto de consulta para o Cube.js
   */
  async executeQuery(query: any) {
    try {
      const resultSet = await this.cubeApi.load(query);
      return resultSet;
    } catch (error) {
      console.error('Erro ao executar consulta no Cube.js:', error);
      throw error;
    }
  }

  /**
   * Carrega dados de avaliações agrupados por competência
   */
  async getCompetencyAnalysis(assessmentId: string) {
    const query = {
      measures: ['Assessments.averageRating'],
      dimensions: [
        'Assessments.competencyName',
        'Assessments.category',
      ],
      filters: [
        {
          member: 'Assessments.assessmentId',
          operator: 'equals',
          values: [assessmentId]
        }
      ],
      timeDimensions: []
    };

    return this.executeQuery(query);
  }

  /**
   * Carrega detalhes de questões específicas
   */
  async getQuestionDetails(assessmentId: string, questionName: string) {
    const query = {
      measures: ['Assessments.responseCount', 'Assessments.averageRating'],
      dimensions: [
        'Assessments.questionName',
        'Assessments.category'
      ],
      filters: [
        {
          member: 'Assessments.assessmentId',
          operator: 'equals',
          values: [assessmentId]
        },
        {
          member: 'Assessments.questionName',
          operator: 'equals',
          values: [questionName]
        }
      ]
    };

    return this.executeQuery(query);
  }

  /**
   * Obtém distribuição de respostas para uma questão específica
   */
  async getResponseDistribution(assessmentId: string, questionName: string) {
    const query = {
      measures: ['Assessments.responseCount'],
      dimensions: [
        'Assessments.rating',
        'Assessments.category'
      ],
      filters: [
        {
          member: 'Assessments.assessmentId',
          operator: 'equals',
          values: [assessmentId]
        },
        {
          member: 'Assessments.questionName',
          operator: 'equals',
          values: [questionName]
        }
      ]
    };

    return this.executeQuery(query);
  }
}
