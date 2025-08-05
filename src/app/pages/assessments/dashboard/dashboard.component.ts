import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { Model, PageModel, QuestionMatrixModel } from 'survey-core';
import { Firestore, collection, getDocs, doc, getDoc, query, where, documentId } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, ActivatedRoute } from '@angular/router';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatTableExporterModule, MatTableExporterDirective } from 'mat-table-exporter';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { FormsModule } from '@angular/forms';
import { LoadingService } from '../../../services/loading.service';

// NGX-Charts
import {
  NgxChartsModule,
  ColorHelper,
  BarHorizontalStackedComponent,
  PolarChartComponent
} from '@swimlane/ngx-charts';

interface ChartData {
  name: string;
  value: number;
}

interface Question {
  name: string;
  title: string;
  type: string;
  choices?: any[];
}

// Interface para estatísticas
interface Statistics {
  totalResponses: number;
  completionRate: number;
  averageTimeMin: number;
  lastResponse: Date | null;
}

interface QuestionStatistics {
  totalResponses: number;
  average?: number;
  median?: number;
  mode?: string | number;
  stdDev?: number;
  min?: number;
  max?: number;
  counts?: { name: string; value: number; percentage: number }[];
}

interface QuestionChart {
  question: Question;
  data: ChartData[];
  type: string;
  statistics: QuestionStatistics;
}

// Novas Interfaces
interface ParticipantInfo {
  id: string;
  category: string; // 'Autoavaliação', 'Gestor', 'Pares', 'Liderados', 'Outros'
}

// Mapeamento de categorias do Firestore para categorias do relatório
const categoryMapping: { [key: string]: string } = {
  'Avaliado': 'Autoavaliação',
  'Gestor': 'Gestor',
  'Par': 'Pares',
  'Subordinado': 'Liderados'
  // Adicione outros mapeamentos se necessário, ex: 'Outros': 'Outros'
};
const reportCategories = ['Autoavaliação', 'Gestor', 'Pares', 'Liderados', 'Resultado final']; // Ordem desejada na tabela/gráficos

interface CompetencyResult {
  name: string; // Nome da Competência (ou linha da matriz)
  isCompetencyHeader?: boolean; // Flag para identificar linhas de cabeçalho de competência na tabela
  averages: { [category: string]: number | null }; // Médias por categoria (Autoavaliação, Gestor, etc.) e Resultado final
}

interface CompetencyChartData {
    name: string; // Nome da competência/linha da matriz
    series: { name: string; value: number }[]; // séries serão as categorias (Auto, Gestor...)
}

interface RadarChartData {
    name: string; // Nome da competência
    value: number; // Resultado Final
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
    NgxChartsModule,
    MatTableExporterModule,
    FormsModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  // Dados das avaliações
  assessments: { id: string; name: string; }[] = [];
  selectedAssessment: string | null = null;
  isLoading = false;
  surveyResults: any[] = [];
  surveyQuestions: Question[] = [];

  // Dados da tabela
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatTableExporterDirective) exporter!: MatTableExporterDirective;
  dataSource!: MatTableDataSource<any>;
  displayedColumns: string[] = [];
  matrixRowColumns: { [matrixName: string]: { rowValue: string, rowText: string }[] } = {};

  // Opções de cores e temas
  colorSchemes = {
    cool: {
      name: 'cool',
      selectable: true,
      group: 'Ordinal',
      domain: ['#2196F3', '#4CAF50', '#FFC107', '#FF5722', '#9C27B0']
    },
    fire: {
      name: 'fire',
      selectable: true,
      group: 'Ordinal',
      domain: ['#FF5722', '#FFC107', '#FF9800', '#F44336', '#E91E63']
    },
    natural: {
      name: 'natural',
      selectable: true,
      group: 'Ordinal',
      domain: ['#8BC34A', '#009688', '#4CAF50', '#CDDC39', '#FFC107']
    }
  };

  currentColorScheme = this.colorSchemes.cool;
  chartType = 'bar';
  chartTypes = ['bar', 'pie', 'advanced-pie', 'gauge', 'number-card', 'polar'];

  // Dados e opções de gráficos
  questionCharts: QuestionChart[] = [];

  // Estatísticas
  statistics: Statistics = {
    totalResponses: 0,
    completionRate: 0,
    averageTimeMin: 0,
    lastResponse: null
  };

  // Opções de visualização
  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = true;
  showXAxisLabel = true;
  showYAxisLabel = true;
  showLabels = true;
  explodeSlices = false;
  doughnut = false;

  // Novos dados
  participantMap = new Map<string, ParticipantInfo>();
  summaryTableData: CompetencyResult[] = [];
  summaryDisplayedColumns: string[] = ['name', ...reportCategories];
  competencyCharts: CompetencyChartData[] = [];
  radarChartData: RadarChartData[] = [];

  // Tabela de dados brutos (opcional)
  @ViewChild('rawPaginator') rawPaginator!: MatPaginator;
  @ViewChild('rawSort') rawSort!: MatSort;
  @ViewChild('rawExporter') rawExporter!: MatTableExporterDirective;
  rawDataSource!: MatTableDataSource<any>;
  rawDisplayedColumns: string[] = [];

  // Opções de cores para gráficos comparativos
   categoryColorScheme = {
       domain: ['#8BC34A', '#f44336', '#FFC107', '#9C27B0', '#2196F3', '#607D8B']
   };
   categoryColorMap: { [category: string]: string } = {
    'Autoavaliação': this.categoryColorScheme.domain[0],
    'Gestor': this.categoryColorScheme.domain[1],
    'Pares': this.categoryColorScheme.domain[2],
    'Liderados': this.categoryColorScheme.domain[3],
    'Resultado final': this.categoryColorScheme.domain[4],
    'Outros': this.categoryColorScheme.domain[5]
  };

  overallCategoryAverages: { [category: string]: { average: number; count: number } } = {};

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute,
    private loadingService: LoadingService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadAssessments();
    this.route.queryParams.subscribe(params => {
      const assessmentId = params['id'];
      if (assessmentId && this.assessments.some(a => a.id === assessmentId)) {
        if (this.selectedAssessment !== assessmentId) {
          this.selectedAssessment = assessmentId;
          this.loadAndProcessAssessmentData(assessmentId);
        }
      } else if (this.selectedAssessment) {
          this.selectedAssessment = null;
          this.clearReportData();
      }
    });
  }

  async loadAssessments(): Promise<void> {
    try {
      this.loadingService.show('Carregando avaliações...');
      const assessmentsCollection = collection(this.firestore, 'assessments');
      const assessmentsSnapshot = await getDocs(assessmentsCollection);
      this.assessments = assessmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data()['name'] || 'Avaliação sem nome'
      }));
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      this.snackBar.open('Erro ao carregar lista de avaliações', 'Fechar', { duration: 3000 });
    } finally {
      this.loadingService.hide();
    }
  }

  onAssessmentChange(event: any): void {
    const assessmentId = event.value;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: assessmentId },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  async loadAndProcessAssessmentData(assessmentId: string): Promise<void> {
    console.log(`Iniciando carregamento para assessmentId: ${assessmentId}`);
    this.loadingService.show('Processando dados da avaliação...');
    this.clearReportData();

    try {
      console.log('Buscando definição da avaliação...');
      const assessmentDocRef = doc(this.firestore, `assessments/${assessmentId}`);
      const assessmentSnap = await getDoc(assessmentDocRef);
      if (!assessmentSnap.exists() || !assessmentSnap.data()['surveyJSON']) {
        throw new Error('Definição da avaliação não encontrada ou inválida.');
      }
      const surveyJSON = assessmentSnap.data()['surveyJSON'];
      const surveyModel = new Model(surveyJSON);
      console.log('Definição da avaliação carregada.');

      console.log('Buscando resultados...');
      const resultsCollectionRef = collection(this.firestore, `assessments/${assessmentId}/results`);
      const resultsSnap = await getDocs(resultsCollectionRef);
      this.surveyResults = resultsSnap.docs.map(doc => {
          const data = doc.data();
          return {
              id: doc.id,
              participantId: data['participantId'],
              ...(data['surveyData'] || {})
          };
      });
      console.log(`Resultados carregados: ${this.surveyResults.length}`);

      if (this.surveyResults.length === 0) {
        this.snackBar.open('Não há resultados para esta avaliação.', 'Fechar', { duration: 3000 });
        this.loadingService.hide();
        return;
      }

      const participantIds = [...new Set(this.surveyResults.map(r => r.participantId).filter(id => !!id))];
      console.log(`Buscando informações para ${participantIds.length} participantes...`);
      if (participantIds.length > 0) {
         await this.loadParticipantInfo(participantIds);
         console.log('Informações dos participantes carregadas:', this.participantMap);
      } else {
         console.warn("Nenhum participantId encontrado nos resultados.");
      }

      // Extrair perguntas do modelo
      this.extractQuestions(surveyModel);
      console.log('Perguntas extraídas:', this.surveyQuestions);

      // Processar dados para os gráficos e tabelas
      this.processQuestionsData();
      console.log('Dados processados para visualização');

      console.log('Processando resultados por competência...');
      this.processResultsByCompetency(surveyModel);
      console.log('Processamento concluído.');

      // Inicializar a tabela de dados
      this.initializeDataTable();
      console.log('Tabela de dados inicializada');

    } catch (error) {
      console.error('Erro ao carregar e processar dados da avaliação:', error);
      this.snackBar.open('Erro ao processar dados. Tente novamente.', 'Fechar', { duration: 3000 });
      this.clearReportData();
    } finally {
      this.loadingService.hide();
      console.log('Carregamento finalizado.');
    }
  }

  async loadParticipantInfo(participantIds: string[]): Promise<void> {
      this.participantMap.clear();
      const participantsRef = collection(this.firestore, 'participants');
      const chunkSize = 30;
      for (let i = 0; i < participantIds.length; i += chunkSize) {
          const chunkIds = participantIds.slice(i, i + chunkSize);
          if (chunkIds.length > 0) {
              try {
                const q = query(participantsRef, where(documentId(), 'in', chunkIds));
                const querySnapshot = await getDocs(q);
                console.log(`Query chunk ${i/chunkSize + 1}: Found ${querySnapshot.docs.length} participants for IDs:`, chunkIds);
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    const rawCategory = data['category'] || 'Outros';
                    const mappedCategory = categoryMapping[rawCategory] || 'Outros';
                    console.log(`Participant ${doc.id}: Raw Category='${rawCategory}', Mapped Category='${mappedCategory}'`);
                    this.participantMap.set(doc.id, {
                        id: doc.id,
                        category: mappedCategory
                    });
                });
              } catch (error) {
                  console.error(`Erro ao buscar chunk de participantes [${i}-${i+chunkSize-1}]:`, error);
              }
          }
      }
      participantIds.forEach(id => {
          if (!this.participantMap.has(id)) {
              console.warn(`Participante com ID ${id} não encontrado na coleção 'participants'.`);
          }
      });
  }

  processResultsByCompetency(surveyModel: Model): void {
    const competencyData: { [competency: string]: { [itemKey: string]: { [category: string]: number[] } } } = {};
    const competencyItemTitles: { [competency: string]: { [itemKey: string]: string } } = {};
    const competencyOrder: string[] = [];

    const getNumericValue = (colValue: any): number | null => {
        if (typeof colValue === 'number' && colValue >= 1 && colValue <= 5) return colValue;
        if (typeof colValue === 'string' && colValue.startsWith('Column ')) {
            const num = parseInt(colValue.replace('Column ', ''), 10);
            return !isNaN(num) && num >= 1 && num <= 5 ? num : null;
        }
        return null;
    };

    surveyModel.pages.forEach((page: PageModel) => {
      const competencyName = page.title || `Competência ${page.name}`;
      if (!competencyData[competencyName]) {
          competencyData[competencyName] = {};
          competencyItemTitles[competencyName] = {};
          competencyOrder.push(competencyName);
      }

      page.questions.forEach((question: any) => {
        const questionType = question.getType();

        if (questionType === 'matrix') {
          const matrix = question as QuestionMatrixModel;
          if(matrix.rows) {
              matrix.rows.forEach((row: any) => {
                const rowValue = row.value ?? row;
                const itemKey = `${question.name}_${rowValue}`;
                const itemTitle = row.text ?? rowValue;
                competencyData[competencyName][itemKey] = {};
                competencyItemTitles[competencyName][itemKey] = itemTitle;
                reportCategories.forEach(cat => {
                  if(cat !== 'Resultado final') competencyData[competencyName][itemKey][cat] = [];
                });
              });
          }
        } else if (['rating', 'radiogroup', 'dropdown'].includes(questionType)) {
            const itemKey = question.name;
            const itemTitle = question.title || question.name;
            competencyData[competencyName][itemKey] = {};
            competencyItemTitles[competencyName][itemKey] = itemTitle;
             reportCategories.forEach(cat => {
                if(cat !== 'Resultado final') competencyData[competencyName][itemKey][cat] = [];
             });
        }
      });
    });

    this.surveyResults.forEach(result => {
      if (!result.participantId) return;
      const participant = this.participantMap.get(result.participantId);
      const category = participant ? participant.category : 'Outros';

      if (category !== 'Outros') {
        competencyOrder.forEach(competencyName => {
          if (!competencyData[competencyName]) return;
          Object.keys(competencyData[competencyName]).forEach(itemKey => {
            const [questionName, rowValue] = itemKey.includes('_') ? itemKey.split('_') : [itemKey, null];
            const answer = result[questionName];

            let numericValue: number | null = null;
            if (rowValue && typeof answer === 'object' && answer !== null && answer[rowValue] !== undefined) {
              numericValue = getNumericValue(answer[rowValue]);
            } else if (!rowValue && answer !== undefined) {
              numericValue = getNumericValue(answer);
            }

            if (numericValue !== null && competencyData[competencyName]?.[itemKey]?.[category]) {
                 competencyData[competencyName][itemKey][category].push(numericValue);
            }
          });
        });
      }
    });

    this.summaryTableData = [];
    this.competencyCharts = [];
    this.radarChartData = [];
    const overallAveragesByCategory: { [category: string]: { sum: number; count: number } } = {};
    reportCategories.forEach(cat => { overallAveragesByCategory[cat] = { sum: 0, count: 0 }; });

    competencyOrder.forEach(competencyName => {
        const competencyHeaderRow: CompetencyResult = {
            name: competencyName,
            isCompetencyHeader: true,
            averages: {}
        };
        reportCategories.forEach(cat => { competencyHeaderRow.averages[cat] = null; });
        this.summaryTableData.push(competencyHeaderRow);

       let competencyAverageSum = 0;
       let competencyAverageCount = 0;
       const competencyItemsChartData: CompetencyChartData[] = [];

       const itemKeys = Object.keys(competencyData[competencyName] || {});

       if (itemKeys.length === 0) {
           console.warn(`Competência '${competencyName}' não tem itens com dados processáveis.`);
           return;
       }

       itemKeys.forEach(itemKey => {
            const itemTitle = competencyItemTitles[competencyName]?.[itemKey] || itemKey;
            const competencyItemResult: CompetencyResult = {
                name: `  ${itemTitle}`,
                averages: {}
            };
             const itemChartSeries: { name: string; value: number }[] = [];
             const categoryAveragesForItem: number[] = [];

            reportCategories.forEach(category => {
                if (category === 'Resultado final') return;

                const values = competencyData[competencyName]?.[itemKey]?.[category];
                const average = values && values.length > 0 ? this.getAverageValues(values) : null;
                competencyItemResult.averages[category] = average;

                if (average !== null) {
                    itemChartSeries.push({ name: category, value: average });
                    categoryAveragesForItem.push(average);
                    overallAveragesByCategory[category].sum += average;
                    overallAveragesByCategory[category].count++;
                } else {
                     itemChartSeries.push({ name: category, value: 0 });
                }
            });

            const finalItemAverage = categoryAveragesForItem.length > 0 ? this.getAverageValues(categoryAveragesForItem) : null;
            competencyItemResult.averages['Resultado final'] = finalItemAverage;
             if (finalItemAverage !== null) {
                 itemChartSeries.push({ name: 'Resultado final', value: finalItemAverage });
                 competencyAverageSum += finalItemAverage;
                 competencyAverageCount++;
                 overallAveragesByCategory['Resultado final'].sum += finalItemAverage;
                 overallAveragesByCategory['Resultado final'].count++;
             } else {
                  itemChartSeries.push({ name: 'Resultado final', value: 0 });
             }

            this.summaryTableData.push(competencyItemResult);
            competencyItemsChartData.push({ name: itemTitle, series: itemChartSeries });
       });

        this.competencyCharts.push(...competencyItemsChartData);

        const finalCompetencyAverage = competencyAverageCount > 0 ? competencyAverageSum / competencyAverageCount : 0;
        this.radarChartData.push({ name: competencyName, value: finalCompetencyAverage });
    });

     console.log("Summary Table Data:", this.summaryTableData);
     console.log("Competency Charts Data:", this.competencyCharts);
     console.log("Radar Chart Data:", this.radarChartData);
     console.log("Overall Averages By Category (Sums/Counts):", overallAveragesByCategory);
  }

  getAverageValues(data: number[]): number {
    if (!data || data.length === 0) return 0;
    const sum = data.reduce((acc, item) => acc + item, 0);
    return sum / data.length;
  }

  formatAverage(value: number | null): string {
    return value !== null ? value.toFixed(1) : '-';
  }

  clearReportData(): void {
    this.summaryTableData = [];
    this.competencyCharts = [];
    this.radarChartData = [];
    this.participantMap.clear();
    this.surveyResults = [];
    this.questionCharts = [];
    this.displayedColumns = [];
    if (this.dataSource) {
        this.dataSource.data = [];
    }
    if (this.rawDataSource) {
        this.rawDataSource.data = [];
    }
  }

  exportExcel(): void { console.warn('Exportação Excel não implementada para novo formato.'); }
  exportPDF(): void { console.warn('Exportação PDF não implementada para novo formato.'); }
  exportCSV(): void { console.warn('Exportação CSV não implementada para novo formato.'); }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * Verifica se todas as colunas de uma matriz são do tipo numérico (ex: 'Column 1', 'Column 2', ...)
   * @param question Pergunta do tipo matriz
   */
  areMatrixColumnsNumeric(question: any): boolean {
    if (question.type !== 'matrix' || !question.columns) return false;
    // Considera numérico se todas as colunas têm valor do tipo 'Column X' (X = número)
    return question.columns.every((col: any) => {
      if (typeof col.value === 'string' && col.value.startsWith('Column ')) {
        const num = parseInt(col.value.replace('Column ', ''), 10);
        return !isNaN(num);
      }
      return false;
    });
  }

  /**
   * Altera o esquema de cores dos gráficos
   * @param scheme Nome do esquema de cores ('cool', 'fire', 'natural')
   */
  changeColorScheme(scheme: string): void {
    this.currentColorScheme = this.colorSchemes[scheme as keyof typeof this.colorSchemes];
  }

  /**
   * Obtém o título da pergunta a partir do nome da coluna
   * @param columnName Nome da coluna
   */
  getQuestionTitle(columnName: string): string {
    const question = this.surveyQuestions.find(q => q.name === columnName);
    return question?.title || columnName;
  }

  /**
   * Formata o valor para exibição na tabela
   * @param value Valor a ser formatado
   */
  formatValue(value: any): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'number') return value.toFixed(1);
    return value.toString();
  }

  /**
   * Extrai as perguntas do modelo de avaliação
   */
  extractQuestions(surveyModel: Model): void {
    this.surveyQuestions = [];
    surveyModel.pages.forEach((page: PageModel) => {
      page.questions.forEach((question: any) => {
        this.surveyQuestions.push({
          name: question.name,
          title: question.title || question.name,
          type: question.getType(),
          choices: question.choices || []
        });
      });
    });
  }

  /**
   * Processa os dados das perguntas para criar os gráficos
   */
  processQuestionsData(): void {
    this.questionCharts = [];

    // Atualizar estatísticas gerais
    this.statistics.totalResponses = this.surveyResults.length;
    this.statistics.lastResponse = this.surveyResults.length > 0
      ? new Date(Math.max(...this.surveyResults.map(r => r.completedAt ? new Date(r.completedAt).getTime() : 0)))
      : null;
    this.statistics.completionRate = 100; // Considerando que todos os resultados são completos

    // Processar cada pergunta
    this.surveyQuestions.forEach(question => {
      // Coletar todas as respostas para esta pergunta
      const answers = this.surveyResults.map(result => result[question.name]).filter(a => a !== undefined);

      // Estatísticas básicas
      const questionStats: QuestionStatistics = {
        totalResponses: answers.length
      };

      // Processar dados para o gráfico
      let chartData: ChartData[] = [];

      if (['radiogroup', 'dropdown', 'checkbox', 'boolean'].includes(question.type)) {
        // Processar perguntas de escolha
        const counts = this.countChoiceResponses(answers, question);
        questionStats.counts = counts;
        questionStats.mode = counts.length > 0 ? counts[0].name : undefined;
        chartData = counts.map(count => ({ name: count.name, value: count.value }));
      } else if (question.type === 'rating' || question.type === 'matrix') {
        // Processar perguntas numéricas
        const numericAnswers = this.extractNumericValues(answers, question);
        if (numericAnswers.length > 0) {
          questionStats.average = this.getAverageValues(numericAnswers);
          questionStats.median = this.calculateMedian(numericAnswers);
          questionStats.mode = this.calculateMode(numericAnswers);
          questionStats.stdDev = this.calculateStdDev(numericAnswers, questionStats.average);
          questionStats.min = Math.min(...numericAnswers);
          questionStats.max = Math.max(...numericAnswers);

          // Criar histograma para gráficos
          const histogramData = this.createHistogram(numericAnswers);
          chartData = histogramData;
        }
      }

      // Adicionar à lista de gráficos
      this.questionCharts.push({
        question,
        data: chartData,
        type: 'bar', // Tipo padrão
        statistics: questionStats
      });
    });
  }

  /**
   * Conta respostas para perguntas de escolha
   */
  countChoiceResponses(answers: any[], question: Question): { name: string; value: number; percentage: number }[] {
    const counts: { [key: string]: number } = {};

    answers.forEach(answer => {
      let value = answer;
      if (Array.isArray(answer)) {
        // Para checkbox que permite múltiplas respostas
        answer.forEach(a => {
          counts[a] = (counts[a] || 0) + 1;
        });
      } else {
        // Para radiogroup, dropdown, boolean
        counts[value] = (counts[value] || 0) + 1;
      }
    });

    const countsList = Object.entries(counts).map(([key, count]) => ({
      name: key,
      value: count,
      percentage: Math.round((count / answers.length) * 100)
    }));

    return countsList.sort((a, b) => b.value - a.value);
  }

  /**
   * Extrai valores numéricos das respostas
   */
  extractNumericValues(answers: any[], question: Question): number[] {
    const numericAnswers: number[] = [];

    answers.forEach(answer => {
      if (typeof answer === 'number') {
        numericAnswers.push(answer);
      } else if (typeof answer === 'string' && answer.startsWith('Column ')) {
        const num = parseInt(answer.replace('Column ', ''), 10);
        if (!isNaN(num)) numericAnswers.push(num);
      } else if (question.type === 'matrix' && typeof answer === 'object' && answer !== null) {
        // Para perguntas do tipo matriz, extrair valores numéricos de cada linha
        Object.values(answer).forEach(rowValue => {
          if (typeof rowValue === 'number') {
            numericAnswers.push(rowValue);
          } else if (typeof rowValue === 'string' && rowValue.startsWith('Column ')) {
            const num = parseInt(rowValue.replace('Column ', ''), 10);
            if (!isNaN(num)) numericAnswers.push(num);
          }
        });
      }
    });

    return numericAnswers;
  }

  /**
   * Calcula a mediana de um array de números
   */
  calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  }

  /**
   * Calcula a moda de um array de números
   */
  calculateMode(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const counts = numbers.reduce((acc, num) => {
      acc[num] = (acc[num] || 0) + 1;
      return acc;
    }, {} as { [key: number]: number });

    let maxCount = 0;
    let mode = 0;
    for (const [numStr, count] of Object.entries(counts)) {
      const num = parseInt(numStr, 10);
      if (count > maxCount) {
        maxCount = count;
        mode = num;
      }
    }
    return mode;
  }

  /**
   * Calcula o desvio padrão
   */
  calculateStdDev(numbers: number[], avg: number = 0): number {
    if (numbers.length <= 1) return 0;
    const average = avg || this.getAverageValues(numbers);
    const squareDiffs = numbers.map(num => Math.pow(num - average, 2));
    const avgSquareDiff = this.getAverageValues(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Cria um histograma para valores numéricos
   */
  createHistogram(numbers: number[]): ChartData[] {
    // Para avaliações de 1-5, criar um histograma direto
    const counts: { [key: number]: number } = {};
    numbers.forEach(num => {
      counts[num] = (counts[num] || 0) + 1;
    });

    // Garantir que todas as opções de 1 a 5 estejam presentes
    for (let i = 1; i <= 5; i++) {
      if (counts[i] === undefined) counts[i] = 0;
    }

    return Object.entries(counts)
      .map(([value, count]) => ({
        name: value,
        value: count
      }))
      .sort((a, b) => (typeof a.name === 'string' && typeof b.name === 'string' ?
        a.name.localeCompare(b.name) :
        Number(a.name) - Number(b.name)));
  }

  /**
   * Inicializa a tabela de dados
   */
  initializeDataTable(): void {
    if (this.surveyResults.length === 0) return;

    // Definir colunas
    const columns = ['id', ...this.surveyQuestions.map(q => q.name), 'completedAt'];
    this.displayedColumns = columns;

    // Criar dataSource
    this.dataSource = new MatTableDataSource(this.surveyResults);
    setTimeout(() => {
      if (this.paginator) this.dataSource.paginator = this.paginator;
      if (this.sort) this.dataSource.sort = this.sort;
    });
  }
}
