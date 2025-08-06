import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { Firestore, collection, getDocs, doc, getDoc, addDoc, setDoc } from '@angular/fire/firestore';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { ReactiveFormsModule, FormControl, FormGroup, Validators, FormArray } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { MatOptionModule } from '@angular/material/core';
import { ColumnValuePipe } from './column-value.pipe';
import { MatTabsModule } from '@angular/material/tabs';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { AngularEditorModule, AngularEditorConfig } from '@kolkov/angular-editor';
import { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PerformanceMonitorService } from './performance-monitor.service';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { CompetencyService, Competency } from '../../services/competency.service';
import { LoadingService } from '../../services/loading.service';
import { FirestoreLoadingInterceptor } from '../../interceptors/firestore-loading.interceptor';
import * as ExcelJS from 'exceljs';
import jsPDF from 'jspdf';

interface AssessmentOption {
  id: string;
  name: string;
}


interface DistribuicaoNota {
  nota: number;
  quantidade: number;
}

interface DadosCategoria {
  categoria: string;
  distribuicao: DistribuicaoNota[];
  media: number;
  totalRespostas: number;
}

interface LinhaTabela {
  pergunta: string;
  perguntaId: string;
  categorias: DadosCategoria[];
}

interface TabelaCompetencia {
  competencia: Competency;
  linhas: LinhaTabela[];
  mediasGerais: DadosCategoria[];
}

// Modelo de dados para seções dinâmicas do relatório
export interface RelatorioSecao {
  id: string;
  tipo: 'capa' | 'introducao' | 'resumo' | 'graficos' | 'tabela' | 'destaques' | 'custom' | 'texto' | 'competencia_detalhada' | 'grafico_defasagem' | 'grafico_radar';
  titulo?: string;
  texto?: string;
  visivel: boolean;
  ordem: number;
  // Campos para dados dinâmicos
  competenciasIds?: string[];
  perguntasIds?: string[];
  textosPorCompetencia?: { [key: string]: string };
  // Outros campos customizáveis
  [key: string]: any;
}

// Interfaces para avaliações mais altas
interface ItemAvaliacao {
  classificacao: number;
  comportamento: string;
  pontuacaoMediaAvaliado: number;
  pontuacaoMediaSemAutoavaliacao: number;
  caracteristicaLider: string;
  perguntaId: string;
  competenciaId: string;
}

interface TabelaAvaliacoesAltas {
  items: ItemAvaliacao[];
  totalItems: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    KeyValuePipe,
    MatTableModule,
    MatButtonModule,
    MatSelectModule,
    MatOptionModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    ColumnValuePipe,
    MatTabsModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
    MatListModule,
    MatCardModule,
    MatTooltipModule,
    NgxChartsModule,
    AngularEditorModule,
    NgxEchartsModule,
    DragDropModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatCheckboxModule
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsComponent implements OnInit {
  displayedColumns: string[] = [];
  dataSource: any[] = [];
  isLoading = false;
  assessments: AssessmentOption[] = [];
  selectedAssessmentId: string | null = null;
  selectedClientId: string | null = null; // Nova propriedade
  questionMap: { [key: string]: string } = {};
  summaryCounts: any = {};

  assessmentControl = new FormControl('');

  today: Date = new Date();

  competencyAverages: { title: string; avg: number }[] = [];
  topItems: { title: string; avg: number }[] = [];
  lowItems: { title: string; avg: number }[] = [];

  consolidation: any[] = [];
  consolidationColumns: string[] = ['pergunta', 'sessao', 'tema', 'resposta', 'respondentes', 'percent', 'score'];

  // Competências e gráficos
  stackedData: any[] = [];
  colorScheme = { domain: ['#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575', '#424242'] };

  // Esquema de cores fixo por categoria para consistência
  categoryColorScheme: any = {
    domain: ['#00C853', '#D32F2F', '#FFC107', '#7B1FA2', '#1976D2', '#607D8B'] // Verde, Vermelho, Amarelo, Roxo, Azul, Cinza
  };

  categoryColorMap: { [key: string]: string } = {
    'Avaliado(a)': this.categoryColorScheme.domain[0],
    'Gestor(es)': this.categoryColorScheme.domain[1],
    'Pares': this.categoryColorScheme.domain[2],
    'Subordinados': this.categoryColorScheme.domain[3],
    'Resultado final': this.categoryColorScheme.domain[4], // Usando a cor azul para o resultado final
    'Outros': this.categoryColorScheme.domain[5]
  };

  // Sistema de cores customizáveis (pode ser mantido para outras seções, se necessário)

  // Método para calcular a altura do gráfico baseada no número de dados
  getChartHeight(dadosGrafico: any[]): number {
    if (!dadosGrafico || dadosGrafico.length === 0) {
      return 200; // Altura mínima quando não há dados
    }
    const calculatedHeight = dadosGrafico.length * 60 + 50;
    return calculatedHeight < 200 ? 200 : calculatedHeight;
  }

  // Método para buscar a média de uma competência por grupo
  getMediaPorCompetenciaEGrupo(compData: any, grupo: string): string {
    if (!compData || !compData.dados || !Array.isArray(compData.dados)) {
      return '-';
    }
    const dataItem = compData.dados.find((d: any) => d && d.grupo === grupo);
    const media = dataItem?.media;
    return (media !== null && media !== undefined && !isNaN(media)) ? media.toFixed(1).toString() : '-';
  }
  paletasCores = {
    'padrao': {
      nome: 'Padrão (Cinza)',
      cores: ['#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575', '#424242']
    },
    'azul': {
      nome: 'Azul Profissional',
      cores: ['#E3F2FD', '#90CAF9', '#42A5F5', '#1E88E5', '#0D47A1']
    },
    'verde': {
      nome: 'Verde Sucesso',
      cores: ['#E8F5E8', '#A5D6A7', '#66BB6A', '#43A047', '#1B5E20']
    },
    'laranja': {
      nome: 'Laranja Energia',
      cores: ['#FFF3E0', '#FFCC80', '#FF9800', '#F57C00', '#E65100']
    },
    'roxo': {
      nome: 'Roxo Criativo',
      cores: ['#F3E5F5', '#CE93D8', '#AB47BC', '#8E24AA', '#4A148C']
    },
    'vermelho': {
      nome: 'Vermelho Impacto',
      cores: ['#FFEBEE', '#EF9A9A', '#EF5350', '#E53935', '#B71C1C']
    },
    'teal': {
      nome: 'Teal Moderno',
      cores: ['#E0F2F1', '#80CBC4', '#26A69A', '#00897B', '#004D40']
    },
    'personalizada': {
      nome: 'Personalizada',
      cores: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6']
    }
  };
  dynamicColumns: string[] = [];
  dadosTextEnabled = false;
  competenciasTextEnabled = false;
  graficosTextEnabled = false;
  dadosTextControl = new FormControl('');
  competenciasTextControl = new FormControl('');
  graficosTextControl = new FormControl('');
  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: '200px',
    minHeight: '0',
    placeholder: 'Escreva seu texto...'
  };

  polarData: any[] = [];
  radarOptions: EChartsOption = {};

  allCompetencies: Competency[] = []; // Todas as competências do cliente
  competencias: Competency[] = []; // Competências selecionadas para o relatório

  // Controla a seleção de competências na nova aba
  isCompetencySelected(competencyId: string): boolean {
    return this.competencias.some(c => c.id === competencyId);
  }

      toggleCompetencySelection(competencyId: string): void {
    const isSelected = this.isCompetencySelected(competencyId);
    if (isSelected) {
      // Remove a competência
      this.competencias = this.competencias.filter(c => c.id !== competencyId);
    } else {
      // Adiciona a competência
      const competencyToAdd = this.allCompetencies.find(c => c.id === competencyId);
      if (competencyToAdd) {
        this.competencias.push(competencyToAdd);
      }
    }

    // Invalidar cache
    this.calculosCache.clear();

    // Sincroniza as seções com a nova seleção de competências
    this.sincronizarSecoesComCompetencias();
  }

  // Garante que as seções reflitam as competências selecionadas
  sincronizarSecoesComCompetencias(): void {
    const selectedIds = this.competencias.map(c => c.id!);
    this.relatorioConfiguracao.forEach(secao => {
      if (secao.competenciasIds) {
        secao.competenciasIds = selectedIds;
      }
    });
    this.atualizarFormArrayComConfiguracao();
  }

  // Seleciona ou deseleciona todas as competências visíveis
  toggleSelectAllCompetencies(): void {
    // Verifica se todas as competências filtradas já estão selecionadas
    const allFilteredSelected = this.filteredCompetencies.every(filteredComp =>
      this.competencias.some(selectedComp => selectedComp.id === filteredComp.id)
    );

    if (allFilteredSelected) {
      // Se todas estão selecionadas, remove elas
      const filteredIds = this.filteredCompetencies.map(c => c.id);
      this.competencias = this.competencias.filter(c => !filteredIds.includes(c.id));
    } else {
      // Se não, adiciona as que não estão selecionadas
      this.filteredCompetencies.forEach(filteredComp => {
        if (!this.competencias.some(selectedComp => selectedComp.id === filteredComp.id)) {
          this.competencias.push(filteredComp);
        }
      });
    }
    this.sincronizarSecoesComCompetencias();
  }

  // Sistema de abas
  selectedTabIndex = 0;

  // Flag para desabilitar gráficos durante operações
  chartsDisabled = false;

  competencySearchControl = new FormControl('');
  filteredCompetencies: Competency[] = [];

  // Exemplo de configuração inicial do relatório
  relatorioConfiguracao: RelatorioSecao[] = [
    {
      id: 'capa',
      tipo: 'capa',
      titulo: 'Relatório Feedback 360°',
      texto: '',
      visivel: true,
      ordem: 1
    },
    {
      id: 'introducao',
      tipo: 'introducao',
      titulo: 'Introdução',
      texto: 'Texto introdutório do relatório...',
      visivel: true,
      ordem: 2
    },
    {
      id: 'resumo',
      tipo: 'resumo',
      titulo: 'Resumo dos Resultados nas Competências',
      texto: '',
      visivel: true,
      ordem: 3,
      competenciasIds: [] // pode ser preenchido dinamicamente
    },
    {
      id: 'graficos',
      tipo: 'graficos',
      titulo: 'Gráficos',
      texto: '',
      visivel: true,
      ordem: 4,
      competenciasIds: [],
      'tipoGrafico': 'barra',
      'paletaCor': 'azul',
      'coresPersonalizadas': []
    },
    {
      id: 'tabela',
      tipo: 'tabela',
      titulo: 'Tabela de Frequência',
      texto: '',
      visivel: true,
      ordem: 5,
      competenciasIds: []
    },
    {
      id: 'destaques',
      tipo: 'destaques',
      titulo: 'Avaliações mais altas',
      texto: `
        <p>Esta seção apresenta os comportamentos em que você obteve as maiores pontuações, destacando seus pontos fortes segundo a perspectiva dos avaliadores.</p>
      `,
      visivel: true,
      ordem: 5,
      numeroItems: 5,
      avaliadoSelecionado: '',
      mostrarCaracteristica: true,
      mostrarPontuacaoSemAuto: true
    }
  ];

  relatorioFormArray: FormArray<any>
  dummyForm: FormGroup;

  // Salvar/Carregar Relatório
  nomeRelatorioControl = new FormControl('');
  savedReports: { id: string, name: string }[] = [];
  selectedReportId = new FormControl('');

  // Templates de relatório
  nomeTemplateControl = new FormControl('');
  savedTemplates: { id: string, name: string }[] = [];
  selectedTemplateId = new FormControl('');

  // 🚀 PERFORMANCE: Cache para cálculos pesados
  private calculosCache = new Map<string, any>();
  private dataIndexes = {
    participantes: new Map(),
    competencias: new Map(),
    resultados: new Map()
  };

  // Modo individual para relatórios de participantes específicos
  isIndividualMode = false;
  individualParticipantId: string | null = null;
  individualParticipantName: string | null = null;
  individualTemplateId: string | null = null;
  individualTemplateName: string | null = null;

  // Propriedades para exportação individual
  selectedParticipantControl = new FormControl('');

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private performanceMonitor: PerformanceMonitorService,
    private router: Router,
    private competencyService: CompetencyService,
    private loadingService: LoadingService,
    private firestoreInterceptor: FirestoreLoadingInterceptor,
    private cdr: ChangeDetectorRef
  ) {
    this.dummyForm = new FormGroup({
      relatorioFormArray: new FormArray<any>([])
    });

    this.relatorioFormArray = this.dummyForm.get('relatorioFormArray') as FormArray;
  }

  async loadAllCompetencies() {
    if (!this.selectedClientId) {
      console.warn('ClientId não selecionado, não é possível carregar competências.');
      this.allCompetencies = [];
      this.cdr.detectChanges();
      return;
    }

    this.loadingService.show('Carregando competências...');
    try {
      this.competencyService.getCompetencies(this.selectedClientId).subscribe(competencies => {
        this.allCompetencies = competencies;
        this.filteredCompetencies = [...this.allCompetencies]; // Inicializa a lista filtrada
        this.cdr.detectChanges();
        console.log(`Competências carregadas para o cliente ${this.selectedClientId}:`, competencies);

        // Lógica de filtro ao digitar na busca
        this.competencySearchControl.valueChanges.subscribe(term => {
          const lowerTerm = term?.toLowerCase() || '';
          this.filteredCompetencies = this.allCompetencies.filter(c =>
            c.name.toLowerCase().includes(lowerTerm) ||
            c.description.toLowerCase().includes(lowerTerm)
          );
          this.cdr.detectChanges();
        });
      });
    } catch (e) {
      console.error("Erro ao carregar competências:", e);
      this.snackBar.open('Falha ao carregar as competências.', 'Fechar', { duration: 3000 });
    } finally {
      this.loadingService.hide();
    }
  }

  // 🚀 PERFORMANCE: Sistema de cache
  private getCachedCalculation<T>(key: string, calculationFn: () => T): T {
    if (!this.calculosCache.has(key)) {
      console.log(`📊 Calculando e armazenando no cache: ${key}`);
      this.calculosCache.set(key, calculationFn());
    }
    return this.calculosCache.get(key);
  }

  private invalidateCache(pattern?: string) {
    if (pattern) {
      // Invalidar apenas chaves que correspondem ao padrão
      const keysToDelete = Array.from(this.calculosCache.keys()).filter(key => key.includes(pattern));
      keysToDelete.forEach(key => this.calculosCache.delete(key));
      console.log(`🗑️ Cache invalidado para padrão: ${pattern} (${keysToDelete.length} entradas)`);
    } else {
      // Invalidar todo o cache
      this.calculosCache.clear();
      console.log('🗑️ Cache completamente invalidado');
    }
  }

  // 🚀 PERFORMANCE: Indexação de dados
  private createDataIndexes() {
    console.log('🔍 Criando índices de dados...');

    this.dataIndexes.participantes.clear();
    this.dataIndexes.competencias.clear();
    this.dataIndexes.resultados.clear();

    // Indexar participantes por categoria (armazenar índices numéricos)
    this.dataSource.forEach((row, index) => {
      if (row.categoria) {
        const grupo = this.mapCategoriaToGrupo(row.categoria);
        if (!this.dataIndexes.participantes.has(grupo)) {
          this.dataIndexes.participantes.set(grupo, []);
        }
        this.dataIndexes.participantes.get(grupo)!.push(index);
      }
    });

    // Indexar respostas por participante
    this.dataSource.forEach((row, index) => {
      const participantId = row.participante || row.id || index;
      this.dataIndexes.resultados.set(participantId, row);
    });

    console.log(`✅ Índices criados: ${this.dataIndexes.participantes.size} categorias, ${this.dataIndexes.resultados.size} participantes`);
  }

  // 🚀 PERFORMANCE: TrackBy functions
  trackBySection(index: number, section: RelatorioSecao): string {
    return section.id + '-' + section.ordem + '-' + section.visivel;
  }

  trackBySectionForm(index: number, formGroup: FormGroup): string {
    return formGroup.get('id')?.value;
  }

  trackByCompetencia(index: number, comp: Competency): string {
    return comp.id!;
  }

  trackByQuestion(index: number, questionId: string): string {
    return questionId;
  }

  // 🚀 PERFORMANCE: Método para exibir relatório de performance
  showPerformanceReport(): void {
    this.performanceMonitor.logPerformanceReport();
  }

    debugCores(secao: any, i: number): void {
    console.group(`🎨 DEBUG CORES - Seção ${i} (${secao.id})`);
    console.log('Configuração da seção:', secao);
    console.log('Paleta selecionada:', secao?.paletaCor || secao?.['paletaCor']);
    console.log('Cores personalizadas:', secao?.coresPersonalizadas || secao?.['coresPersonalizadas']);

    const paletaControl = this.getPaletaCorControl(i);
    const coresControl = this.getCoresPersonalizadasControl(i);

    console.log('FormControl paleta valor:', paletaControl?.value);
    console.log('FormControl cores valor:', coresControl?.value);
    console.log('Esquema de cores atual:', this.getColorSchemeParaSecao(secao));

    console.log('relatorioFormGroups[i]:', this.relatorioFormGroups[i]?.value);

    // Teste: forçar mudança para personalizada
    if (secao['paletaCor'] !== 'personalizada') {
      console.log('🔧 Testando mudança para paleta personalizada...');
      paletaControl.setValue('personalizada');
      this.onPaletaCorChange(secao, i);
    } else {
      console.log('🔧 Testando adição de nova cor...');
      this.adicionarCorPersonalizada(secao, i);
    }

    console.groupEnd();
  }

  async ngOnInit() {
    this.today = new Date();

    // Carregar avaliações e templates primeiro
    await this.loadAssessments();
    await this.carregarRelatoriosSalvos();
    await this.carregarTemplatesSalvos(); // <-- Carrega os templates

    // Só depois de carregar os templates, processar os queryParams
    this.route.queryParams.subscribe(async params => {
      console.log('Query params recebidos:', params);
      if (params['mode'] === 'individual') {
        console.log('Modo individual ativado');
        this.isIndividualMode = true;
        this.individualParticipantId = params['participantId'];
        this.individualParticipantName = params['participantName'];
        this.individualTemplateId = params['templateId'];
        this.individualTemplateName = params['templateName'];

        console.log('Dados do participante:', {
          id: this.individualParticipantId,
          name: this.individualParticipantName,
          templateId: this.individualTemplateId,
          templateName: this.individualTemplateName
        });

        if (params['assessmentId']) {
          console.log('AssessmentId encontrado:', params['assessmentId']);
          this.selectedAssessmentId = params['assessmentId'];
          this.assessmentControl.setValue(params['assessmentId']);

          // Só agora, com os templates carregados, aplicar o template
          if (params['templateId']) {
            this.selectedTemplateId.setValue(params['templateId']);
            await this.aplicarTemplateSelecionado();
          }
          await this.onAssessmentChange();
        }
        setTimeout(() => {
          this.selectedTabIndex = 2;
        }, 100);
      }
    });

    this.assessmentControl.valueChanges.subscribe(id => {
      if (id) {
        this.selectedAssessmentId = id;
        this.onAssessmentChange();
      }
    });

    this.selectedReportId.valueChanges.subscribe(id => {
      if (id) {
        this.carregarRelatorioSelecionado();
      }
    });

    this.selectedTemplateId.valueChanges.subscribe(id => {
      if (id) {
        this.aplicarTemplateSelecionado();
      }
    });

    // Invalidação de cache quando seções são adicionadas/removidas/reordenadas
    this.relatorioFormArray.valueChanges.subscribe(() => {
      this.invalidateCache();
    });

    // Configuração inicial do formulário de relatório
    this.atualizarFormArrayComConfiguracao();
  }

  async loadAssessments() {
    this.loadingService.show('Carregando avaliações...');
    try {
      const assessmentsSnap = await getDocs(collection(this.firestore, 'assessments'));
      this.assessments = assessmentsSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data()['name'] || doc.id
      }));
    } catch (e) {
      console.error("Erro ao carregar avaliações:", e);
      this.snackBar.open('Falha ao carregar as avaliações.', 'Fechar', { duration: 3000 });
    } finally {
      this.loadingService.hide();
    }
  }

  private atualizarFormArrayComConfiguracao() {
    this.relatorioFormArray.clear();
    this.relatorioConfiguracao.forEach(secao => {
      this.relatorioFormArray.push(new FormGroup({
        visivel: new FormControl(secao.visivel),
        titulo: new FormControl(secao.titulo || ''),
        texto: new FormControl(secao.texto || ''),
        competenciasIds: new FormControl(secao.competenciasIds || []),
        id: new FormControl(secao.id),
        tipo: new FormControl(secao.tipo),
        ordem: new FormControl(secao.ordem),
        tipoGrafico: new FormControl(secao['tipoGrafico'] || 'barra'),
        paletaCor: new FormControl(secao['paletaCor'] || 'padrao'),
        coresPersonalizadas: new FormControl(secao['coresPersonalizadas'] || []),
        // Controles para seção de destaques
        numeroItems: new FormControl(secao['numeroItems'] || 5),
        avaliadoSelecionado: new FormControl(secao['avaliadoSelecionado'] || ''),
        mostrarCaracteristica: new FormControl(secao['mostrarCaracteristica'] !== false),
        mostrarPontuacaoSemAuto: new FormControl(secao['mostrarPontuacaoSemAuto'] !== false)
      }));
    });
  }

  async onAssessmentChange() {
    if (!this.selectedAssessmentId) {
      this.dataSource = [];
      this.displayedColumns = [];
      this.dynamicColumns = [];
      this.questionMap = {};
      console.log('❌ Nenhuma avaliação selecionada');
      return;
    }

    // Limpar questionMap antes de recarregar
    this.questionMap = {};
    console.log('🧹 QuestionMap limpo');
    console.log('✅ Avaliação selecionada:', this.selectedAssessmentId);
    console.log('✅ Modo individual:', this.isIndividualMode);
    console.log('✅ Participante ID:', this.individualParticipantId);

    // 🚀 PERFORMANCE: Monitorar tempo de carregamento
    this.performanceMonitor.startTimer('onAssessmentChange');
    this.loadingService.show('Carregando dados da avaliação...');
    this.dataSource = [];
    this.displayedColumns = [];
    this.questionMap = {};
    const assessmentRef = doc(this.firestore, 'assessments', this.selectedAssessmentId);
    const assessmentSnap = await getDoc(assessmentRef);
    if (!assessmentSnap.exists()) {
      this.isLoading = false;
      return;
    }
    const assessmentData = assessmentSnap.data();
    this.selectedClientId = assessmentData['clientId'] || null; // Armazena o clientId
    console.log('📊 AssessmentData:', assessmentData);
    console.log(`🔒 ClientId definido como: ${this.selectedClientId}`);

    // Agora que temos o clientId, podemos carregar as competências
    await this.loadAllCompetencies();

    const surveyJSON = assessmentData['surveyJSON'];
    console.log('📊 SurveyJSON encontrado:', !!surveyJSON);
    console.log('📊 SurveyJSON:', surveyJSON);

    if (!surveyJSON || !surveyJSON.pages) {
      console.log('❌ SurveyJSON não encontrado ou sem páginas');
      this.isLoading = false;
      return;
    }

    // Extrair questões (rows) das perguntas do surveyJSON
    const questions: any[] = [];
    console.log('🔍 Extraindo questões do surveyJSON:', surveyJSON);
    console.log('🔍 Páginas encontradas:', surveyJSON.pages?.length || 0);

    surveyJSON.pages.forEach((page: any, pageIndex: number) => {
      console.log(`🔍 Processando página ${pageIndex}:`, page);
      if (page.elements) {
        console.log(`🔍 Elementos na página ${pageIndex}:`, page.elements.length);
        page.elements.forEach((element: any, elementIndex: number) => {
          console.log(`🔍 Elemento ${elementIndex}:`, element);

          // Para elementos do tipo matrix, extrair as rows (questões)
          if (element.type === 'matrix' && element.rows && Array.isArray(element.rows)) {
            console.log(`✅ Matriz encontrada: ${element.name} com ${element.rows.length} questões`);

            element.rows.forEach((row: any, rowIndex: number) => {
              if (row.value && row.text) {
                // Extrair o texto da questão
                let questionText = '';
                if (row.text && typeof row.text === 'object' && row.text.pt) {
                  questionText = row.text.pt.trim();
                } else if (row.text && typeof row.text === 'string') {
                  questionText = row.text.trim();
                } else {
                  questionText = `Questão ${rowIndex + 1}`;
                }

                // Criar ID único para a questão
                const questionId = `${element.name}_${row.value}`;

                questions.push({
                  id: questionId,
                  title: questionText,
                  type: 'question',
                  parentQuestion: element.name,
                  rowValue: row.value
                });

                this.questionMap[questionId] = questionText;
                console.log(`📝 Questão extraída: ${questionId} = "${questionText}"`);
              }
            });
          }
          // Para outros tipos de perguntas, manter como estava
          else if ((element.type === 'rating' || element.type === 'dropdown' || element.type === 'radiogroup' || element.type === 'comment') && element.name) {
            console.log(`✅ Pergunta encontrada: ${element.name} - ${JSON.stringify(element.title)} (tipo: ${element.type})`);

            // Garantir que o título seja uma string válida
            let questionTitle = '';
            if (element.title && typeof element.title === 'object' && element.title.pt) {
              // Se title é um objeto com propriedades de idioma
              questionTitle = element.title.pt.trim();
            } else if (element.title && typeof element.title === 'string') {
              // Se title é uma string simples
              questionTitle = element.title.trim();
            } else if (element.name && typeof element.name === 'string') {
              questionTitle = element.name.trim();
            } else {
              questionTitle = 'Pergunta sem título';
            }

            questions.push({
              id: element.name,
              title: questionTitle,
              type: element.type
            });

            this.questionMap[element.name] = questionTitle;
            console.log(`📝 QuestionMap[${element.name}] = "${questionTitle}" (tipo: ${typeof questionTitle})`);
            console.log(`   └─ Extraído de: ${JSON.stringify(element.title)}`);
          }
        });
      }
    });

    console.log('📊 Questões extraídas:', questions);
    console.log('📊 QuestionMap:', this.questionMap);

    // Definir colunas da tabela e popular dynamicColumns
    this.displayedColumns = ['data', 'categoria', 'avaliado', 'dataAvaliacao', ...questions.map(q => q.id)];
    this.dynamicColumns = questions.map(q => q.id);

    console.log('📊 DynamicColumns populado:', this.dynamicColumns);
    console.log('📊 DisplayedColumns:', this.displayedColumns);

    // Carregar resultados
    const resultsSnap = await getDocs(collection(this.firestore, `assessments/${this.selectedAssessmentId}/results`));
    console.log('Resultados encontrados:', resultsSnap.docs.length);

    const results: any[] = [];
    for (const resultDoc of resultsSnap.docs) {
      const resultData = resultDoc.data();
      console.log('Resultado individual:', resultData);

      // Buscar dados do participante
      const participantRef = doc(this.firestore, 'participants', resultData['participantId']);
      const participantSnap = await getDoc(participantRef);

      if (participantSnap.exists()) {
        const participantData = participantSnap.data();
        console.log('Dados do participante:', participantData);

        // No modo individual, incluir todos os dados da avaliação
        // mas marcar os dados do avaliado específico para destaque
        let shouldInclude = true;
        let isTargetParticipant = false;

        if (this.isIndividualMode && this.individualParticipantId) {
          // Marcar se é o participante alvo
          if (resultData['participantId'] === this.individualParticipantId) {
            isTargetParticipant = true;
          }

          // Incluir todos os dados da avaliação para ter contexto completo
          shouldInclude = true;
        } else {
          // Modo normal: incluir todos
          shouldInclude = true;
        }

        if (shouldInclude) {
          const row: any = {
            data: '',
            categoria: participantData['category'] || 'N/A',
            avaliado: participantData['name'] || 'N/A',
            dataAvaliacao: resultData['completedAt'] ?
              new Date(resultData['completedAt'].toDate()).toLocaleDateString('pt-BR') : 'N/A',
            isTargetParticipant: isTargetParticipant // Marcar se é o participante alvo
          };

          // Adicionar respostas às perguntas
          if (resultData['surveyData']) {
            questions.forEach(question => {
              row[question.id] = resultData['surveyData'][question.id] || null;
            });
          }

          console.log('Incluindo linha:', {
            participante: participantData['name'],
            tipo: participantData['type'],
            categoria: participantData['category'],
            isIndividualMode: this.isIndividualMode
          });

          results.push(row);
        } else {
          console.log('Excluindo linha:', {
            participante: participantData['name'],
            tipo: participantData['type'],
            categoria: participantData['category'],
            isIndividualMode: this.isIndividualMode
          });
        }
      }
    }

    console.log('Resultados processados:', results);
    this.dataSource = results;
    this.loadingService.hide();
    this.performanceMonitor.endTimer('onAssessmentChange');

    // Mensagem informativa para modo individual
    if (this.isIndividualMode && this.individualParticipantName) {
      const targetParticipantCount = results.filter(r => r.isTargetParticipant).length;
      const totalParticipants = results.length;

      console.log(`Modo individual: ${targetParticipantCount} registros do avaliado alvo, ${totalParticipants} total de participantes`);

      this.snackBar.open(
        `Relatório individual para ${this.individualParticipantName} carregado. ` +
        `(${targetParticipantCount} auto-avaliação, ${totalParticipants} total de participantes na avaliação)`,
        'Fechar',
        { duration: 4000 }
      );
    }

    // Criar índices de dados para performance
    this.createDataIndexes();

          // Debug: Verificar dados no modo individual
      if (this.isIndividualMode) {
        console.log('🔍 DEBUG MODO INDIVIDUAL:');
        console.log('  - Total de participantes:', this.dataSource.length);
        console.log('  - Participantes por categoria:');
        const categorias: { [key: string]: any[] } = {};
        this.dataSource.forEach((participant, index) => {
          const categoria = this.mapCategoriaToGrupo(participant.categoria);
          if (!categorias[categoria]) categorias[categoria] = [];
          categorias[categoria].push({
            index,
            name: participant.avaliado,
            isTarget: participant.isTargetParticipant
          });
        });
        console.log('  - Categorias encontradas:', categorias);

      // Verificar se há dados de respostas
      if (this.dataSource.length > 0) {
        const primeiroParticipante = this.dataSource[0];
        const perguntasComDados = Object.keys(primeiroParticipante).filter(key =>
          key !== 'data' && key !== 'categoria' && key !== 'avaliado' &&
          key !== 'dataAvaliacao' && key !== 'isTargetParticipant' &&
          primeiroParticipante[key] !== undefined && primeiroParticipante[key] !== null
        );
        console.log('  - Perguntas com dados:', perguntasComDados);
        console.log('  - Exemplo de dados do primeiro participante:', primeiroParticipante);
      }
    }

    // Forçar detecção de mudanças
    console.log('🔄 Forçando detecção de mudanças...');
    console.log('🔄 DynamicColumns final:', this.dynamicColumns);
    console.log('🔄 QuestionMap final:', this.questionMap);

    // Forçar detecção de mudanças do Angular
    this.cdr.detectChanges();

    // Avança para o próximo passo do wizard
            this.selectedTabIndex = 1; // Vai para a aba Competências

    // Verificação final
    console.log('✅ Verificação final:');
    console.log('  - DynamicColumns length:', this.dynamicColumns.length);
    console.log('  - QuestionMap keys:', Object.keys(this.questionMap).length);
    console.log('  - QuestionMap values:', Object.values(this.questionMap));
  }

  exportCSV() {
    if (!this.dataSource.length) return;
    const csvRows = [];
    const header = this.displayedColumns.map(col => this.questionMap[col] || col);
    csvRows.push(header.join(','));
    for (const row of this.dataSource) {
      const values = this.displayedColumns.map(col => '"' + (row[col] ?? '').toString().replace(/"/g, '""') + '"');
      csvRows.push(values.join(','));
    }
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'relatorio_avaliacao.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async generatePDFCover() {
    const jsPDFmod = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');
    const element = document.getElementById('report-cover');
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDFmod.jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save('capa-relatorio.pdf');
  }

  async generatePDFSummary() {
    const jsPDFmod = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const pdf = new jsPDFmod.jsPDF('p', 'mm', 'a4');

    pdf.setFontSize(14);
    pdf.text('Resumo do seu feedback do 360', 14, 20);

    autoTable(pdf, {
      startY: 30,
      head: [['Competência', 'Média']],
      body: this.competencyAverages.map(c => [c.title, c.avg.toFixed(2)]).slice(0, 10)
    });
    pdf.addPage();
    autoTable(pdf, { head: [['Mais Altas', 'Média']], body: this.topItems.map(i => [i.title, i.avg.toFixed(2)]) });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const finalY = (pdf as any).lastAutoTable?.finalY || 40;
    autoTable(pdf, { startY: finalY + 10, head: [['Mais Baixas', 'Média']], body: this.lowItems.map(i => [i.title, i.avg.toFixed(2)]) });
    pdf.save('resumo.pdf');
  }

  private buildConsolidationData(dynamicCols: string[], rows: any[]) {
    const map: { [k: string]: { sum: number; count: number } } = {};
    dynamicCols.forEach(k => map[k] = { sum: 0, count: 0 });
    rows.forEach(r => {
      dynamicCols.forEach(k => {
        const num = this.parseNumeric(r[k]);
        if (num !== null) { map[k].sum += num; map[k].count++; }
      });
    });
    const invited = rows.length;
    this.consolidation = dynamicCols.map(k => {
      const avg = map[k].count ? map[k].sum / map[k].count : 0;
      return {
        pergunta: this.questionMap[k] || k,
        sessao: '',
        tema: '',
        resposta: avg.toFixed(2),
        respondentes: map[k].count,
        percent: invited ? ((map[k].count / invited) * 100).toFixed(2) + '%' : '0%',
        score: (avg * 20).toFixed(0)
      };
    });
  }

  exportConsolidationCSV() {
    if (!this.consolidation.length) return;
    const csvRows = [];
    csvRows.push(this.consolidationColumns.join(','));
    for (const row of this.consolidation) {
      const values = this.consolidationColumns.map(col => '"' + (row[col] ?? '').toString().replace(/"/g, '""') + '"');
      csvRows.push(values.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'consolidacao.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private parseNumeric(val: any): number | null {
    if (val === null || val === undefined || val === '') {
      return null;
    }
    const num = Number(val);
    return isNaN(num) ? null : num;
  }

  get selectedAssessmentName(): string {
    return this.assessments.find(a => a.id === this.selectedAssessmentId)?.name || 'Nenhuma';
  }

  // Métodos utilitários para manipular as seções do relatório
  getSecoesVisiveisOrdenadas(): RelatorioSecao[] {
    return this.relatorioConfiguracao
      .filter(secao => secao.visivel)
      .sort((a, b) => a.ordem - b.ordem);
  }

  mostrarSecao(id: string) {
    const secao = this.relatorioConfiguracao.find(s => s.id === id);
    if (secao) secao.visivel = true;
  }

  ocultarSecao(id: string) {
    const secao = this.relatorioConfiguracao.find(s => s.id === id);
    if (secao) secao.visivel = false;
  }

  atualizarTextoSecao(id: string, texto: string) {
    const secao = this.relatorioConfiguracao.find(s => s.id === id);
    if (secao) secao.texto = texto;
  }

  atualizarTituloSecao(id: string, titulo: string) {
    const secao = this.relatorioConfiguracao.find(s => s.id === id);
    if (secao) secao.titulo = titulo;
  }

  // Adiciona uma nova seção customizada logo abaixo do índice fornecido
  addSecaoCustomizadaAbaixo(index: number, tipo: 'texto' | 'graficos' | 'tabela' = 'texto') {
    const id = 'custom_' + Date.now();
    const novaSecao: RelatorioSecao = {
      id,
      tipo,
      titulo: 'Nova Seção',
      texto: '',
      visivel: true,
      ordem: index + 2,
'tipoGrafico': tipo === 'graficos' ? 'barra' : undefined
    };
    this.relatorioConfiguracao.splice(index + 1, 0, novaSecao);
    this.relatorioFormArray.insert(index + 1, new FormGroup({
      visivel: new FormControl(novaSecao.visivel),
      titulo: new FormControl(novaSecao.titulo),
      texto: new FormControl(novaSecao.texto),
      competenciasIds: new FormControl([]),
      id: new FormControl(novaSecao.id),
      tipo: new FormControl(novaSecao.tipo),
      ordem: new FormControl(novaSecao.ordem),
      tipoGrafico: new FormControl('barra'),
      paletaCor: new FormControl('padrao'),
      coresPersonalizadas: new FormControl([])
    }));
    this.relatorioConfiguracao.forEach((s, i) => s.ordem = i + 1);
    this.snackBar.open('Seção adicionada!', 'Fechar', { duration: 2000 });
  }

  getSecaoFormGroup(index: number): FormGroup {
    return this.relatorioFormArray.at(index) as FormGroup;
  }

  atualizarSecaoConfiguracao(index: number) {
    const formValue = this.relatorioFormArray.at(index).value;
    const secao = this.relatorioConfiguracao[index];
    Object.assign(secao, formValue);
    // Garantir que tipoGrafico está sincronizado
    if (secao.tipo === 'graficos' && formValue.tipoGrafico) {
      secao['tipoGrafico'] = formValue.tipoGrafico;
    }
    // Garantir que cores estão sincronizadas
    if (secao.tipo === 'graficos') {
      secao['paletaCor'] = formValue.paletaCor || 'padrao';
      secao['coresPersonalizadas'] = formValue.coresPersonalizadas || [];

      // Se mudou para personalizada e não tem cores, inicializar
      if (secao['paletaCor'] === 'personalizada' && (!secao['coresPersonalizadas'] || secao['coresPersonalizadas'].length === 0)) {
        secao['coresPersonalizadas'] = ['#3498db', '#e74c3c', '#2ecc71'];
        this.getCoresPersonalizadasControl(index).setValue([...secao['coresPersonalizadas']]);
      }
    }

    // 🚀 PERFORMANCE: Invalidar cache quando configuração da seção muda
    this.invalidateCache(`secao-${secao.id}`);

    console.log(`Seção ${index} atualizada:`, secao);
  }

  get relatorioFormGroups(): FormGroup[] {
    return this.relatorioFormArray.controls as FormGroup[];
  }

  getOrInitTextoCompetencia(secao: RelatorioSecao, comp: Competency): string {
    if (!secao.textosPorCompetencia) {
      secao.textosPorCompetencia = {};
    }
    if (!secao.textosPorCompetencia[comp.id!]) {
      // Cria o texto padrão a partir das perguntas
      secao.textosPorCompetencia[comp.id!] = comp.questionIds
        .map(pId => this.questionMap[pId] || '')
        .join('. ');
    }
    return secao.textosPorCompetencia[comp.id!];
  }

  // Mapeamento de categorias do banco para os grupos do relatório
  private mapCategoriaToGrupo(categoria: string): string {
    if (!categoria) return 'Outros';
    const map: { [key: string]: string } = {
      'Avaliado': 'Avaliado(a)',
      'Avaliado(a)': 'Avaliado(a)',
      'Gestor': 'Gestor(es)',
      'Gestor(es)': 'Gestor(es)',
      'Par': 'Pares',
      'Pares': 'Pares',
      'Subordinado': 'Subordinados',
      'Subordinados': 'Subordinados',
      'Outro': 'Outros',
      'Outros': 'Outros',
    };
    return map[categoria] || categoria;
  }

  // 🚀 PERFORMANCE: Retorna as médias por característica e grupo de avaliadores para o bloco de Resumo
  getResumoMedias() {
    return this.getCachedCalculation('resumo-medias', () => {
      const grupos = ['Avaliado(a)', 'Gestor(es)', 'Pares', 'Subordinados', 'Outros'];
      const secaoResumo = this.relatorioConfiguracao.find(s => s.tipo === 'resumo');
      if (!secaoResumo || !secaoResumo.competenciasIds?.length) {
        console.log('[Resumo] Nenhuma competência selecionada na seção de resumo.');
        return [];
      }
      const competenciasSelecionadas = this.competencias.filter(c => secaoResumo.competenciasIds!.includes(c.id!));
      console.log('[Resumo] Competências selecionadas:', competenciasSelecionadas.map(c => ({ id: c.id, name: c.name, questionIds: c.questionIds })));

      if (this.dataSource.length) {
        console.log('[Resumo] Exemplo de linha do dataSource:', this.dataSource[0]);
      }

      const resultado: any[] = [];
      for (const comp of competenciasSelecionadas) {
        const perguntas = comp.questionIds;
        console.log(`[Resumo] Processando competência: ${comp.name} (Perguntas: ${perguntas})`);

        for (const grupo of grupos) {
          let soma = 0;
          let count = 0;

          // 🚀 PERFORMANCE: Usar índice para buscar dados por categoria
          const indicesGrupo = this.dataIndexes.participantes.get(grupo) || [];

          for (const index of indicesGrupo) {
            const row = this.dataSource[index];
            for (const pid of perguntas) {
              const val = this.parseNumeric(row[pid]);
              console.log(`[Resumo] Valor encontrado para pid='${pid}':`, val);
              if (val !== null) {
                soma += val;
                count++;
              }
            }
          }

          const media = count ? soma / count : 0;
          console.log(`[Resumo] Competência: ${comp.name}, Grupo: ${grupo}, Soma: ${soma}, Count: ${count}, Média: ${media}`);
          resultado.push({
            competencia: comp.name,
            description: comp.description,
            grupo,
            media: media
          });
        }
      }
      return resultado;
    });
  }

  // 🚀 PERFORMANCE: Retorna as médias organizadas por característica para melhor apresentação no relatório
  getResumoMediasPorCompetencia() {
    return this.getCachedCalculation('resumo-medias-por-competencia', () => {
      const resumoMedias = this.getResumoMedias();

      // Verificar se há dados válidos
      if (!resumoMedias || resumoMedias.length === 0) {
        return [];
      }

      const competenciasAgrupadas: { [key: string]: any } = {};

      for (const linha of resumoMedias) {
        // Verificar se a linha tem dados válidos
        if (!linha || !linha.competencia) {
          continue;
        }

        if (!competenciasAgrupadas[linha.competencia]) {
          competenciasAgrupadas[linha.competencia] = {
            name: linha.competencia,
            description: linha.description || '',
            dados: []
          };
        }

        // Garantir que sempre temos um valor numérico válido
        const mediaValida = (linha.media !== null && !isNaN(linha.media)) ? linha.media : 0;
        competenciasAgrupadas[linha.competencia].dados.push({
          grupo: linha.grupo || 'Sem grupo',
          media: mediaValida
        });
      }

      return Object.values(competenciasAgrupadas);
    });
  }

  // 🚀 PERFORMANCE: Métodos utilitários para gráficos dinâmicos na visualização do relatório
  getSecaoStackedData(secao: any) {
    const competenciasSelecionadas = this.getCompetenciasSelecionadasParaGraficos(secao);
    if (competenciasSelecionadas.length === 0) return [];

    return competenciasSelecionadas.map(comp => {
      const series = this.getGrupos().map(grupo => {
        const media = this.getMediaPorPerguntaEGrupo(comp, grupo);
        // Garantir que sempre retornamos um valor numérico válido
        const valor = (media !== null && !isNaN(media) && media >= 0) ? media : 0;
        return {
          name: grupo,
          value: valor
        };
      });

      return {
        name: comp.name,
        series: series
      };
    });
  }

  getSecaoPieData(secao: any) {
    const competenciasSelecionadas = this.getCompetenciasSelecionadasParaGraficos(secao);
    const grupos = this.getGrupos();

    const result = competenciasSelecionadas.map(comp => {
      // Calcular média geral de todas as categorias para a competência
      let somaTotal = 0;
      let contadorTotal = 0;

      grupos.forEach(grupo => {
        const media = this.getMediaPorPerguntaEGrupo(comp, grupo);
        if (media !== null && !isNaN(media)) {
          somaTotal += media;
          contadorTotal++;
        }
      });

      const mediaGeral = contadorTotal > 0 ? somaTotal / contadorTotal : 0;

      return {
        name: comp.name,
        value: mediaGeral
      };
    });

    return result;
  }

  // Métodos para gráficos individuais por característica
  getCompetenciaStackedData(comp: Competency) {
    const grupos = this.getGrupos();
    return grupos.map(grupo => {
      const media = this.getMediaPorPerguntaEGrupo(comp, grupo);
      // Garantir que apenas valores válidos sejam retornados
      const valor = (media !== null && !isNaN(media)) ? media : 0;
      return {
        name: grupo,
        value: valor
      };
    });
  }

  getCompetenciaRadarOptions(comp: Competency): EChartsOption {
    const stackedData = this.getCompetenciaStackedData(comp);
    if (!stackedData.length) return {};

    const indicator = stackedData.map((d: any) => ({ name: d.name, max: 5 }));
    const seriesData = [{
      name: comp.name,
      value: stackedData.map((d: any) => d.value)
    }];

    return {
      legend: { top: 'bottom' },
      radar: { indicator },
      series: [{
        type: 'radar' as const,
        data: seriesData
      }]
    };
  }

  getSecaoRadarOptions(secao: any): EChartsOption {
    const competenciasSelecionadas = this.getCompetenciasSelecionadasParaGraficos(secao);
    const grupos = this.getGrupos();

    if (competenciasSelecionadas.length === 0 || grupos.length === 0) {
      return {};
    }

    // Criar indicadores baseados nos grupos de avaliadores
    const indicator = grupos.map(grupo => ({ name: grupo, max: 5 }));

    // Criar dados das séries para cada competência
    const seriesData = competenciasSelecionadas.map(comp => {
      const values = grupos.map(grupo => {
        const media = this.getMediaPorPerguntaEGrupo(comp, grupo);
        return (media !== null && !isNaN(media)) ? media : 0;
      });

      return {
        name: comp.name,
        value: values
      };
    });

    return {
      legend: {
        top: 'bottom',
        data: competenciasSelecionadas.map(comp => comp.name)
      },
      radar: { indicator },
      series: [{
        type: 'radar' as const,
        data: seriesData
      }]
    };
  }

  getCompetenciaPieData(comp: Competency) {
    const grupos = this.getGrupos();
    return grupos.map(grupo => {
      const media = this.getMediaPorPerguntaEGrupo(comp, grupo);
      // Garantir que apenas valores válidos sejam retornados
      const valor = (media !== null && !isNaN(media)) ? media : 0;
      return {
        name: grupo,
        value: valor
      };
    });
  }

  onTipoGraficoChange(secao: any, i: number) {
    secao['tipoGrafico'] = this.getTipoGraficoControl(i).value;
  }

  getTipoGraficoControl(i: number): FormControl {
    const formGroup = this.relatorioFormGroups[i];
    if (!formGroup) {
      console.warn(`FormGroup não encontrado no índice ${i}`);
      return new FormControl('barra'); // Valor padrão
    }

    let control = formGroup.get('tipoGrafico') as FormControl;
    if (!control) {
      // Se não existe, criar o controle
      control = new FormControl('barra');
      formGroup.addControl('tipoGrafico', control);
    }

    return control;
  }

  getPaletaCorControl(i: number): FormControl {
    const control = this.relatorioFormGroups[i]?.get('paletaCor') as FormControl;
    if (!control) {
      console.error(`FormControl 'paletaCor' não encontrado no índice ${i}`);
    }
    return control;
  }

  getCoresPersonalizadasControl(i: number): FormControl {
    const control = this.relatorioFormGroups[i]?.get('coresPersonalizadas') as FormControl;
    if (!control) {
      console.error(`FormControl 'coresPersonalizadas' não encontrado no índice ${i}`);
    }
    return control;
  }

      getColorSchemeParaSecao(secao: any): any {
    const paletaSelecionada = secao?.paletaCor || secao?.['paletaCor'] || 'padrao';

    console.log('getColorSchemeParaSecao chamado:', { secao, paletaSelecionada });

    if (paletaSelecionada === 'personalizada') {
      const coresPersonalizadas = secao?.coresPersonalizadas || secao?.['coresPersonalizadas'] || [];
      if (coresPersonalizadas.length > 0) {
        console.log('Usando cores personalizadas:', coresPersonalizadas);
        return { domain: coresPersonalizadas };
      } else {
        // Se não tem cores personalizadas, usar cores padrão da paleta personalizada
        console.log('Usando cores padrão da paleta personalizada');
        return { domain: this.paletasCores['personalizada'].cores };
      }
    }

    const paletas = this.paletasCores as any;
    const cores = paletas[paletaSelecionada]?.cores || this.paletasCores['padrao'].cores;
    console.log('Usando paleta pré-definida:', paletaSelecionada, cores);
    return { domain: cores };
  }

  onPaletaCorChange(secao: any, i: number) {
    const paletaValue = this.getPaletaCorControl(i).value;
    secao['paletaCor'] = paletaValue;

    // Se mudou para personalizada e não tem cores, inicializar com algumas cores padrão
    if (paletaValue === 'personalizada' && (!secao['coresPersonalizadas'] || secao['coresPersonalizadas'].length === 0)) {
      secao['coresPersonalizadas'] = ['#3498db', '#e74c3c', '#2ecc71'];
      this.getCoresPersonalizadasControl(i).setValue([...secao['coresPersonalizadas']]);
    }

    this.invalidateCache(`secao-${secao.id}`);
    console.log(`Paleta alterada para: ${paletaValue}`, secao);
  }

  adicionarCorPersonalizada(secao: any, i: number) {
    console.log('Adicionando nova cor personalizada', secao);

    if (!secao['coresPersonalizadas']) {
      secao['coresPersonalizadas'] = [];
    }

    // Adicionar uma cor aleatória para facilitar a visualização
    const coresDefault = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];
    const corDefault = coresDefault[secao['coresPersonalizadas'].length % coresDefault.length];

    secao['coresPersonalizadas'].push(corDefault);
    this.getCoresPersonalizadasControl(i).setValue([...secao['coresPersonalizadas']]);
    this.invalidateCache(`secao-${secao.id}`);

    console.log('Cor adicionada:', corDefault, 'Array atual:', secao['coresPersonalizadas']);
  }

  removerCorPersonalizada(secao: any, i: number, index: number) {
    console.log(`Removendo cor no índice ${index}`, secao);

    if (secao['coresPersonalizadas'] && secao['coresPersonalizadas'][index] !== undefined) {
      secao['coresPersonalizadas'].splice(index, 1);
      this.getCoresPersonalizadasControl(i).setValue([...secao['coresPersonalizadas']]);
      this.invalidateCache(`secao-${secao.id}`);
      console.log('Cores após remoção:', secao['coresPersonalizadas']);
    }
  }

  atualizarCorPersonalizada(secao: any, i: number, index: number, event: any) {
    const novaCor = event.target ? event.target.value : event;
    console.log(`Atualizando cor ${index} para: ${novaCor}`, secao);

    // Garantir que o array existe
    if (!secao['coresPersonalizadas']) {
      secao['coresPersonalizadas'] = [];
    }

    // Expandir o array se necessário
    while (secao['coresPersonalizadas'].length <= index) {
      secao['coresPersonalizadas'].push('#3498db');
    }

    // Atualizar a cor
    secao['coresPersonalizadas'][index] = novaCor;

    // Sincronizar com FormControl
    this.getCoresPersonalizadasControl(i).setValue([...secao['coresPersonalizadas']]);

    // Invalidar cache
    this.invalidateCache(`secao-${secao.id}`);

    console.log('Cores após atualização:', secao['coresPersonalizadas']);
  }

  // Grupos padrão
  getGrupos() {
    // Grupos padrão que sempre devem aparecer
    const gruposPadrao = ['Avaliado(a)', 'Gestor(es)', 'Pares', 'Subordinados', 'Outros'];

    // Grupos encontrados nos dados
    const gruposEncontrados = Array.from(this.dataIndexes.participantes.keys());

    // Combinar grupos padrão com grupos encontrados, removendo duplicatas
    const todosGrupos = [...new Set([...gruposPadrao, ...gruposEncontrados])];

    return todosGrupos;
  }

  // Método auxiliar para obter característica por ID
  getCompetenciaPorId(id: string): Competency | undefined {
    return this.competencias.find(c => c.id === id);
  }

  // Características selecionadas para a seção de gráficos
  getCompetenciasSelecionadasParaGraficos(secao: any): Competency[] {
    const result = (!secao || !secao.competenciasIds) ? [] : this.competencias.filter(c => secao.competenciasIds.includes(c.id!));
    // console.log('🔍 getCompetenciasSelecionadasParaGraficos() - secao:', secao);
    // console.log('🔍 getCompetenciasSelecionadasParaGraficos() - result:', result);
    return result;
  }

  getCompetenciasSelecionadasParaSecao(secao: RelatorioSecao): Competency[] {
    if (!secao || !secao.competenciasIds) {
      return [];
    }
    return this.competencias.filter(c => secao.competenciasIds!.includes(c.id!));
  }

  getCompetenciasSelecionadasParaTabela() {
    const secaoTabela = this.relatorioConfiguracao.find(s => s.tipo === 'tabela');
    if (!secaoTabela || !secaoTabela.competenciasIds) {
      return [];
    }
    return this.competencias.filter(c => secaoTabela.competenciasIds!.includes(c.id!));
  }

  // Lista de respostas para uma pergunta e grupo
  getRespostasPorPerguntaEGrupo(perguntaId: string, grupo: string) {
    return this.dataSource
      .filter(row => this.mapCategoriaToGrupo(row['categoria']) === grupo)
      .map(row => row[perguntaId])
      .filter(val => val !== undefined && val !== null && val !== '');
  }

  // Média para uma característica e grupo
  getMediaPorPerguntaEGrupo(carac: any, grupo: string) {
    let soma = 0;
    let count = 0;
    for (const pid of carac.questionIds || []) {
      for (const row of this.dataSource) {
        if (this.mapCategoriaToGrupo(row['categoria']) === grupo) {
          let valor = row[pid];

          // Aplicar o mesmo processamento usado em getRespostasParaPerguntaEGrupo
          if (typeof valor === 'string') {
            if (valor.includes('Column')) {
              // Formato: "Column 1" → 1
              const match = valor.match(/Column (\d+)/);
              if (match) {
                valor = parseInt(match[1]);
              }
            } else {
              // Tentar converter string diretamente para número
              valor = parseFloat(valor);
            }
          }

          const valorNumerico = Number(valor);
          if (!isNaN(valorNumerico) && valorNumerico >= 1 && valorNumerico <= 5) {
            soma += valorNumerico;
            count++;
          }
        }
      }
    }
    return count ? soma / count : null;
  }

  // Média específica do participante alvo (modo individual)
  getMediaParticipanteAlvo(carac: any) {
    if (!this.isIndividualMode || !this.individualParticipantId) {
      return null;
    }

    let soma = 0;
    let count = 0;

    for (const pid of carac.questionIds || []) {
      for (const row of this.dataSource) {
        if (row.isTargetParticipant) {
          let valor = row[pid];

          if (typeof valor === 'string') {
            if (valor.includes('Column')) {
              const match = valor.match(/Column (\d+)/);
              if (match) {
                valor = parseInt(match[1]);
              }
            } else {
              valor = parseFloat(valor);
            }
          }

          const valorNumerico = Number(valor);
          if (!isNaN(valorNumerico) && valorNumerico >= 1 && valorNumerico <= 5) {
            soma += valorNumerico;
            count++;
          }
        }
      }
    }

    return count ? soma / count : null;
  }

  // Validação antes de salvar relatório
  private validarRelatorio(): string | null {
    if (!this.selectedAssessmentId) return "Nenhuma avaliação foi selecionada.";
    if (this.relatorioFormArray.length === 0) return "O relatório não tem seções.";
    if (this.competencias.length === 0) return "Nenhuma competência foi cadastrada.";
    return null;
  }

  // Atualizar método de salvar relatório para validar e mostrar snackbar
  async salvarRelatorioNoFirebase() {
    const erro = this.validarRelatorio();
    if (erro) {
      this.snackBar.open(erro, 'Fechar', { duration: 3000 });
      return;
    }
    if (!this.nomeRelatorioControl.value) {
      this.snackBar.open('Por favor, dê um nome ao relatório.', 'Fechar', { duration: 3000 });
      return;
    }
    // Buscar nome da avaliação selecionada
    const assessment = this.assessments.find(a => a.id === this.selectedAssessmentId);
    const reportData = {
      nome: this.nomeRelatorioControl.value,
      assessmentId: this.selectedAssessmentId,
      assessmentName: assessment ? assessment.name : '',
      competenciasIds: this.competencias.map(c => c.id), // Salvar apenas os IDs
      configuracao: this.relatorioConfiguracao,
      criadoEm: new Date()
    };
    try {
      const docRef = await addDoc(collection(this.firestore, 'reports'), reportData);
      this.snackBar.open(`Relatório '${reportData.nome}' salvo com sucesso!`, 'Fechar', { duration: 3000 });
      this.nomeRelatorioControl.reset();
      this.carregarRelatoriosSalvos(); // Atualiza a lista
    } catch (e) {
      console.error('Erro ao salvar relatório: ', e);
      this.snackBar.open('Ocorreu um erro ao salvar o relatório.', 'Fechar', { duration: 3000 });
    }
  }

  async carregarRelatoriosSalvos() {
    const reportsSnap = await getDocs(collection(this.firestore, 'reports'));
    this.savedReports = reportsSnap.docs.map(doc => ({
      id: doc.id,
      name: doc.data()['nome'] || doc.id
    }));
  }

  async carregarRelatorioSelecionado() {
    if (!this.selectedReportId.value) return;

    this.loadingService.show('Carregando relatório...');
    try {
      const reportRef = doc(this.firestore, 'reports', this.selectedReportId.value);
      const reportSnap = await getDoc(reportRef);

      if (reportSnap.exists()) {
        const reportData = reportSnap.data();

        // 1. Restaurar o assessmentId e carregar seus dados
        if (reportData['assessmentId']) {
          this.assessmentControl.setValue(reportData['assessmentId'], { emitEvent: false });
          this.selectedAssessmentId = reportData['assessmentId'];
          await this.onAssessmentChange(); // Recarrega todos os dados da avaliação
        }

        // 2. Restaurar a configuração das seções
        this.relatorioConfiguracao = reportData['configuracao'] || [];

        // 3. Restaurar as competências selecionadas
        const competenciasIds = reportData['competenciasIds'] || [];
        this.competencias = this.allCompetencies.filter(c => competenciasIds.includes(c.id));

        // 4. Atualizar o formulário e avançar no wizard
        this.atualizarFormArrayComConfiguracao();
        this.selectedTabIndex = 2; // Vai para a aba Configurar Relatório

        this.snackBar.open(`Relatório '${reportData['nome']}' carregado!`, 'Fechar', { duration: 3000 });
      }
    } catch (error) {
      console.error("Erro ao carregar relatório:", error);
      this.snackBar.open('Falha ao carregar o relatório.', 'Fechar', { duration: 3000 });
    } finally {
      this.loadingService.hide();
      this.cdr.detectChanges();
    }
  }

  // Adiciona uma nova seção customizada ao relatório
  addSecaoCustomizada(tipo: 'texto' | 'graficos' | 'tabela' | 'competencia_detalhada' | 'grafico_defasagem' | 'grafico_radar' = 'texto') {
    const novaSecao: RelatorioSecao = {
          id: `custom_${new Date().getTime()}`,
      tipo: tipo,
      titulo: '',
          texto: '',
          visivel: true,
      ordem: this.relatorioConfiguracao.length + 1
    };

    switch (tipo) {
      case 'texto':
        novaSecao.titulo = 'Nova Seção de Texto';
        novaSecao.texto = 'Escreva seu conteúdo aqui...';
        break;
      case 'graficos':
        novaSecao.titulo = 'Nova Seção de Gráficos';
        novaSecao.competenciasIds = [];
        (novaSecao as any)['tipoGrafico'] = 'barra';
        (novaSecao as any)['paletaCor'] = 'padrao';
        (novaSecao as any)['coresPersonalizadas'] = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'];
        break;
      case 'tabela':
        novaSecao.titulo = 'Nova Tabela Detalhada';
        novaSecao.competenciasIds = [];
        break;
      case 'competencia_detalhada':
        novaSecao.titulo = 'Tabela Detalhada por Competência';
        novaSecao.competenciasIds = [];
        break;
       case 'grafico_defasagem':
        novaSecao.titulo = 'Gráfico de Defasagem (Gap Analysis)';
        novaSecao.competenciasIds = [];
        break;
      case 'grafico_radar':
        novaSecao.titulo = 'Gráfico de Radar Comparativo';
        novaSecao.competenciasIds = this.competencias.map(c => c.id!);
        break;
    }

    // Adiciona a nova seção à configuração
    this.relatorioConfiguracao.push(novaSecao);
    this.atualizarFormArrayComConfiguracao();
  }

  // Remove uma seção do relatório pelo índice
  removerSecao(index: number) {
    const titulo = this.relatorioConfiguracao[index]?.titulo || 'Seção';
    this.relatorioConfiguracao.splice(index, 1);
    this.relatorioFormArray.removeAt(index);
    // Atualiza ordem
    this.relatorioConfiguracao.forEach((s, i) => s.ordem = i + 1);
    this.snackBar.open(`Seção removida: ${titulo}`, 'Fechar', { duration: 2500 });
  }

  // Método para drag-and-drop das seções
  dropSecao(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.relatorioConfiguracao, event.previousIndex, event.currentIndex);
    moveItemInArray(this.relatorioFormArray.controls, event.previousIndex, event.currentIndex);
    // Atualiza ordem
    this.relatorioConfiguracao.forEach((s, i) => s.ordem = i + 1);
  }

  // Métodos auxiliares para UI das seções
  getTipoSecaoColor(tipo: string): string {
    switch (tipo) {
      case 'capa': return '#42A5F5';
      case 'introducao': return '#66BB6A';
      case 'resumo': return '#AB47BC';
      case 'graficos': return '#FFA726';
      case 'grafico_defasagem': return '#FF7043';
      case 'tabela': return '#EF5350';
      case 'competencia_detalhada': return '#EF5350';
      case 'destaques': return '#FFCA28';
      case 'custom': return '#8D6E63';
      case 'texto': return '#78909C';
      default: return '#BDBDBD';
    }
  }

  getTipoSecaoLabel(tipo: string): string {
    switch (tipo) {
      case 'capa': return 'Capa';
      case 'introducao': return 'Introdução';
      case 'resumo': return 'Resumo de Competências';
      case 'graficos': return 'Gráficos Customizados';
              case 'grafico_defasagem': return 'Gráfico de Defasagem (Gap)';
        case 'grafico_radar': return 'Gráfico de Radar';
      case 'tabela': return 'Tabela de Consolidação';
      case 'competencia_detalhada': return 'Tabela por Competência';
      case 'destaques': return 'Pontos de Destaque';
      case 'custom': return 'Customizado';
      case 'texto': return 'Bloco de Texto';
      default: return 'Desconhecido';
    }
  }

  // Resetar relatório para configuração padrão
  resetarRelatorio() {
    this.relatorioConfiguracao = [
      {
        id: 'capa',
        tipo: 'capa',
        titulo: 'Relatório Feedback 360°',
        texto: '',
        visivel: true,
        ordem: 1
      },
      {
        id: 'introducao',
        tipo: 'introducao',
        titulo: 'Introdução',
        texto: 'Texto introdutório do relatório...',
        visivel: true,
        ordem: 2
      },
      {
        id: 'resumo',
        tipo: 'resumo',
        titulo: 'Resumo dos Resultados nas Competências',
        texto: '',
        visivel: true,
        ordem: 3,
        competenciasIds: []
      },
      {
        id: 'graficos',
        tipo: 'graficos',
        titulo: 'Gráficos',
        texto: '',
        visivel: true,
        ordem: 4,
        competenciasIds: [],
        'tipoGrafico': 'barra',
        'paletaCor': 'azul',
        'coresPersonalizadas': []
      },
      {
        id: 'tabela',
        tipo: 'tabela',
        titulo: 'Tabela de Frequência',
        texto: '',
        visivel: true,
        ordem: 5,
        competenciasIds: []
      },
      {
        id: 'destaques',
        tipo: 'destaques',
        titulo: 'Avaliações mais altas',
        texto: `
          <p>Esta seção apresenta os comportamentos em que você obteve as maiores pontuações, destacando seus pontos fortes segundo a perspectiva dos avaliadores.</p>
        `,
        visivel: true,
        ordem: 5,
        numeroItems: 5,
        avaliadoSelecionado: '',
        mostrarCaracteristica: true,
        mostrarPontuacaoSemAuto: true
      }
    ];
    this.atualizarFormArrayComConfiguracao();
    this.snackBar.open('Relatório resetado para configuração padrão!', 'Fechar', { duration: 2500 });
  }

  // Salvar template no Firestore
  async salvarTemplateNoFirebase() {
    if (!this.nomeTemplateControl.value) {
      this.snackBar.open('Por favor, dê um nome ao template.', 'Fechar', { duration: 3000 });
      return;
    }
    const templateData = {
      nome: this.nomeTemplateControl.value,
      assessmentId: this.selectedAssessmentId, // Adicionado para contexto
      configuracao: this.relatorioConfiguracao,
      competenciasIds: this.competencias.map(c => c.id), // Salvar apenas os IDs
      criadoEm: new Date()
    };
    try {
      const docRef = await addDoc(collection(this.firestore, 'reportTemplates'), templateData);
      this.snackBar.open(`Template '${templateData.nome}' salvo com sucesso!`, 'Fechar', { duration: 3000 });
      this.nomeTemplateControl.reset();
      this.carregarTemplatesSalvos();
    } catch (e) {
      console.error('Erro ao salvar template: ', e);
      this.snackBar.open('Ocorreu um erro ao salvar o template.', 'Fechar', { duration: 3000 });
    }
  }

  // Carregar lista de templates salvos
  async carregarTemplatesSalvos() {
    const templatesSnap = await getDocs(collection(this.firestore, 'reportTemplates'));
    this.savedTemplates = templatesSnap.docs.map(doc => ({
      id: doc.id,
      name: doc.data()['nome'] || doc.id
    }));
  }

  // Aplicar template selecionado ao relatório atual
  async aplicarTemplateSelecionado() {
    if (!this.selectedTemplateId.value) return;

    this.loadingService.show('Aplicando template...');
    try {
      const templateRef = doc(this.firestore, 'reportTemplates', this.selectedTemplateId.value);
      const templateSnap = await getDoc(templateRef);

      if (templateSnap.exists()) {
        const templateData = templateSnap.data();

        // 1. Verificar se o template tem um assessmentId e se ele é diferente do atual
        if (templateData['assessmentId'] && templateData['assessmentId'] !== this.selectedAssessmentId) {
          // Se for diferente, o usuário deve ser avisado. Por enquanto, vamos carregar
          this.assessmentControl.setValue(templateData['assessmentId'], { emitEvent: false });
          this.selectedAssessmentId = templateData['assessmentId'];
          await this.onAssessmentChange();
        }

        // 2. Restaurar configuração das seções
        this.relatorioConfiguracao = templateData['configuracao'] || [];

        // 3. Restaurar competências
        const competenciasIds = templateData['competenciasIds'] || [];
        this.competencias = this.allCompetencies.filter(c => competenciasIds.includes(c.id));

        // 4. Atualizar o form
        this.atualizarFormArrayComConfiguracao();
        this.selectedTabIndex = 2; // Vai para a aba Configurar Relatório

        this.snackBar.open(`Template '${templateData['nome']}' aplicado!`, 'Fechar', { duration: 2500 });
      }
    } catch (error) {
       console.error("Erro ao aplicar template:", error);
      this.snackBar.open('Falha ao aplicar o template.', 'Fechar', { duration: 3000 });
    } finally {
      this.loadingService.hide();
      this.cdr.detectChanges();
    }
  }

  // Exportar relatório completo como PDF
  async exportarRelatorioPDF() {
    const jsPDFmod = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');
    const element = document.getElementById('report-preview');
    if (!element) {
      this.snackBar.open('Não foi possível encontrar o preview do relatório.', 'Fechar', { duration: 3000 });
      return;
    }
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDFmod.jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15; // margem em mm
    const imgWidth = pageWidth - 2 * margin;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - 2 * margin;
    while (heightLeft > 0) {
      position = position - (pageHeight - 2 * margin);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 2 * margin;
    }

    // Nome do arquivo baseado no modo
    let fileName = 'relatorio-360.pdf';
    if (this.isIndividualMode && this.individualParticipantName) {
      const sanitizedName = this.individualParticipantName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      fileName = `relatorio-${sanitizedName}.pdf`;
    }

    pdf.save(fileName);
    this.snackBar.open('PDF exportado com sucesso!', 'Fechar', { duration: 3000 });
  }

  // Teste com dados estáticos para verificar se o gráfico funciona
  getTestStackedData() {
    return [
      {
        name: 'Competência Teste',
        series: [
          { name: 'Gestor(es)', value: 4.2 },
          { name: 'Pares', value: 3.8 }
        ]
      }
    ];
  }

  // Esquema de cores para teste
  testColorScheme: any = {
    domain: ['#E3F2FD', '#90CAF9', '#42A5F5', '#1E88E5']
  };

  // Método de debug específico para gráficos
  debugGraficos(): void {
    console.group(' DEBUG GRÁFICOS');

    // Verificar seção de gráficos
    const secaoGraficos = this.relatorioConfiguracao.find(s => s.tipo === 'graficos');
    console.log('Seção de gráficos encontrada:', secaoGraficos);

    if (secaoGraficos) {
      console.log('Competências selecionadas:', secaoGraficos.competenciasIds);
      console.log('Tipo de gráfico:', secaoGraficos['tipoGrafico']);

      // Verificar dados para diferentes tipos de gráficos
      const dadosBarras = this.getSecaoStackedData(secaoGraficos);
      console.log('Dados para gráfico de barras:', dadosBarras);

      const dadosPizza = this.getSecaoPieData(secaoGraficos);
      console.log('Dados para gráfico de pizza:', dadosPizza);

      // Verificar dados para barras individuais
      if (secaoGraficos['tipoGrafico'] === 'barras-individuais') {
        const competenciasSelecionadas = this.getCompetenciasSelecionadasParaGraficos(secaoGraficos);
        console.log('Dados para barras individuais:');
        competenciasSelecionadas.forEach(comp => {
          const dadosIndividuais = this.getCompetenciaStackedData(comp);
          console.log(`- ${comp.name}:`, dadosIndividuais);
        });
      }

      // Verificar se há dados válidos para barras
      if (dadosBarras.length > 0) {
        console.log('Primeiro item dos dados de barras:', dadosBarras[0]);
        if (dadosBarras[0].series) {
          console.log('Série do primeiro item:', dadosBarras[0].series);
        }
      }

      // Verificar se há dados válidos para pizza
      if (dadosPizza.length > 0) {
        console.log('Primeiro item dos dados de pizza:', dadosPizza[0]);
      }

      // Verificar esquema de cores
      const esquemaCores = this.getColorSchemeParaSecao(secaoGraficos);
      console.log('Esquema de cores:', esquemaCores);
    }

    // Verificar competências individuais
    if (this.competencias.length > 0) {
      console.log('Testando primeira competência:', this.competencias[0].name);

      const dadosCompetencia = this.getCompetenciaPieData(this.competencias[0]);
      console.log('Dados da competência:', dadosCompetencia);

      // Verificar médias por grupo
      const grupos = this.getGrupos();
      grupos.forEach(grupo => {
        const media = this.getMediaPorPerguntaEGrupo(this.competencias[0], grupo);
        console.log(`Média para ${grupo}:`, media);
      });
    }

    console.groupEnd();
  }

  // Método para gerar tabela detalhada de competência com distribuição de notas
  gerarTabelaCompetencia(competencia: Competency): TabelaCompetencia {
    if (!this.selectedAssessmentId || !this.dataSource.length) {
      return {
        competencia,
        linhas: [],
        mediasGerais: []
      };
    }

    const grupos = this.getGrupos();
    const linhas: LinhaTabela[] = [];

    // Para cada pergunta da competência, calcular distribuição de notas
    competencia.questionIds.forEach((perguntaId: string) => {
      const perguntaTexto = this.questionMap[perguntaId] || `Pergunta ${perguntaId}`;
      const categorias: DadosCategoria[] = [];

      grupos.forEach(grupo => {
        const respostasGrupo = this.getRespostasParaPerguntaEGrupo(perguntaId, grupo);
        const distribuicao = this.calcularDistribuicaoNotas(respostasGrupo);
        const media = this.calcularMediaDistribuicao(distribuicao);

        categorias.push({
          categoria: grupo,
          distribuicao,
          media,
          totalRespostas: respostasGrupo.length
        });
      });

      linhas.push({
        pergunta: perguntaTexto,
        perguntaId,
        categorias
      });
    });

    // Calcular médias gerais por categoria
    const mediasGerais: DadosCategoria[] = grupos.map(grupo => {
      const todasRespostasGrupo: number[] = [];

      competencia.questionIds.forEach((perguntaId: string) => {
        const respostas = this.getRespostasParaPerguntaEGrupo(perguntaId, grupo);
        todasRespostasGrupo.push(...respostas);
      });

      const distribuicao = this.calcularDistribuicaoNotas(todasRespostasGrupo);
      const media = this.calcularMediaDistribuicao(distribuicao);

      return {
        categoria: grupo,
        distribuicao,
        media,
        totalRespostas: todasRespostasGrupo.length
      };
    });

    return {
      competencia,
      linhas,
      mediasGerais
    };
  }

  // Método auxiliar para obter respostas de uma pergunta específica para um grupo
  private getRespostasParaPerguntaEGrupo(perguntaId: string, grupo: string): number[] {
    const respostas: number[] = [];

    // Se o grupo for 'Todos', processar todos os dados
    if (grupo === 'Todos') {
      this.dataSource.forEach(participant => {
        if (participant && participant[perguntaId] !== undefined) {
          let valor = participant[perguntaId];

          // Tratar diferentes formatos de dados
          if (typeof valor === 'string') {
            // Se for string, tentar extrair número
            if (valor.includes('Column')) {
              // Formato: "Column 1" → 1
              const match = valor.match(/Column (\d+)/);
              if (match) {
                valor = parseInt(match[1]);
              }
            } else {
              // Tentar converter string diretamente para número
              valor = parseFloat(valor);
            }
          }

          const valorNumerico = Number(valor);
          if (!isNaN(valorNumerico) && valorNumerico >= 1 && valorNumerico <= 5) {
            respostas.push(valorNumerico);
          }
        }
      });
    } else {
      // Processar grupo específico - usar filtro direto no dataSource
      this.dataSource.forEach(participant => {
        // Verificar se o participante pertence ao grupo especificado
        const categoriaParticipante = this.mapCategoriaToGrupo(participant.categoria);
        if (categoriaParticipante === grupo && participant[perguntaId] !== undefined) {
          let valor = participant[perguntaId];

          // Tratar diferentes formatos de dados
          if (typeof valor === 'string') {
            // Se for string, tentar extrair número
            if (valor.includes('Column')) {
              // Formato: "Column 1" → 1
              const match = valor.match(/Column (\d+)/);
              if (match) {
                valor = parseInt(match[1]);
              }
            } else {
              // Tentar converter string diretamente para número
              valor = parseFloat(valor);
            }
          }

          const valorNumerico = Number(valor);
          if (!isNaN(valorNumerico) && valorNumerico >= 1 && valorNumerico <= 5) {
            respostas.push(valorNumerico);
          }
        }
      });
    }

    return respostas;
  }

  // Método para calcular distribuição de notas (1-5)
  private calcularDistribuicaoNotas(respostas: number[]): DistribuicaoNota[] {
    const contadores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    respostas.forEach(nota => {
      if (nota >= 1 && nota <= 5) {
        contadores[nota as keyof typeof contadores]++;
      }
    });

    return [
      { nota: 1, quantidade: contadores[1] },
      { nota: 2, quantidade: contadores[2] },
      { nota: 3, quantidade: contadores[3] },
      { nota: 4, quantidade: contadores[4] },
      { nota: 5, quantidade: contadores[5] }
    ];
  }

  // Método para calcular média ponderada da distribuição
  private calcularMediaDistribuicao(distribuicao: DistribuicaoNota[]): number {
    const totalRespostas = distribuicao.reduce((sum, d) => sum + d.quantidade, 0);
    if (totalRespostas === 0) return 0;
    const somaPonderada = distribuicao.reduce((sum, d) => sum + d.nota * d.quantidade, 0);
    return somaPonderada / totalRespostas;
  }

  private getMediaRespostasCompetencia(competencia: Competency, grupos: string[]): number {
    const cacheKey = `media-competencia-${competencia.id}-${grupos.join('-')}`;
    return this.getCachedCalculation(cacheKey, () => {
        let todasRespostas: number[] = [];
        for (const perguntaId of competencia.questionIds) {
            for (const grupo of grupos) {
                const respostasPergunta = this.getRespostasParaPerguntaEGrupo(perguntaId, grupo);
                todasRespostas = todasRespostas.concat(respostasPergunta);
            }
        }

        if (todasRespostas.length === 0) {
            return 0;
        }

        const soma = todasRespostas.reduce((acc, val) => acc + val, 0);
        return soma / todasRespostas.length;
    });
  }

  public getGapChartOptions(secao: RelatorioSecao): EChartsOption {
    const cacheKey = `gap-chart-${secao.id}-${JSON.stringify(secao.competenciasIds)}`;
    return this.getCachedCalculation(cacheKey, () => {
      const competenciasSelecionadas = this.getCompetenciasSelecionadasParaSecao(secao);
      if (competenciasSelecionadas.length === 0) {
        return { series: [] };
      }

      const labels = competenciasSelecionadas.map(c => c.name);
      const selfData: number[] = [];
      const othersData: number[] = [];

      for (const competencia of competenciasSelecionadas) {
        const mediaSelf = this.getMediaRespostasCompetencia(competencia, ['Avaliado(a)']);
        const mediaOthers = this.getMediaRespostasCompetencia(competencia, ['Gestor(es)', 'Pares', 'Subordinados', 'Outros']);

        selfData.push(mediaSelf > 0 ? -mediaSelf : 0); // Usar negativo para divergir
        othersData.push(mediaOthers > 0 ? mediaOthers : 0);
      }

      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow'
          },
          formatter: (params: any) => {
            const selfParam = params.find((p: any) => p.seriesName === 'Autoavaliação');
            const othersParam = params.find((p: any) => p.seriesName === 'Avaliação dos Outros');
            const competencia = selfParam.axisValue;

            let tooltipText = `${competencia}<br/>`;
            if (selfParam && typeof selfParam.value === 'number') {
              tooltipText += `${selfParam.marker} ${selfParam.seriesName}: ${Math.abs(selfParam.value).toFixed(2)}<br/>`;
            }
            if (othersParam && typeof othersParam.value === 'number') {
              tooltipText += `${othersParam.marker} ${othersParam.seriesName}: ${Math.abs(othersParam.value).toFixed(2)}`;
            }
            return tooltipText;
          }
        },
        legend: {
          data: ['Autoavaliação', 'Avaliação dos Outros'],
          bottom: 10
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: 30,
          containLabel: true
        },
        xAxis: [
          {
            type: 'value',
            axisLabel: {
              formatter: (value: number) => `${Math.abs(value)}`
            }
          }
        ],
        yAxis: [
          {
            type: 'category',
            axisTick: { show: false },
            data: labels
          }
        ],
        series: [
          {
            name: 'Autoavaliação',
            type: 'bar',
            stack: 'total',
            label: {
              show: true,
              position: 'left',
              formatter: (params: any) => {
                return (typeof params.value === 'number') ? Math.abs(params.value).toFixed(2) : '';
              }
            },
            emphasis: {
              focus: 'series'
            },
            data: selfData,
            itemStyle: {
              color: '#d32f2f' // Vermelho
            }
          },
          {
            name: 'Avaliação dos Outros',
            type: 'bar',
            stack: 'total',
            label: {
              show: true,
              position: 'right',
               formatter: (params: any) => {
                return (typeof params.value === 'number') ? Math.abs(params.value).toFixed(2) : '';
              }
            },
            emphasis: {
              focus: 'series'
            },
            data: othersData,
            itemStyle: {
              color: '#1976d2' // Azul
            }
          }
        ]
      };
    });
  }

  atualizarTextoCompetencia(secao: any, competenciaId: string, event: any): void {
    if (!secao.textosPorCompetencia) {
      secao.textosPorCompetencia = {};
    }
    secao.textosPorCompetencia[competenciaId] = event.target.value;
  }

  // Debug method for avaliações mais altas
  debugAvaliacoesAltasSimples(): void {
    console.group('🔍 DEBUG AVALIAÇÕES MAIS ALTAS');

    console.log('📊 Dados básicos:');
    console.log('- Total de registros:', this.dataSource.length);
    console.log('- Competências:', this.competencias.length);

    if (this.competencias.length > 0) {
      const primeiraComp = this.competencias[0];
      console.log('🧪 Testando primeira competência:', primeiraComp.name);
      console.log('- Perguntas:', primeiraComp.questionIds);

      if (primeiraComp.questionIds.length > 0) {
        const primeiraPergunta = primeiraComp.questionIds[0];
        console.log(`- Testando pergunta: ${primeiraPergunta}`);

        // Testar respostas para 'Todos'
        const respostasTodos = this.getRespostasParaPerguntaEGrupo(primeiraPergunta, 'Todos');
        console.log(`- Respostas para 'Todos': ${respostasTodos.length} items - [${respostasTodos.slice(0, 10).join(', ')}]`);

        if (respostasTodos.length > 0) {
          const media = respostasTodos.reduce((sum, val) => sum + val, 0) / respostasTodos.length;
          console.log(`- Média calculada: ${media.toFixed(2)}`);
        }
      }
    }

    // Testar método completo
    const tabelaAltas = this.gerarTabelaAvaliacoesAltas(5);
    console.log('📋 Resultado da tabela de avaliações altas:');
    console.log('- Total de items:', tabelaAltas.totalItems);
    console.log('- Items retornados:', tabelaAltas.items.length);
    console.log('- Primeiros 3 items:', tabelaAltas.items.slice(0, 3));

    console.groupEnd();
  }

  // Debug method for detailed table
  debugTabelaDetalhada(): void {
    console.group('🔍 DEBUG TABELA DETALHADA');

    // Informações básicas
    console.log('📊 Dados básicos:');
    console.log('- Total de registros no dataSource:', this.dataSource.length);
    console.log('- Assessment selecionado:', this.selectedAssessmentId);
    console.log('- Competências cadastradas:', this.competencias.length);

    // Amostra dos dados
    if (this.dataSource.length > 0) {
      console.log('📋 Amostra dos dados (primeiro registro):');
      const sample = this.dataSource[0];
      console.log('- Estrutura do primeiro registro:', Object.keys(sample));
      console.log('- Categoria:', sample.categoria);
      console.log('- Avaliado:', sample.avaliado);
      console.log('- Exemplo de valores:', sample);
    }

    // Categorias encontradas
    const categoriasOriginais = [...new Set(this.dataSource.map(row => row.categoria))];
    const categoriasMapeadas = [...new Set(this.dataSource.map(row => this.mapCategoriaToGrupo(row.categoria)))];
    console.log('🏷️ Categorias:');
    console.log('- Categorias originais:', categoriasOriginais);
    console.log('- Categorias mapeadas:', categoriasMapeadas);

    // Grupos retornados
    const grupos = this.getGrupos();
    console.log('👥 Grupos retornados por getGrupos():', grupos);

    // Índices criados
    console.log('📇 Índices criados:');
    console.log('- Participantes por categoria:', this.dataIndexes.participantes);
    grupos.forEach(grupo => {
      const indices = this.dataIndexes.participantes.get(grupo) || [];
      console.log(`  - Grupo "${grupo}": ${indices.length} participantes (índices: ${indices.slice(0, 3).join(', ')}${indices.length > 3 ? '...' : ''})`);

      // Verificar se os índices estão corretos
      if (indices.length > 0) {
        const primeiroIndice = indices[0];
        const registro = this.dataSource[primeiroIndice];
        console.log(`    - Primeiro registro do grupo: categoria="${registro?.categoria}", avaliado="${registro?.avaliado}"`);
      }
    });

    // Teste com primeira competência
    if (this.competencias.length > 0) {
      const comp = this.competencias[0];
      console.log('🧪 Teste com primeira competência:', comp.name);
      console.log('- Perguntas da competência:', comp.questionIds);

      // Teste de respostas para primeira pergunta
      if (comp.questionIds.length > 0) {
        const primeiraPergunta = comp.questionIds[0];
        console.log(`- Testando pergunta: ${primeiraPergunta}`);

        grupos.forEach(grupo => {
          const respostas = this.getRespostasParaPerguntaEGrupo(primeiraPergunta, grupo);
          console.log(`  - Grupo "${grupo}": ${respostas.length} respostas - [${respostas.join(', ')}]`);
        });
      }

      // Gerar tabela completa
      const tabela = this.gerarTabelaCompetencia(comp);
      console.log('📊 Tabela gerada:', tabela);
    }

    console.groupEnd();
  }

  // Método para obter competências que têm tabelas configuradas
  getCompetenciasComTabela(): Competency[] {
    // Por enquanto, retorna todas as competências
    // Futuramente pode ser filtrado por configuração específica
    return this.competencias;
  }

  // Método para obter abreviação da categoria para cabeçalho da tabela
  getAbreviacaoCategoria(categoria: string): string {
    const abreviacoes: { [key: string]: string } = {
      'Avaliado(a)': 'A',
      'Gestor(es)': 'G',
      'Pares': 'P',
      'Subordinados': 'S',
      'Outros': 'O'
    };
    return abreviacoes[categoria] || categoria.charAt(0).toUpperCase();
  }

  // Método de teste simples para verificar dados
  testarDados(): void {
    console.group('🧪 TESTE SIMPLES DE DADOS');

    console.log('Total de registros:', this.dataSource.length);

    if (this.dataSource.length > 0) {
      const primeiro = this.dataSource[0];
      console.log('Primeiro registro:', primeiro);
      console.log('Categoria original:', primeiro.categoria);
      console.log('Categoria mapeada:', this.mapCategoriaToGrupo(primeiro.categoria));

      // Verificar se há perguntas com dados
      const perguntas = Object.keys(primeiro).filter(key =>
        !['data', 'categoria', 'avaliado', 'dataAvaliacao'].includes(key)
      );
      console.log('Perguntas encontradas:', perguntas.slice(0, 5));

      // Verificar valores das perguntas e como são processados
      perguntas.slice(0, 5).forEach(pergunta => {
        const valorOriginal = primeiro[pergunta];
        console.log(`Pergunta ${pergunta}:`);
        console.log(`  - Valor original: "${valorOriginal}" (tipo: ${typeof valorOriginal})`);

        // Testar processamento
        let valorProcessado = valorOriginal;
        if (typeof valorProcessado === 'string' && valorProcessado.includes('Column')) {
          const match = valorProcessado.match(/Column (\d+)/);
          if (match) {
            valorProcessado = parseInt(match[1]);
          }
        }
        const valorFinal = Number(valorProcessado);
        console.log(`  - Valor processado: ${valorFinal} (válido: ${!isNaN(valorFinal) && valorFinal >= 1 && valorFinal <= 5})`);
      });
    }

    console.groupEnd();
  }

  // Método para gerar tabela de avaliações mais altas
  gerarTabelaAvaliacoesAltas(numeroItems: number = 5, avaliadoSelecionado?: string): TabelaAvaliacoesAltas {
    const items: ItemAvaliacao[] = [];

    // Percorrer todas as competências e suas perguntas
    this.competencias.forEach(competencia => {
      competencia.questionIds.forEach((perguntaId: string) => {
        const perguntaTexto = this.questionMap[perguntaId] || `Pergunta ${perguntaId}`;

        // Calcular média geral da pergunta (todas as categorias)
        const respostasGerais = this.getRespostasParaPerguntaEGrupo(perguntaId, 'Todos');
        const mediaGeral = respostasGerais.length > 0 ?
          respostasGerais.reduce((sum, val) => sum + val, 0) / respostasGerais.length : 0;

        // Calcular média por categoria
        const grupos = this.getGrupos();
        let somaPorCategoria = 0;
        let contadorCategorias = 0;

        grupos.forEach(grupo => {
          const respostasGrupo = this.getRespostasParaPerguntaEGrupo(perguntaId, grupo);
          if (respostasGrupo.length > 0) {
            const mediaGrupo = respostasGrupo.reduce((sum, val) => sum + val, 0) / respostasGrupo.length;
            somaPorCategoria += mediaGrupo;
            contadorCategorias++;
          }
        });

        const mediaPorCategoria = contadorCategorias > 0 ? somaPorCategoria / contadorCategorias : 0;

        // Só adicionar se tiver dados válidos
        if (mediaGeral > 0 && !isNaN(mediaGeral)) {
          items.push({
            classificacao: 0, // Será definido depois da ordenação
            comportamento: perguntaTexto,
            pontuacaoMediaAvaliado: mediaGeral,
            pontuacaoMediaSemAutoavaliacao: mediaPorCategoria,
            caracteristicaLider: this.mapearCaracteristicaLider(mediaPorCategoria),
            perguntaId: perguntaId,
            competenciaId: competencia.id!
          });
        }
      });
    });

    // Ordenar por pontuação média geral (decrescente)
    items.sort((a, b) => b.pontuacaoMediaAvaliado - a.pontuacaoMediaAvaliado);

    // Adicionar classificação
    items.forEach((item, index) => {
      item.classificacao = index + 1;
    });

    // Retornar apenas os primeiros N items ou todas as competências
    const itemsSelecionados = items.slice(0, Math.min(numeroItems, this.competencias.length));

    return {
      items: itemsSelecionados,
      totalItems: items.length
    };
  }

  // Método para gerar tabela de avaliações mais baixas
  gerarTabelaAvaliacoesBaixas(numeroItems: number = 5, avaliadoSelecionado?: string): TabelaAvaliacoesAltas {
    const items: ItemAvaliacao[] = [];

    // Percorrer todas as competências e suas perguntas
    this.competencias.forEach(competencia => {
      competencia.questionIds.forEach((perguntaId: string) => {
        const perguntaTexto = this.questionMap[perguntaId] || `Pergunta ${perguntaId}`;

        // Calcular média geral da pergunta (todas as categorias)
        const respostasGerais = this.getRespostasParaPerguntaEGrupo(perguntaId, 'Todos');
        const mediaGeral = respostasGerais.length > 0 ?
          respostasGerais.reduce((sum, val) => sum + val, 0) / respostasGerais.length : 0;

        // Calcular média por categoria
        const grupos = this.getGrupos();
        let somaPorCategoria = 0;
        let contadorCategorias = 0;

        grupos.forEach(grupo => {
          const respostasGrupo = this.getRespostasParaPerguntaEGrupo(perguntaId, grupo);
          if (respostasGrupo.length > 0) {
            const mediaGrupo = respostasGrupo.reduce((sum, val) => sum + val, 0) / respostasGrupo.length;
            somaPorCategoria += mediaGrupo;
            contadorCategorias++;
          }
        });

        const mediaPorCategoria = contadorCategorias > 0 ? somaPorCategoria / contadorCategorias : 0;

        // Só adicionar se tiver dados válidos
        if (mediaGeral > 0 && !isNaN(mediaGeral)) {
          items.push({
            classificacao: 0, // Será definido depois da ordenação
            comportamento: perguntaTexto,
            pontuacaoMediaAvaliado: mediaGeral,
            pontuacaoMediaSemAutoavaliacao: mediaPorCategoria,
            caracteristicaLider: this.mapearCaracteristicaLider(mediaPorCategoria),
            perguntaId: perguntaId,
            competenciaId: competencia.id!
          });
        }
      });
    });

    // Ordenar por pontuação média geral (crescente - menores primeiro)
    items.sort((a, b) => a.pontuacaoMediaAvaliado - b.pontuacaoMediaAvaliado);

    // Adicionar classificação
    items.forEach((item, index) => {
      item.classificacao = index + 1;
    });

    // Retornar apenas os primeiros N items ou todas as competências
    const itemsSelecionados = items.slice(0, Math.min(numeroItems, this.competencias.length));

    return {
      items: itemsSelecionados,
      totalItems: items.length
    };
  }

  // Método para obter média por pergunta e avaliado específico
  private getMediaPorPerguntaEAvaliadoEspecifico(competencia: Competency, grupo: string, avaliadoSelecionado: string): number | null {
    const questionIds = competencia.questionIds;
    let soma = 0;
    let count = 0;

    questionIds.forEach((perguntaId: string) => {
      const respostasGrupo = this.dataSource.filter(row => {
        const grupoMapeado = this.mapCategoriaToGrupo(row['categoria']);
        const avaliado = row['avaliado'];
        return grupoMapeado === grupo && avaliado === avaliadoSelecionado;
      });

      respostasGrupo.forEach(row => {
        const valor = this.parseNumeric(row[perguntaId]);
        if (valor !== null) {
          soma += valor;
          count++;
        }
      });
    });

    return count > 0 ? soma / count : null;
  }

  // Método para obter lista de avaliados disponíveis
  getAvaliadosDisponiveis(): string[] {
    const avaliados = new Set<string>();

    this.dataSource.forEach(row => {
      const avaliado = row['avaliado'];
      if (avaliado && avaliado.trim()) {
        avaliados.add(avaliado.trim());
      }
    });

    return Array.from(avaliados).sort();
  }

  // Método para obter cor da característica
  getCorCaracteristica(caracteristica: string): string {
    switch (caracteristica) {
      case 'EXEMPLARIDADE': return '#1976D2';
      case 'CUIDADO_COM_PESSOAS': return '#4CAF50';
      case 'RESPONSABILIDADE_PELO_TODO': return '#FF9800';
      case 'ESPIRITO_EMPREENDEDOR': return '#9C27B0';
      default: return '#666';
    }
  }

  // Método para mapear pontuação para característica de liderança ADEO
  private mapearCaracteristicaLider(pontuacao: number): string {
    if (pontuacao >= 4.5) return 'EXEMPLARIDADE';
    if (pontuacao >= 4.0) return 'ESPIRITO_EMPREENDEDOR';
    if (pontuacao >= 3.5) return 'RESPONSABILIDADE_PELO_TODO';
    if (pontuacao >= 3.0) return 'CUIDADO_COM_PESSOAS';
    return 'EM_DESENVOLVIMENTO';
  }

  getConfiguracaoDestaques(): any {
    const secaoDestaques = this.relatorioConfiguracao.find(s => s.tipo === 'destaques');
    if (secaoDestaques) {
    return {
        numeroItens: (secaoDestaques as any).numeroItens || 5,
        avaliadoSelecionado: (secaoDestaques as any).avaliadoSelecionado || null
      };
    }
    return { numeroItens: 5, avaliadoSelecionado: null };
  }

  debugAvaliacoesAltas(): void {
    const config = this.getConfiguracaoDestaques();
    const tabelaAltas = this.gerarTabelaAvaliacoesAltas(config.numeroItens, config.avaliadoSelecionado);
    const tabelaBaixas = this.gerarTabelaAvaliacoesBaixas(config.numeroItens, config.avaliadoSelecionado);

    console.group("Debug - Pontos de Destaque");
    console.log("Configuração usada:", config);

    console.group("Avaliações Mais Altas");
    console.table(tabelaAltas.items);
    console.groupEnd();

    console.group("Avaliações Mais Baixas");
    console.table(tabelaBaixas.items);
    console.groupEnd();

    console.log("Avaliados disponíveis:", this.getAvaliadosDisponiveis());
    console.groupEnd();

    this.snackBar.open('Dados de Destaques enviados para o console.', 'Fechar', { duration: 3000 });
  }

  getPerguntasDataSource(perguntasIds: string[]): { id: string }[] {
    if (!perguntasIds) return [];
    return perguntasIds.map(id => ({ id }));
  }

  // Adiciona método para atualizar template existente
  async atualizarTemplateNoFirebase() {
    if (!this.selectedTemplateId.value) {
      this.snackBar.open('Selecione um template para editar.', 'Fechar', { duration: 3000 });
      return;
    }
    if (!this.nomeTemplateControl.value) {
      this.snackBar.open('Por favor, dê um nome ao template.', 'Fechar', { duration: 3000 });
      return;
    }
    const templateRef = doc(this.firestore, 'reportTemplates', this.selectedTemplateId.value);
    const templateData = {
      nome: this.nomeTemplateControl.value,
      assessmentId: this.selectedAssessmentId, // Adicionado para contexto
      configuracao: this.relatorioConfiguracao,
      competenciasIds: this.competencias.map(c => c.id), // Salvar apenas os IDs
      atualizadoEm: new Date()
    };
    try {
      await setDoc(templateRef, templateData, { merge: true });
      this.snackBar.open(`Template '${templateData.nome}' atualizado com sucesso!`, 'Fechar', { duration: 3000 });
      this.carregarTemplatesSalvos();
    } catch (e) {
      console.error('Erro ao atualizar template: ', e);
      this.snackBar.open('Ocorreu um erro ao atualizar o template.', 'Fechar', { duration: 3000 });
    }
  }

  voltarParaLista() {
    // Voltar para a página anterior ou para a lista de participantes
    this.router.navigate(['/assessments/participants']);
  }

  // Método de debug para testar extração de questões
  debugPerguntas() {
    console.group('🔍 DEBUG QUESTÕES');
    console.log('DynamicColumns:', this.dynamicColumns);
    console.log('QuestionMap:', this.questionMap);
    console.log('SelectedAssessmentId:', this.selectedAssessmentId);
    console.log('Assessments:', this.assessments);

    // Debug detalhado do questionMap
    console.log('🔍 QuestionMap detalhado:');
    Object.keys(this.questionMap).forEach(key => {
      console.log(`  ${key}: "${this.questionMap[key]}" (tipo: ${typeof this.questionMap[key]})`);
    });

    // Debug das opções do dropdown
    console.log('🔍 Opções do dropdown:');
    this.dynamicColumns.forEach(q => {
      const title = this.questionMap[q];
      console.log(`  ${q}: "${title}" (tipo: ${typeof title})`);
    });

    console.groupEnd();
  }

  // Método para calcular taxa de conclusão
  getCompletionRate(): number {
    if (!this.dataSource || this.dataSource.length === 0) return 0;

    const totalParticipants = this.dataSource.length;
    const completedParticipants = this.dataSource.filter((row: any) => {
      // Verificar se há pelo menos uma resposta válida
      return this.displayedColumns.some(col => {
        if (['data', 'categoria', 'avaliado', 'dataAvaliacao'].includes(col)) return false;
        return row[col] !== null && row[col] !== undefined && row[col] !== '';
      });
    }).length;

    return Math.round((completedParticipants / totalParticipants) * 100);
  }

  // Método para obter ícone do tipo de seção
  getTipoSecaoIcon(tipo: string): string {
    const iconMap: { [key: string]: string } = {
      'capa': 'description',
      'introducao': 'info',
      'resumo': 'assessment',
      'graficos': 'bar_chart',
      'tabela': 'table_chart',
      'competencia_detalhada': 'psychology',
      'destaques': 'star',
      'texto': 'text_fields',
      'grafico_defasagem': 'trending_up',
      'grafico_radar': 'radar',
      'custom': 'settings'
    };
    return iconMap[tipo] || 'article';
  }

      // Método para verificar se há dados válidos para gráficos
  hasValidChartData(): boolean {
    if (this.chartsDisabled) return false;

    const dados = this.getResumoMediasPorCompetencia();
    if (!dados || dados.length === 0) return false;

    // Verificar se pelo menos um item tem dados válidos
    return dados.some(item =>
      item && item.dados &&
      item.dados.length > 0 &&
      item.dados.some((d: any) => d.media > 0)
    );
  }

  // Métodos seguros para dados de gráficos
  safeGetSecaoStackedData(secao: any): any[] {
    try {
      const data = this.getSecaoStackedData(secao);
      if (!data || data.length === 0) return [];

      // Verificar se todos os valores são válidos
      return data.filter(item =>
        item &&
        item.series &&
        item.series.length > 0 &&
        item.series.every((s: any) => s.value !== null && s.value !== undefined && !isNaN(s.value))
      );
    } catch (error) {
      console.warn('Erro ao obter dados do gráfico stacked:', error);
      return [];
    }
  }

  safeGetSecaoPieData(secao: any): any[] {
    try {
      const data = this.getSecaoPieData(secao);
      if (!data || data.length === 0) return [];

      // Verificar se todos os valores são válidos
      return data.filter(item =>
        item &&
        item.value !== null &&
        item.value !== undefined &&
        !isNaN(item.value) &&
        item.value > 0
      );
    } catch (error) {
      console.warn('Erro ao obter dados do gráfico pie:', error);
      return [];
    }
  }

  safeGetCompetenciaStackedData(comp: Competency): any[] {
    try {
      const data = this.getCompetenciaStackedData(comp);
      if (!data || data.length === 0) return [];

      // Verificar se todos os valores são válidos
      return data.filter(item =>
        item &&
        item.value !== null &&
        item.value !== undefined &&
        !isNaN(item.value)
      );
    } catch (error) {
      console.warn('Erro ao obter dados da competência stacked:', error);
      return [];
    }
  }

  hasValidStackedData(secao: any): boolean {
    if (this.chartsDisabled) return false;
    const data = this.safeGetSecaoStackedData(secao);
    return data.length > 0;
  }

  hasValidPieData(secao: any): boolean {
    if (this.chartsDisabled) return false;
    const data = this.safeGetSecaoPieData(secao);
    return data.length > 0;
  }

  hasValidCompetencyData(comp: Competency): boolean {
    if (this.chartsDisabled) return false;
    const data = this.safeGetCompetenciaStackedData(comp);
    return data.length > 0;
  }

  // Método para mudança de participante selecionado
  onParticipantChange(): void {
    const selectedParticipant = this.selectedParticipantControl.value;
    if (selectedParticipant) {
      console.log(`🎯 Participante selecionado para exportação: ${selectedParticipant}`);
      // Aqui você pode adicionar lógica adicional se necessário
    }
  }

  // Método para exportar PDF individual
  async exportarRelatorioIndividualPDF(): Promise<void> {
    const selectedParticipant = this.selectedParticipantControl.value;
    if (!selectedParticipant) {
      this.snackBar.open('Selecione um participante primeiro.', 'Fechar', { duration: 3000 });
      return;
    }

    try {
      this.loadingService.show('Gerando PDF individual...');

      // Filtrar dados apenas do participante selecionado
      const dadosParticipante = this.dataSource.filter(row =>
        row.avaliado === selectedParticipant || row.participante === selectedParticipant
      );

      if (dadosParticipante.length === 0) {
        this.snackBar.open('Nenhum dado encontrado para este participante.', 'Fechar', { duration: 3000 });
        return;
      }

      // Criar relatório individual
      const relatorioIndividual = {
        participante: selectedParticipant,
        avaliacao: this.selectedAssessmentName,
        data: new Date(),
        secoes: this.getSecoesVisiveisOrdenadas(),
        dados: dadosParticipante
      };

      // Gerar PDF
      const pdfBlob = await this.gerarPDFIndividual(relatorioIndividual);

      // Download do arquivo
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Relatorio_${selectedParticipant}_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      this.snackBar.open(`PDF individual gerado com sucesso!`, 'Fechar', { duration: 3000 });

    } catch (error) {
      console.error('Erro ao gerar PDF individual:', error);
      this.snackBar.open('Erro ao gerar PDF individual.', 'Fechar', { duration: 3000 });
    } finally {
      this.loadingService.hide();
    }
  }

  // Método para exportar Excel individual
  async exportarRelatorioIndividualExcel(): Promise<void> {
    const selectedParticipant = this.selectedParticipantControl.value;
    if (!selectedParticipant) {
      this.snackBar.open('Selecione um participante primeiro.', 'Fechar', { duration: 3000 });
      return;
    }

    try {
      this.loadingService.show('Gerando Excel individual...');

      // Filtrar dados apenas do participante selecionado
      const dadosParticipante = this.dataSource.filter(row =>
        row.avaliado === selectedParticipant || row.participante === selectedParticipant
      );

      if (dadosParticipante.length === 0) {
        this.snackBar.open('Nenhum dado encontrado para este participante.', 'Fechar', { duration: 3000 });
        return;
      }

      // Gerar Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Relatório Individual');

      // Adicionar cabeçalho
      worksheet.addRow(['Relatório Individual - ' + selectedParticipant]);
      worksheet.addRow(['Avaliação: ' + this.selectedAssessmentName]);
      worksheet.addRow(['Data: ' + new Date().toLocaleDateString('pt-BR')]);
      worksheet.addRow([]);

      // Adicionar colunas
      const headers = this.displayedColumns;
      worksheet.addRow(headers);

      // Adicionar dados
      dadosParticipante.forEach(row => {
        const rowData = headers.map(header => row[header] || '');
        worksheet.addRow(rowData);
      });

      // Estilizar
      worksheet.getRow(1).font = { bold: true, size: 14 };
      worksheet.getRow(2).font = { bold: true };
      worksheet.getRow(3).font = { bold: true };
      worksheet.getRow(5).font = { bold: true };

      // Download do arquivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Relatorio_${selectedParticipant}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      this.snackBar.open(`Excel individual gerado com sucesso!`, 'Fechar', { duration: 3000 });

    } catch (error) {
      console.error('Erro ao gerar Excel individual:', error);
      this.snackBar.open('Erro ao gerar Excel individual.', 'Fechar', { duration: 3000 });
    } finally {
      this.loadingService.hide();
    }
  }

  // Método para gerar PDF individual
  private async gerarPDFIndividual(relatorio: any): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        const pdf = new jsPDF('p', 'mm', 'a4');

        // Configurar fonte
        pdf.setFont('helvetica');
        pdf.setFontSize(16);

        // Título
        pdf.text('Relatório Individual', 105, 20, { align: 'center' });
        pdf.setFontSize(12);
        pdf.text(`Participante: ${relatorio.participante}`, 20, 35);
        pdf.text(`Avaliação: ${relatorio.avaliacao}`, 20, 45);
        pdf.text(`Data: ${relatorio.data.toLocaleDateString('pt-BR')}`, 20, 55);

        // Adicionar seções
        let yPosition = 80;
        relatorio.secoes.forEach((secao: any, index: number) => {
          if (secao.visivel && yPosition < 250) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text(secao.titulo || `Seção ${index + 1}`, 20, yPosition);

            yPosition += 10;
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');

            if (secao.texto) {
              const texto = pdf.splitTextToSize(secao.texto, 170);
              pdf.text(texto, 20, yPosition);
              yPosition += texto.length * 5 + 10;
            }

            // Adicionar quebra de página se necessário
            if (yPosition > 250) {
              pdf.addPage();
              yPosition = 20;
            }
          }
        });

        resolve(pdf.output('blob'));
      } catch (error) {
        reject(error);
      }
    });
  }
}
