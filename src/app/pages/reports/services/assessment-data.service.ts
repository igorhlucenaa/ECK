import { Injectable } from '@angular/core';
import { Firestore, collection, getDocs, query, where, orderBy, doc, getDoc, collectionGroup } from '@angular/fire/firestore';
import { Observable, from, map, switchMap, of, forkJoin, tap } from 'rxjs';
import { AuthService } from '../../../pages/auth/services/auth.service';

export interface Assessment {
  id: string;
  name: string;
  projectId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  surveyJSON?: any;
  clientId?: string;
  expireDate?: Date;
  credits?: number;
}

export interface AssessmentData {
  id: string;
  participantId: string;
  participantName: string;
  surveyData: {
    [key: string]: any;
  };
  createdAt: Date;
  role?: string; // Tipo de avaliador (Gestor, Par, Liderado, etc)
  department?: string;
  position?: string;
  level?: string;
}

export interface Client {
  id: string;
  name: string;
  logo?: string;
  colorScheme?: any;
  credits?: number;
  creditExpiration?: Date;
  active?: boolean;
}

export interface ProjectUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'supervisor' | 'viewer';
  projectId: string;
  clientId: string;
}

interface TableRow {
  id: string;
  participantId: string;
  participantName: string;
  createdAt: Date;
  [key: string]: any;
}

interface QuestionInfo {
  title: string;
  type: string;
  options: any[];
  rows?: any[];
  columns?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class AssessmentDataService {
  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {
    console.log('AssessmentDataService inicializado');
  }

  // Métodos para Assessments
  getAssessments(): Observable<Assessment[]> {
    console.log('getAssessments chamado');
    return this.authService.user.pipe(
      tap(user => console.log('Usuário atual:', user)),
      switchMap(user => {
        if (!user) {
          console.log('Nenhum usuário encontrado');
          return of([]);
        }

        console.log('Role do usuário:', user.role);

        if (user.role === 'admin') {
          console.log('Buscando todas as avaliações como admin');
          const assessmentsRef = collection(this.firestore, 'assessments');
          const q = query(assessmentsRef, orderBy('createdAt', 'desc'));

          return from(getDocs(q)).pipe(
            tap(snapshot => console.log('Quantidade de avaliações encontradas:', snapshot.docs.length)),
            map(snapshot =>
              snapshot.docs.map(doc => {
                const data = doc.data();
                console.log('Dados da avaliação:', doc.id, data);
                return {
                  id: doc.id,
                  name: data['name'] || 'Avaliação sem nome',
                  projectId: data['projectId'] || '',
                  clientId: data['clientId'] || '',
                  status: data['status'] || 'Pendente',
                  createdAt: this.convertTimestamp(data['createdAt']),
                  updatedAt: this.convertTimestamp(data['updatedAt']),
                  surveyJSON: data['surveyJSON'] || {},
                  expireDate: this.convertTimestamp(data['expireDate']),
                  credits: data['credits'] || 0
                } as Assessment;
              })
            )
          );
        } else if (user.role === 'client-admin') {
          console.log('Buscando avaliações do cliente:', user.clientId);
          const assessmentsRef = collection(this.firestore, 'assessments');
          const q = query(assessmentsRef,
            where('clientId', '==', user.clientId),
            orderBy('createdAt', 'desc')
          );

          return from(getDocs(q)).pipe(
            tap(snapshot => console.log('Quantidade de avaliações do cliente encontradas:', snapshot.docs.length)),
            map(snapshot =>
              snapshot.docs.map(doc => {
                const data = doc.data();
                console.log('Dados da avaliação do cliente:', doc.id, data);
                return {
                  id: doc.id,
                  name: data['name'] || 'Avaliação sem nome',
                  projectId: data['projectId'] || '',
                  clientId: data['clientId'] || '',
                  status: data['status'] || 'Pendente',
                  createdAt: this.convertTimestamp(data['createdAt']),
                  updatedAt: this.convertTimestamp(data['updatedAt']),
                  surveyJSON: data['surveyJSON'] || {},
                  expireDate: this.convertTimestamp(data['expireDate']),
                  credits: data['credits'] || 0
                } as Assessment;
              })
            )
          );
        } else if (user.role === 'project-manager' || user.role === 'project-supervisor' || user.role === 'project-viewer') {
          console.log('Buscando avaliações dos projetos do usuário:', user.uid);
          const userProjectsRef = collection(this.firestore, 'projectUsers');
          const q = query(userProjectsRef, where('userId', '==', user.uid));

          return from(getDocs(q)).pipe(
            tap(snapshot => console.log('Projetos do usuário encontrados:', snapshot.docs.length)),
            switchMap(snapshot => {
              const projectIds = snapshot.docs.map(doc => doc.data()['projectId']);
              console.log('IDs dos projetos:', projectIds);

              if (projectIds.length === 0) {
                console.log('Nenhum projeto encontrado para o usuário');
                return of([]);
              }

              const assessmentsRef = collection(this.firestore, 'assessments');
              const projectsQuery = query(assessmentsRef, where('projectId', 'in', projectIds));

              return from(getDocs(projectsQuery)).pipe(
                tap(snapshot => console.log('Quantidade de avaliações dos projetos encontradas:', snapshot.docs.length)),
                map(snapshot =>
                  snapshot.docs.map(doc => {
                    const data = doc.data();
                    console.log('Dados da avaliação do projeto:', doc.id, data);
                    return {
                      id: doc.id,
                      name: data['name'] || 'Avaliação sem nome',
                      projectId: data['projectId'] || '',
                      clientId: data['clientId'] || '',
                      status: data['status'] || 'Pendente',
                      createdAt: this.convertTimestamp(data['createdAt']),
                      updatedAt: this.convertTimestamp(data['updatedAt']),
                      surveyJSON: data['surveyJSON'] || {},
                      expireDate: this.convertTimestamp(data['expireDate']),
                      credits: data['credits'] || 0
                    } as Assessment;
                  })
                )
              );
            })
          );
        }

        console.log('Usuário sem permissões adequadas');
        return of([]);
      }),
      tap(assessments => console.log('Avaliações retornadas:', assessments.length))
    );
  }

  getAssessmentsByProject(projectId: string): Observable<Assessment[]> {
    const assessmentsRef = collection(this.firestore, 'assessments');
    const q = query(assessmentsRef, where('projectId', '==', projectId), orderBy('createdAt', 'desc'));

    return from(getDocs(q)).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data()['name'] || 'Avaliação sem nome',
          projectId: doc.data()['projectId'] || '',
          clientId: doc.data()['clientId'] || '',
          status: doc.data()['status'] || 'Pendente',
          createdAt: this.convertTimestamp(doc.data()['createdAt']),
          updatedAt: this.convertTimestamp(doc.data()['updatedAt']),
          surveyJSON: doc.data()['surveyJSON'] || {},
          expireDate: this.convertTimestamp(doc.data()['expireDate']),
          credits: doc.data()['credits'] || 0
        }) as Assessment)
      )
    );
  }

  getAssessmentsByClient(clientId: string): Observable<Assessment[]> {
    const assessmentsRef = collection(this.firestore, 'assessments');
    const q = query(assessmentsRef, where('clientId', '==', clientId), orderBy('createdAt', 'desc'));

    return from(getDocs(q)).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data()['name'] || 'Avaliação sem nome',
          projectId: doc.data()['projectId'] || '',
          clientId: doc.data()['clientId'] || '',
          status: doc.data()['status'] || 'Pendente',
          createdAt: this.convertTimestamp(doc.data()['createdAt']),
          updatedAt: this.convertTimestamp(doc.data()['updatedAt']),
          surveyJSON: doc.data()['surveyJSON'] || {},
          expireDate: this.convertTimestamp(doc.data()['expireDate']),
          credits: doc.data()['credits'] || 0
        }) as Assessment)
      )
    );
  }

  getAssessmentDetail(assessmentId: string): Observable<Assessment> {
    const assessmentRef = doc(this.firestore, `assessments/${assessmentId}`);

    return from(getDoc(assessmentRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data['name'] || 'Avaliação sem nome',
            projectId: data['projectId'] || '',
            clientId: data['clientId'] || '',
            status: data['status'] || 'Pendente',
            createdAt: this.convertTimestamp(data['createdAt']),
            updatedAt: this.convertTimestamp(data['updatedAt']),
            surveyJSON: data['surveyJSON'] || {},
            expireDate: this.convertTimestamp(data['expireDate']),
            credits: data['credits'] || 0
          } as Assessment;
        } else {
          throw new Error('Avaliação não encontrada');
        }
      })
    );
  }

  getAssessmentData(assessmentId: string): Observable<AssessmentData[]> {
    // Aqui buscamos os resultados na subcollection `results` dentro da avaliação
    const resultsRef = collection(this.firestore, `assessments/${assessmentId}/results`);
    const q = query(resultsRef);

    return from(getDocs(q)).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            participantId: data['participantId'] || '',
            participantName: data['participantName'] || 'Sem nome',
            surveyData: data['surveyData'] || {},
            role: data['role'] || '',
            department: data['department'] || '',
            position: data['position'] || '',
            level: data['level'] || '',
            createdAt: this.convertTimestamp(data['createdAt'])
          } as AssessmentData;
        })
      )
    );
  }

  getAssessmentQuestions(assessmentId: string): Observable<Record<string, QuestionInfo>> {
    return this.getAssessmentDetail(assessmentId).pipe(
      map(assessment => {
        if (assessment.surveyJSON) {
          // Extrai as perguntas do JSON da pesquisa
          return this.extractQuestionsFromSurvey(assessment.surveyJSON);
        }
        return {} as Record<string, QuestionInfo>;
      })
    );
  }

  // Métodos para processamento de dados
  processDataForTable(data: AssessmentData[]): TableRow[] {
    if (!data || data.length === 0) return [];

    // Transforma os dados para formato tabular
    return data.map(item => {
      // Cria um objeto base com informações do participante
      const baseRow: TableRow = {
        id: item.id,
        participantId: item.participantId,
        participantName: item.participantName,
        role: item.role || '',
        department: item.department || '',
        position: item.position || '',
        level: item.level || '',
        createdAt: item.createdAt
      };

      // Adiciona todas as respostas do questionário como colunas
      const surveyData = item.surveyData || {};

      Object.keys(surveyData).forEach(key => {
        // Se o valor for um objeto (ex: matriz de respostas), o convertemos para uma string
        if (typeof surveyData[key] === 'object') {
          baseRow[`pergunta_${key}`] = JSON.stringify(surveyData[key]);
        } else {
          baseRow[`pergunta_${key}`] = surveyData[key];
        }
      });

      return baseRow;
    });
  }

  getTableColumns(data: TableRow[]): string[] {
    if (!data || data.length === 0) return [];

    // Retorna todas as colunas do primeiro item (assumindo que todos têm as mesmas colunas)
    return Object.keys(data[0]);
  }

  // Métodos para processamento específico para relatórios 360°
  process360Data(data: AssessmentData[]): any {
    if (!data || data.length === 0) return null;

    // Agrupa os resultados por tipo de avaliador (role)
    const roleGroups: { [key: string]: AssessmentData[] } = {
      'autoavaliacao': [],
      'gestor': [],
      'pares': [],
      'liderados': [],
      'outros': []
    };

    data.forEach(item => {
      let role = item.role?.toLowerCase() || '';

      // Mapeia os roles para as categorias padronizadas
      if (role.includes('auto') || role === 'self') {
        roleGroups['autoavaliacao'].push(item);
      } else if (role.includes('gestor') || role.includes('manager')) {
        roleGroups['gestor'].push(item);
      } else if (role.includes('par') || role.includes('peer')) {
        roleGroups['pares'].push(item);
      } else if (role.includes('liderado') || role.includes('subordinado') || role.includes('direct report')) {
        roleGroups['liderados'].push(item);
      } else {
        roleGroups['outros'].push(item);
      }
    });

    // Processa os dados para cada tipo de gráfico
    return {
      summary: this.generateSummaryTable(roleGroups),
      compareByRole: this.generateRoleComparisonData(roleGroups),
      radarChart: this.generateRadarChartData(roleGroups),
      competencies: this.generateCompetenciesData(roleGroups),
      departments: this.generateDepartmentData(data),
      levels: this.generateLevelData(data)
    };
  }

  private generateSummaryTable(roleGroups: { [key: string]: AssessmentData[] }): any[] {
    // Gera uma tabela de resumo com médias por competência e por tipo de avaliador
    const competencies = this.getAllCompetenciesFromData(roleGroups);
    const result: any[] = [];

    competencies.forEach(comp => {
      const row: any = { competencia: comp };

      // Calcula média para cada tipo de avaliador
      Object.keys(roleGroups).forEach(role => {
        const groupData = roleGroups[role];
        if (groupData.length === 0) {
          row[role] = null;
          return;
        }

        let sum = 0, count = 0;
        groupData.forEach(data => {
          const value = this.getCompetencyValue(data, comp);
          if (value !== null) {
            sum += value;
            count++;
          }
        });

        row[role] = count > 0 ? parseFloat((sum / count).toFixed(1)) : null;
      });

      // Calcula o resultado final (média de todos os avaliadores exceto autoavaliação)
      let finalSum = 0, finalCount = 0;
      ['gestor', 'pares', 'liderados', 'outros'].forEach(role => {
        if (row[role] !== null) {
          finalSum += row[role];
          finalCount++;
        }
      });

      row['resultado'] = finalCount > 0 ? parseFloat((finalSum / finalCount).toFixed(1)) : null;
      result.push(row);
    });

    return result;
  }

  private generateRoleComparisonData(roleGroups: { [key: string]: AssessmentData[] }): any[] {
    // Gera dados para comparação geral entre tipos de avaliadores
    const result: any[] = [];

    Object.keys(roleGroups).forEach(role => {
      const avgScore = this.calculateAverageScoreForRole(roleGroups[role]);
      if (avgScore !== null) {
        result.push({
          name: this.formatRoleName(role),
          value: avgScore
        });
      }
    });

    // Adiciona o resultado final (média de todos exceto autoavaliação)
    const finalRoles = ['gestor', 'pares', 'liderados', 'outros'];
    let finalSum = 0, finalCount = 0;

    finalRoles.forEach(role => {
      const score = this.calculateAverageScoreForRole(roleGroups[role]);
      if (score !== null) {
        finalSum += score;
        finalCount++;
      }
    });

    if (finalCount > 0) {
      result.push({
        name: 'Resultado final',
        value: parseFloat((finalSum / finalCount).toFixed(1))
      });
    }

    return result;
  }

  private generateRadarChartData(roleGroups: { [key: string]: AssessmentData[] }): any[] {
    // Gera dados para gráfico de radar com todas as competências por tipo de avaliador
    const competencies = this.getAllCompetenciesFromData(roleGroups);
    const result: any[] = [];

    Object.keys(roleGroups).forEach(role => {
      if (roleGroups[role].length === 0) return;

      const series: any[] = [];
      competencies.forEach(comp => {
        const value = this.calculateCompetencyAverageForRole(roleGroups[role], comp);
        if (value !== null) {
          series.push({
            name: comp,
            value: value
          });
        }
      });

      if (series.length > 0) {
        result.push({
          name: this.formatRoleName(role),
          series: series
        });
      }
    });

    return result;
  }

  private generateCompetenciesData(roleGroups: { [key: string]: AssessmentData[] }): any {
    // Gera dados separados por competência para visualização individual
    const competencies = this.getAllCompetenciesFromData(roleGroups);
    const result: { [key: string]: any[] } = {};

    competencies.forEach(comp => {
      const compData: any[] = [];

      Object.keys(roleGroups).forEach(role => {
        const value = this.calculateCompetencyAverageForRole(roleGroups[role], comp);
        if (value !== null) {
          compData.push({
            name: this.formatRoleName(role),
            value: value
          });
        }
      });

      // Adiciona o resultado final (média de todos exceto autoavaliação)
      let finalSum = 0, finalCount = 0;
      ['gestor', 'pares', 'liderados', 'outros'].forEach(role => {
        const value = this.calculateCompetencyAverageForRole(roleGroups[role], comp);
        if (value !== null) {
          finalSum += value;
          finalCount++;
        }
      });

      if (finalCount > 0) {
        compData.push({
          name: 'Resultado final',
          value: parseFloat((finalSum / finalCount).toFixed(1))
        });
      }

      result[comp] = compData;
    });

    return result;
  }

  private generateDepartmentData(data: AssessmentData[]): any {
    // Agrupa os dados por departamento
    const departments: { [key: string]: AssessmentData[] } = {};

    data.forEach(item => {
      const dept = item.department || 'Não especificado';
      if (!departments[dept]) departments[dept] = [];
      departments[dept].push(item);
    });

    // Calcula médias por departamento
    const result: any[] = [];

    Object.keys(departments).forEach(dept => {
      const deptData = departments[dept];
      const avgScore = this.calculateAverageScore(deptData);

      if (avgScore !== null) {
        result.push({
          name: dept,
          value: avgScore
        });
      }
    });

    return result;
  }

  private generateLevelData(data: AssessmentData[]): any {
    // Agrupa os dados por nível
    const levels: { [key: string]: AssessmentData[] } = {};

    data.forEach(item => {
      const level = item.level || 'Não especificado';
      if (!levels[level]) levels[level] = [];
      levels[level].push(item);
    });

    // Calcula médias por nível
    const result: any[] = [];

    Object.keys(levels).forEach(level => {
      const levelData = levels[level];
      const avgScore = this.calculateAverageScore(levelData);

      if (avgScore !== null) {
        result.push({
          name: level,
          value: avgScore
        });
      }
    });

    return result;
  }

  // Métodos de suporte
  private getAllCompetenciesFromData(roleGroups: { [key: string]: AssessmentData[] }): string[] {
    const competencies = new Set<string>();

    Object.values(roleGroups).forEach(group => {
      group.forEach(data => {
        const surveyData = data.surveyData || {};
        Object.keys(surveyData).forEach(key => {
          competencies.add(key);
        });
      });
    });

    return Array.from(competencies);
  }

  private getCompetencyValue(data: AssessmentData, competency: string): number | null {
    const surveyData = data.surveyData || {};
    const value = surveyData[competency];

    if (value === undefined || value === null) return null;

    if (typeof value === 'number') {
      return value;
    } else if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }

    return null;
  }

  private calculateAverageScoreForRole(roleData: AssessmentData[]): number | null {
    if (!roleData || roleData.length === 0) return null;

    let totalSum = 0, totalCount = 0;

    roleData.forEach(data => {
      const surveyData = data.surveyData || {};

      Object.values(surveyData).forEach(value => {
        if (typeof value === 'number') {
          totalSum += value;
          totalCount++;
        } else if (typeof value === 'string') {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            totalSum += num;
            totalCount++;
          }
        }
      });
    });

    return totalCount > 0 ? parseFloat((totalSum / totalCount).toFixed(1)) : null;
  }

  private calculateCompetencyAverageForRole(roleData: AssessmentData[], competency: string): number | null {
    if (!roleData || roleData.length === 0) return null;

    let sum = 0, count = 0;

    roleData.forEach(data => {
      const value = this.getCompetencyValue(data, competency);
      if (value !== null) {
        sum += value;
        count++;
      }
    });

    return count > 0 ? parseFloat((sum / count).toFixed(1)) : null;
  }

  private calculateAverageScore(data: AssessmentData[]): number | null {
    if (!data || data.length === 0) return null;

    let totalSum = 0, totalCount = 0;

    data.forEach(item => {
      const surveyData = item.surveyData || {};

      Object.values(surveyData).forEach(value => {
        if (typeof value === 'number') {
          totalSum += value;
          totalCount++;
        } else if (typeof value === 'string') {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            totalSum += num;
            totalCount++;
          }
        }
      });
    });

    return totalCount > 0 ? parseFloat((totalSum / totalCount).toFixed(1)) : null;
  }

  private formatRoleName(role: string): string {
    const roleMap: { [key: string]: string } = {
      'autoavaliacao': 'Autoavaliação',
      'gestor': 'Gestor',
      'pares': 'Pares',
      'liderados': 'Liderados',
      'outros': 'Outros'
    };

    return roleMap[role] || role;
  }

  private convertTimestamp(timestamp: any): Date {
    if (!timestamp) return new Date();

    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }

    if (timestamp && timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }

    return new Date(timestamp);
  }

  private extractQuestionsFromSurvey(surveyJSON: any): Record<string, QuestionInfo> {
    try {
      const questions: Record<string, QuestionInfo> = {};

      if (surveyJSON.pages) {
        surveyJSON.pages.forEach((page: any) => {
          if (page.elements) {
            page.elements.forEach((element: any) => {
              if (element.name) {
                // Guarda a pergunta com seu título/texto
                questions[element.name] = {
                  title: element.title?.pt || element.title || '',
                  type: element.type,
                  options: []
                };

                // Se tem opções (como em uma questão de escolha múltipla)
                if (element.choices) {
                  questions[element.name].options = element.choices;
                }

                // Se for uma matriz, guarda as linhas e colunas
                if (element.type === 'matrix') {
                  questions[element.name].rows = element.rows;
                  questions[element.name].columns = element.columns;
                }
              }
            });
          }
        });
      }

      return questions;

    } catch (error) {
      console.error('Erro ao extrair perguntas do JSON:', error);
      return {};
    }
  }
}
