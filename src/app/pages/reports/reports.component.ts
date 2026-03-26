import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, AfterViewInit, OnDestroy } from '@angular/core';
import { parseNumeric, exportToCSV, filterQuestionsByType, computeConsolidation, getQuestionTypeStats } from './reports-utils';
import { MatTableModule } from '@angular/material/table';
import { Firestore, collection, getDocs, doc, getDoc, addDoc, setDoc, deleteDoc } from '@angular/fire/firestore';
import * as XLSX from 'xlsx';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ReactiveFormsModule, FormControl, FormGroup, Validators, FormArray, FormBuilder } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatOptionModule } from '@angular/material/core';
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
import { ReportsPdfService } from './reports-pdf.service';
import { ReportPdfMakeService } from '../../services/report-pdfmake.service';
import { NgxEchartsModule } from 'ngx-echarts';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { PerformanceMonitorService } from './performance-monitor.service';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ActivatedRoute } from '@angular/router';
import { Input } from '@angular/core';
import { Router } from '@angular/router';
import { AppPageHeaderComponent } from '../../components/page-header/page-header.component';
import { LoadingService } from '../../services/loading.service';
import { FirestoreLoadingInterceptor } from '../../interceptors/firestore-loading.interceptor';
import { AuthService } from '../../services/apps/authentication/auth.service';
import { query, where } from '@angular/fire/firestore';
import { JohariWindowChartComponent, JohariWindowData } from './charts/johari-window-chart/johari-window-chart.component';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { GapChartComponent, GapChartDataItem } from './charts/gap-chart/gap-chart.component';
import { ReportBuilderVisualComponent } from './report-builder-visual/report-builder-visual.component';
import { SurveyDashboardComponent } from './survey-dashboard/survey-dashboard.component';
import { Subject, from, of, takeUntil, tap, debounceTime, switchMap } from 'rxjs';
import { environment } from 'src/enviroments/environment';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface AssessmentOption {
  id: string;
  name: string;
}

interface Competencia {
  id: string;
  nome: string;
  descricao: string;
  perguntasIds: string[];
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
  competencia: Competencia;
  linhas: LinhaTabela[];
  mediasGerais: DadosCategoria[];
}

// Modelo de dados para seções dinâmicas do relatório
export interface RelatorioSecao {
  id: string;
  tipo: 'capa' | 'introducao' | 'resumo' | 'graficos' | 'tabela' | 'tabela_detalhada' | 'destaques' | 'custom' | 'texto' | 'competencia_detalhada' | 'grafico_defasagem' | 'janela_johari' | 'perguntas_abertas';
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
    TranslateModule,
    MatTableModule,
    MatButtonModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatOptionModule,
    MatFormFieldModule,
    ReactiveFormsModule,
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
    MatCheckboxModule,
    MatRadioModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    GapChartComponent,
    JohariWindowChartComponent,
    ReportBuilderVisualComponent,
    SurveyDashboardComponent,
    AppPageHeaderComponent
  ],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsComponent implements OnInit, AfterViewInit, OnDestroy {
  // Habilite para logs detalhados (impacta performance). Mantenha false em produção.
  private debugMode = false;
  /** Exibe botões de debug apenas em desenvolvimento */
  readonly showDebugButtons = !environment.production;
  // Cache de participantes para evitar múltiplas idas ao Firestore
  private participantsCache: Map<string, any> = new Map<string, any>();

  // Configuração externa para uso embarcado (geração programática de PDF)
  @Input() externalConfig?: {
    assessmentId: string;
    participantId: string;
    participantName?: string;
    templateId?: string;
    competencyIds?: string[];
    autoGenerate?: boolean;
  };

  private debugLog(...args: any[]): void {
    if (this.debugMode) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  }

  // Converte respostas tipo "Column N" para número (1..5)
  private parseLikertAnswer(answer: unknown): number | null {
    if (typeof answer === 'number') {
      return answer >= 1 && answer <= 5 ? answer : null;
    }
    if (typeof answer === 'string') {
      const match = answer.match(/Column\s*(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        return n >= 1 && n <= 5 ? n : null;
      }
      const parsed = parseFloat(answer);
      return parsed >= 1 && parsed <= 5 ? parsed : null;
    }
    return null;
  }

  // Exporta base de dados plana (uma linha por resposta por pergunta)
  exportarBaseExcel(): void {
    if (!this.dataSource || this.dataSource.length === 0) {
      this.snackBar.open(this.translate.instant('Sem dados para exportar.'), this.translate.instant('Fechar'), { duration: 2500 });
      return;
    }

    // Coletar perguntas visíveis (ou todas)
    const perguntasIds: string[] = this.allQuestions?.map(q => q.id) || Object.keys(this.questionMap || {});

    const linhas: any[] = [];
    for (const row of this.dataSource) {
      for (const perguntaId of perguntasIds) {
        if (!(perguntaId in row)) continue;
        const valorOriginal = row[perguntaId];
        const valor = this.parseLikertAnswer(valorOriginal);
        if (valor === null) continue;

        linhas.push({
          AssessmentId: this.selectedAssessmentId || '',
          Data: row['dataAvaliacao'] || '',
          Categoria: row['categoria'] || '',
          Avaliado: row['avaliado'] || '',
          PerguntaId: perguntaId,
          Pergunta: this.questionMap[perguntaId] || perguntaId,
          Resposta: valor,
        });
      }
    }

    if (linhas.length === 0) {
      this.snackBar.open(this.translate.instant('Sem respostas válidas para exportar.'), this.translate.instant('Fechar'), { duration: 2500 });
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(linhas);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Base');

    const fileName = this.isIndividualMode && this.individualParticipantName
      ? `base_${this.individualParticipantName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.xlsx`
      : 'base_respostas.xlsx';

    XLSX.writeFile(workbook, fileName);
    this.snackBar.open(this.translate.instant('Base exportada com sucesso!'), this.translate.instant('Fechar'), { duration: 2500 });
  }

  // Calcula a "Média sem autoavaliação" a partir das médias por categoria da tabela
  getMediaSemAutoavaliacao(tabela: TabelaCompetencia | null): number | null {
    if (!tabela || !tabela.mediasGerais || tabela.mediasGerais.length === 0) {
      return null;
    }

    // Considerar todas as categorias exceto Avaliado(a)
    const categoriasSemAuto = tabela.mediasGerais.filter(c => this.getAbreviacaoCategoria(c.categoria) !== 'A' && c.totalRespostas > 0);
    if (categoriasSemAuto.length === 0) {
      return null;
    }

    // Média ponderada pelo total de respostas por categoria
    const somaPonderada = categoriasSemAuto.reduce((acc, c) => acc + (c.media * c.totalRespostas), 0);
    const totalRespostas = categoriasSemAuto.reduce((acc, c) => acc + c.totalRespostas, 0);
    return totalRespostas > 0 ? somaPonderada / totalRespostas : null;
  }

  // Inicializa via configuração externa e exporta PDF sem precisar navegar para a rota de relatórios
  public async initializeAndExportFromExternalConfig(cfg: {
    assessmentId: string;
    participantId: string;
    participantName?: string;
    templateId?: string;
    competencyIds?: string[];
    autoGenerate?: boolean;
  }): Promise<void> {
    // Guardar config
    this.externalConfig = cfg;

    // Fluxo equivalente ao dos query params (modo individual)
    this.isIndividualMode = true;
    this.individualParticipantId = cfg.participantId;
    this.individualParticipantName = cfg.participantName || '';
    this.individualTemplateId = cfg.templateId || '';

    // Garantir dados base carregados
    await this.loadClients();
    await this.loadAssessments();
    await this.carregarRelatoriosSalvos();
    await this.carregarTemplatesSalvos();

    if (cfg.assessmentId) {
      this.selectedAssessmentId = cfg.assessmentId;
      this.assessmentControl.setValue(cfg.assessmentId);
      await this.onAssessmentChange();
    }

    // Aplicar competências, se fornecidas
    if (cfg.competencyIds && cfg.competencyIds.length) {
      this.competencias = this.allCompetencies.filter((c: Competencia) => cfg.competencyIds!.includes(c.id));
    }

    // Aplicar template, se fornecido
    if (cfg.templateId) {
      this.selectedTemplateId.setValue(cfg.templateId);
      await this.aplicarTemplateSelecionado();
    }

    // Preencher competências nas seções que dependem delas, se fornecidas
    if (cfg.competencyIds && cfg.competencyIds.length) {
      const compIds = cfg.competencyIds;
      this.relatorioConfiguracao.forEach(sec => {
        if (['resumo', 'graficos', 'tabela', 'tabela_detalhada', 'grafico_defasagem', 'competencia_detalhada'].includes(sec.tipo)) {
          sec.competenciasIds = [...compIds];
        }
      });
      this.atualizarFormArrayComConfiguracao();
    }

    // Ir para aba de Visualização e exportar
    this.selectedTabIndex = 2;

    // Aguardar até que o preview esteja pronto (elemento presente e dados carregados)
    await this.waitForReportReady(8000);

    await this.exportarRelatorioPDF();
  }

  private async waitForReportReady(timeoutMs: number = 5000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const el = document.getElementById('report-preview');
      const ready = !!el && this.dataSource && this.dataSource.length > 0 && this.dynamicColumns && this.dynamicColumns.length > 0;
      if (ready) return true;
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  }
  displayedColumns: string[] = [];
  dataSource: any[] = [];
  isLoading = false;
  assessments: AssessmentOption[] = [];
  selectedAssessmentId: string | null = null;
  questionMap: { [key: string]: string } = {};
  summaryCounts: any = {};

  assessmentControl = new FormControl('');
  assessmentSearchControl = new FormControl('');
  filteredAssessments: AssessmentOption[] = [];

  builderHasUnsavedChanges = false;
  isExporting = false;
  exportingLabel = '';

  get builderSavedLabel(): string {
    if (this.selectedTemplateId.value) {
      return this.savedTemplates.find(t => t.id === this.selectedTemplateId.value)?.name || '';
    }
    if (this.selectedReportId.value) {
      return this.savedReports.find(r => r.id === this.selectedReportId.value)?.name || '';
    }
    return '';
  }

  async onBuilderSaveRequested(): Promise<void> {
    if (this.selectedTemplateId.value) {
      await this.atualizarTemplateNoFirebase();
      this.builderHasUnsavedChanges = false;
    } else if (this.selectedReportId.value) {
      await this.atualizarRelatorioNoFirebase();
      this.builderHasUnsavedChanges = false;
    } else {
      this.snackBar.open(
        this.t('Carregue um template ou relatório nos cards acima antes de salvar.'),
        this.t('Fechar'),
        { duration: 4000 }
      );
    }
  }

  // Controle para seleção do avaliado
  avaliadoControl = new FormControl('');
  avaliadosDisponiveis: string[] = [];
  selectedAvaliado: string | null = null;

  clientControl = new FormControl('');

  // Controles para cliente e grupos de competências
  clients: any[] = [];
  selectedClientId: string | null = null;
  competencyGroups: any[] = [];
  competencyGroupControl = new FormControl('');
  groupNameControl = new FormControl('');

  // Importar competências de outras avaliações/clientes
  allAvailableGroups: { id: string; name: string; assessmentName: string; clientName: string; competencias: any[] }[] = [];
  importGroupControl = new FormControl('');
  importGroupLoading = false;

  // Controles para filtrar tipos de perguntas
  includeOpenQuestions = new FormControl(false);
  allQuestions: { id: string; title: string; type: string }[] = [];
  filteredQuestions: { id: string; title: string; type: string }[] = [];

  // Armazenar perguntas custom por competência (carregadas do grupo)
  customQuestionsByCompetency: { [key: string]: { id: string; title: string; type: string }[] } = {};

  today: Date = new Date();

  competencyAverages: { title: string; avg: number }[] = [];
  topItems: { title: string; avg: number }[] = [];
  lowItems: { title: string; avg: number }[] = [];

  consolidation: any[] = [];
  consolidationColumns: string[] = ['pergunta', 'sessao', 'tema', 'resposta', 'respondentes', 'percent', 'score'];

  // Competências e gráficos
  stackedData: any[] = [];
  colorScheme = { domain: ['#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575', '#424242'] };

  // Sistema de cores customizáveis
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
    },
    'categorias': {
      nome: 'Categorias Distintas',
      cores: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
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
    height: '300px',
    minHeight: '200px',
    placeholder: 'Escreva seu texto... Use as ferramentas de formatação para criar títulos, adicionar imagens, listas e muito mais...',
    toolbarPosition: 'top',
    showToolbar: true,
    toolbarHiddenButtons: [
      ['subscript', 'superscript'],
      ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'],
      ['indent', 'outdent'],
      ['insertUnorderedList', 'insertOrderedList'],
      ['fontName']
    ]
  };

  polarData: any[] = [];
  radarOptions: EChartsOption = {};

  competencias: Competencia[] = [];
  allCompetencies: Competencia[] = []; // Lista completa de competências disponíveis
  pendingCompetencyIds: string[] = []; // IDs de competências pendentes para aplicar
  competenciaEditando: Competencia = { id: '', nome: '', descricao: '', perguntasIds: [] };
  competenciaForm: FormGroup;

  perguntasBloqueadas = new Set<string>();

  // Modo de montagem: 'visual' ou 'classico'
  modoMontagem: 'visual' | 'classico' = 'visual';

  // Exemplo de configuração inicial do relatório
  relatorioConfiguracao: RelatorioSecao[] = [
    {
      id: 'capa',
      tipo: 'capa',
      titulo: 'Relatório Feedback 360°',
      texto: '<h1 style="text-align: center; color: #1976d2; margin-bottom: 20px;">Relatório Feedback 360°</h1><p style="text-align: center; font-size: 18px; color: #666; margin-bottom: 30px;">Avaliação de Competências e Desenvolvimento</p><div style="text-align: center; margin: 40px 0;"><div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 40px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);"><h2 style="margin: 0; font-size: 24px;">Avaliação Completa</h2><p style="margin: 10px 0 0 0; opacity: 0.9;">Feedback 360° Profissional</p></div></div>',
      visivel: true,
      ordem: 1
    },
    {
      id: 'introducao',
      tipo: 'introducao',
      titulo: 'Introdução',
      texto: '<h2 style="color: #7b1fa2; border-bottom: 2px solid #e1bee7; padding-bottom: 10px;">Introdução ao Relatório</h2><p style="font-size: 16px; line-height: 1.6; color: #333;">Este relatório apresenta os resultados da avaliação 360° realizada com o objetivo de identificar pontos fortes e áreas de desenvolvimento.</p><div style="background-color: #f3e5f5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9c27b0;"><h3 style="margin: 0 0 10px 0; color: #7b1fa2;">Objetivos da Avaliação:</h3><ul style="margin: 0; padding-left: 20px;"><li>Identificar competências desenvolvidas</li><li>Reconhecer pontos fortes</li><li>Mapear oportunidades de melhoria</li><li>Fornecer base para desenvolvimento profissional</li></ul></div>',
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
        mostrarCaracteristica: false,
      mostrarPontuacaoSemAuto: true
    }
  ];

  relatorioFormArray: FormArray<any>
  dummyForm: FormGroup;

  selectedTabIndex = 0;

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
    participantsByCategory: new Map<string, any[]>(),
    responsesByParticipant: new Map<string, any[]>(),
    questionsByType: new Map<string, any[]>()
  };

  // Modo individual para relatórios de participantes específicos
  isIndividualMode = false;
  individualParticipantId: string | null = null;
  individualParticipantName: string | null = null;
  individualTemplateId: string | null = null;
  individualTemplateName: string | null = null;

  mediasPorCompetencia: { competenciaId: string; nome: string; medias: { grupo: string; media: number | null }[] }[] = [];
  gapChartData: GapChartDataItem[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private translate: TranslateService,
    private route: ActivatedRoute,
    private performanceMonitor: PerformanceMonitorService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private loadingService: LoadingService,
    private firestoreInterceptor: FirestoreLoadingInterceptor,
    private authService: AuthService,
    private fb: FormBuilder,
    private reportsPdf: ReportsPdfService,
    private pdfMakeService: ReportPdfMakeService,
    private sanitizer: DomSanitizer
  ) {
    this.dummyForm = this.fb.group({
      relatorioFormArray: this.fb.array([])
    });

    this.relatorioFormArray = this.dummyForm.get('relatorioFormArray') as FormArray;

    this.competenciaForm = this.fb.group({
      nome: ['', Validators.required],
      descricao: ['', Validators.required],
      perguntasIds: [[] as string[], Validators.required]
    });

    // Monitorar mudanças para invalidação de cache
    this.competenciaForm.valueChanges.subscribe(() => {
      this.invalidateCache('secao-'); // Invalida caches que dependem de competências
    });

    this.carregarRelatoriosSalvos();
    this.carregarTemplatesSalvos();


    this.assessmentSearchControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(term => {
        const t = (term || '').toLowerCase();
        this.filteredAssessments = this.assessments.filter(a =>
          a.name.toLowerCase().includes(t)
        );
      });

    // Sincroniza o campo de busca quando assessmentControl é setado externamente
    this.assessmentControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(id => {
        const name = this.displayAssessmentName(id);
        if (name && this.assessmentSearchControl.value !== name) {
          this.assessmentSearchControl.setValue(name, { emitEvent: false });
          this.filteredAssessments = [...this.assessments];
        }
      });
    this.avaliadoControl.valueChanges
      .pipe(
        debounceTime(300),
        switchMap(() => {
          return from(this.calcularMediasPorCompetencia());
        }),
        takeUntil(this.destroy$)
      ).subscribe();

    this.dummyForm.get('relatorioFormArray')?.valueChanges.pipe(
      debounceTime(400),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.prepareGapChartData();
    });
  }

  private t(key: string): string {
    return (this as any)['translate'] ? (this as any)['translate'].instant(key) : key;
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

    this.dataIndexes.participantsByCategory.clear();
    this.dataIndexes.responsesByParticipant.clear();
    this.dataIndexes.questionsByType.clear();

    // Indexar participantes por categoria (armazenar índices numéricos)
    this.dataSource.forEach((row, index) => {
      if (row.categoria) {
        const grupo = this.mapCategoriaToGrupo(row.categoria);
        if (!this.dataIndexes.participantsByCategory.has(grupo)) {
          this.dataIndexes.participantsByCategory.set(grupo, []);
        }
        this.dataIndexes.participantsByCategory.get(grupo)!.push(index);
      }
    });

    // Indexar respostas por participante
    this.dataSource.forEach((row, index) => {
      const participantId = row.participante || row.id || index;
      this.dataIndexes.responsesByParticipant.set(participantId, row);
    });

    console.log(`✅ Índices criados: ${this.dataIndexes.participantsByCategory.size} categorias, ${this.dataIndexes.responsesByParticipant.size} participantes`);
  }

  // 🚀 PERFORMANCE: TrackBy functions
  trackBySection(index: number, section: RelatorioSecao): string {
    return section.id + '-' + section.ordem + '-' + section.visivel;
  }

  trackBySectionForm(index: number, formGroup: FormGroup): string {
    return formGroup.get('id')?.value;
  }

  trackByCompetencia(index: number, comp: Competencia): string {
    return comp.id;
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

    // Configurar o listener para mudanças no filtro de perguntas
    this.includeOpenQuestions.valueChanges.subscribe(() => {
      this.onQuestionFilterChange();
    });

    // Carregar clientes, avaliações e templates primeiro
    await this.loadClients();
    await this.loadAssessments();
    await this.carregarRelatoriosSalvos();
    await this.carregarTemplatesSalvos(); // <-- Carrega os templates

    // Se a rota tem :id, carregar o relatório salvo
    const reportId = this.route.snapshot.paramMap.get('id');
    if (reportId) {
      this.selectedReportId.setValue(reportId);
      await this.carregarRelatorioSelecionado();
    }

    // Processar os queryParams após carregar templates
    this.route.queryParams.subscribe(async params => {
      if (params['mode'] !== 'individual') return;

      // 1. Flags do modo individual
      this.isIndividualMode = true;
      this.individualParticipantId = params['participantId'] || null;
      this.individualParticipantName = params['participantName'] || null;
      this.individualTemplateId = params['templateId'] || null;
      this.individualTemplateName = params['templateName'] || null;

      const assessmentId: string = params['assessmentId'];
      if (!assessmentId) {
        console.error('[Relatório Individual] assessmentId ausente nos queryParams', params);
        return;
      }

      // 2. Setar avaliação nos controles (sem disparar subscriptions)
      this.selectedAssessmentId = assessmentId;
      this.assessmentControl.setValue(assessmentId, { emitEvent: false });

      // 3. Resolver e exibir nome da avaliação ANTES de carregar dados pesados
      const assessmentName = await this.resolveAssessmentName(assessmentId);
      this.assessmentSearchControl.setValue(assessmentName, { emitEvent: false });

      // 4. Definir competências pendentes ANTES de onAssessmentChange
      if (params['competencyIds']) {
        try {
          this.pendingCompetencyIds = JSON.parse(params['competencyIds']);
        } catch (e) {
          console.error('[Relatório Individual] Erro ao processar competencyIds:', e);
        }
      }

      // 5. Carregar dados da avaliação
      try {
        await this.onAssessmentChange();
      } catch (e) {
        console.error('[Relatório Individual] Erro em onAssessmentChange:', e);
      }

      // 6. Filtrar pelo avaliado específico
      if (this.individualParticipantName) {
        this.selectedAvaliado = this.individualParticipantName;
        this.avaliadoControl.setValue(this.individualParticipantName, { emitEvent: false });
        this.invalidateCache();
      }

      // 7. Aplicar template (emitEvent: false evita duplo aplicarTemplateSelecionado)
      if (params['templateId']) {
        this.selectedTemplateId.setValue(params['templateId'], { emitEvent: false });
        try {
          await this.aplicarTemplateSelecionado();
        } catch (e) {
          console.error('[Relatório Individual] Erro ao aplicar template:', e);
        }
      }

      // 8. Preencher competências em todas as seções compatíveis
      if (this.competencias.length > 0) {
        const compIds = this.competencias.map(c => c.id);
        this.relatorioConfiguracao.forEach(sec => {
          if (['resumo', 'graficos', 'tabela', 'tabela_detalhada', 'grafico_defasagem', 'competencia_detalhada'].includes(sec.tipo)) {
            sec.competenciasIds = [...compIds];
          }
        });
        this.atualizarFormArrayComConfiguracao();
      }

      // 9. Ir direto para a aba Visualizar Relatório
      this.selectedTabIndex = 2;
      this.cdr.markForCheck();
    });

    this.atualizarPerguntasBloqueadas();

    // Subscription única para seleção manual de avaliação pelo usuário
    this.assessmentControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(async id => {
        this.selectedAssessmentId = id;
        if (id) {
          await this.onAssessmentChange();
          await this.calcularMediasPorCompetencia();
        } else {
          this.dataSource = [];
          this.competencias = [];
          this.mediasPorCompetencia = [];
        }
        this.cdr.detectChanges();
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.loadingService.reset(); // garantir que overlay seja limpo ao sair da página
  }

  // Verificar se os dados estão prontos para gerar o PDF
  private isDataReady(): boolean {
    return (
      this.selectedAssessmentId !== null &&
      this.competencias.length > 0 &&
      this.relatorioConfiguracao.length > 0 &&
      this.allCompetencies.length > 0
    );
  }

  async loadAssessments() {
    this.loadingService.show('Carregando avaliações...');
    try {
      const assessmentsSnap = await getDocs(collection(this.firestore, 'assessments'));
      this.assessments = assessmentsSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data()['name'] || doc.data()['surveyJSON']?.['title'] || doc.id
      }));
      this.filteredAssessments = [...this.assessments];
    } catch (e) {
      console.error("Erro ao carregar avaliações:", e);
      this.snackBar.open(this.t('Falha ao carregar as avaliações.'), this.t('Fechar'), { duration: 3000 });
    } finally {
      this.loadingService.hide();
    }
  }

  private atualizarPerguntasBloqueadas(): void {
    this.perguntasBloqueadas.clear();
    const idCompetenciaEditando = this.competenciaEditando?.id;

    this.competencias.forEach(c => {
      // Se não estamos editando esta competência, suas perguntas estão bloqueadas
      if (c.id !== idCompetenciaEditando) {
        c.perguntasIds.forEach(pId => this.perguntasBloqueadas.add(pId));
      }
    });
  }

  private atualizarFormArrayComConfiguracao() {
    this.relatorioFormArray.clear();
    this.relatorioConfiguracao.forEach(secao => {
      this.relatorioFormArray.push(this.fb.group({
        visivel: [secao.visivel],
        titulo: [secao.titulo || ''],
        texto: [secao.texto || ''],
        competenciasIds: [secao.competenciasIds || []],
        id: [secao.id],
        tipo: [secao.tipo],
        ordem: [secao.ordem],
        tipoGrafico: [secao['tipoGrafico'] || 'barra'],
        paletaCor: [secao['paletaCor'] || 'padrao'],
        coresPersonalizadas: [secao['coresPersonalizadas'] || []],
        // Controles para seção de destaques
        numeroItems: [secao['numeroItems'] || 5],
        avaliadoSelecionado: [secao['avaliadoSelecionado'] || ''],
        mostrarCaracteristica: [secao['mostrarCaracteristica'] !== false],
        mostrarPontuacaoSemAuto: [secao['mostrarPontuacaoSemAuto'] !== false]
      }));
    });
  }

  displayAssessmentName(id: string | null): string {
    if (!id) return '';
    return this.assessments.find(a => a.id === id)?.name || '';
  }

  /** Resolve o nome da avaliação: tenta cache local primeiro, depois Firestore direto */
  private async resolveAssessmentName(id: string): Promise<string> {
    // Cache local: ignora entradas onde o "nome" é na verdade o próprio ID
    const cached = this.assessments.find(a => a.id === id);
    if (cached?.name && cached.name !== id) return cached.name;
    try {
      const snap = await getDoc(doc(this.firestore, 'assessments', id));
      if (snap.exists()) {
        const d = snap.data();
        // Tenta name → surveyJSON.title → id (fallback final)
        const name: string = d['name'] || d['surveyJSON']?.['title'] || id;
        // Atualiza ou insere no cache
        const idx = this.assessments.findIndex(a => a.id === id);
        if (idx >= 0) {
          this.assessments[idx].name = name;
        } else {
          this.assessments.push({ id, name });
        }
        this.filteredAssessments = [...this.assessments];
        return name;
      }
    } catch (e) {
      console.error('[resolveAssessmentName] Erro ao buscar nome da avaliação:', e);
    }
    return id;
  }

  onAssessmentSelected(id: string): void {
    this.assessmentControl.setValue(id);
    this.assessmentSearchControl.setValue(this.displayAssessmentName(id), { emitEvent: false });
    this.filteredAssessments = [...this.assessments];
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

    // Carregar todas as competências disponíveis
    await this.loadAllCompetencies();
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

    // Limpar avaliados (em modo individual preserva a seleção definida via query params)
    this.avaliadosDisponiveis = [];
    if (!this.isIndividualMode) {
      this.selectedAvaliado = null;
      this.avaliadoControl.setValue('');
    }

    try {
    const assessmentRef = doc(this.firestore, 'assessments', this.selectedAssessmentId);
    const assessmentSnap = await getDoc(assessmentRef);
    if (!assessmentSnap.exists()) {
      return; // finally handles hide()
    }
    const assessmentData = assessmentSnap.data();
    console.log('📊 AssessmentData:', assessmentData);

    const surveyJSON = assessmentData['surveyJSON'];
    console.log('📊 SurveyJSON encontrado:', !!surveyJSON);
    console.log('📊 SurveyJSON:', surveyJSON);

    if (!surveyJSON || !surveyJSON.pages) {
      console.log('❌ SurveyJSON não encontrado ou sem páginas');
      return; // finally handles hide()
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
          // Para outros tipos de perguntas, capturar TODOS os tipos agora
          else if (element.name) {
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
            console.log(`📝 QuestionMap[${element.name}] = "${questionTitle}" (tipo: ${element.type})`);
            console.log(`   └─ Extraído de: ${JSON.stringify(element.title)}`);
          }
        });
      }
    });

    console.log('📊 Questões extraídas:', questions);
    console.log('📊 QuestionMap:', this.questionMap);

    // Armazenar todas as perguntas
    this.allQuestions = questions;

    // Aplicar filtro de tipos de perguntas
    this.applyQuestionFilter();

    // Definir colunas da tabela e popular dynamicColumns
    this.displayedColumns = ['data', 'categoria', 'avaliado', 'dataAvaliacao', ...this.filteredQuestions.map(q => q.id)];
    this.dynamicColumns = this.filteredQuestions.map(q => q.id);

    this.debugLog('📊 DynamicColumns populado:', this.dynamicColumns);
    this.debugLog('📊 DisplayedColumns:', this.displayedColumns);

    // Carregar resultados
    const resultsSnap = await getDocs(collection(this.firestore, `assessments/${this.selectedAssessmentId}/results`));
    this.debugLog('Resultados encontrados:', resultsSnap.docs.length);

    const results: any[] = [];
    for (const resultDoc of resultsSnap.docs) {
      const resultData = resultDoc.data();
      this.debugLog('Resultado individual:', resultData);
      this.debugLog('🔍 Estrutura completa do resultData:', {
        keys: Object.keys(resultData),
        hasSurveyData: 'surveyData' in resultData,
        surveyDataType: resultData['surveyData'] ? typeof resultData['surveyData'] : 'undefined',
        surveyDataKeys: resultData['surveyData'] ? Object.keys(resultData['surveyData']) : [],
        participantId: resultData['participantId'],
        completedAt: resultData['completedAt']
      });

      // Buscar dados do participante com cache local para reduzir leituras
      let participantData: any | null = null;
      const participantId: string = resultData['participantId'];
      if (this.participantsCache.has(participantId)) {
        participantData = this.participantsCache.get(participantId);
      } else {
        const participantRef = doc(this.firestore, 'participants', participantId);
        const participantSnap = await getDoc(participantRef);
        if (participantSnap.exists()) {
          participantData = participantSnap.data();
          this.participantsCache.set(participantId, participantData);
        }
      }

      if (participantData) {
        this.debugLog('Dados do participante:', participantData);

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
            tipo: participantData['type'] || 'avaliado', // 'avaliado' | 'avaliador' para filtrar lista
            dataAvaliacao: resultData['completedAt'] ?
              new Date(resultData['completedAt'].toDate()).toLocaleDateString('pt-BR') : 'N/A',
            isTargetParticipant: isTargetParticipant // Marcar se é o participante alvo
          };

          // Adicionar respostas às perguntas
          if (resultData['surveyData']) {
            this.debugLog(`🔍 Processando surveyData para participante ${participantData['name']}:`, {
              surveyDataKeys: Object.keys(resultData['surveyData']),
              surveyDataValues: resultData['surveyData'],
              questionsToProcess: questions.map(q => q.id)
            });

            questions.forEach(question => {
              let resposta: any = null;

              // Suporte a estrutura aninhada: perguntaX -> Row N -> "Column M"
              // Ex.: question.id = "pergunta4_Row 1" → baseId = "pergunta4", rowKey = "Row 1"
              const matrixMatch = question.id.match(/^(pergunta\d+)_Row\s*(\d+)$/);
              if (matrixMatch) {
                const baseId = matrixMatch[1];
                const rowKey = `Row ${matrixMatch[2]}`;
                const grupoPergunta = resultData['surveyData'][baseId];
                if (grupoPergunta && typeof grupoPergunta === 'object') {
                  resposta = grupoPergunta[rowKey] ?? null;
                }
              }

              // Fallback: tentar acesso direto (para perguntas não-matriz ou quando já vem "perguntaX_Row N")
              if (resposta === null || resposta === undefined) {
                resposta = resultData['surveyData'][question.id] ?? null;
              }

              row[question.id] = resposta ?? null;

              this.debugLog(`  📝 Pergunta ${question.id}:`, {
                resposta,
                tipo: typeof resposta,
                valorFinal: row[question.id]
              });
            });
          } else {
            this.debugLog(`❌ Sem surveyData para participante ${participantData['name']}:`, {
              resultDataKeys: Object.keys(resultData),
              hasSurveyData: 'surveyData' in resultData
            });
          }

          this.debugLog('Incluindo linha:', {
            participante: participantData['name'],
            tipo: participantData['type'],
            categoria: participantData['category'],
            isIndividualMode: this.isIndividualMode
          });

          results.push(row);
        } else {
          this.debugLog('Excluindo linha:', {
            participante: participantData['name'],
            tipo: participantData['type'],
            categoria: participantData['category'],
            isIndividualMode: this.isIndividualMode
          });
        }
      }
    }

    this.debugLog('Resultados processados:', results);
    this.dataSource = results;

    // Carregar avaliados disponíveis após processar os dados
    this.avaliadosDisponiveis = this.getAvaliadosDisponiveis();
    console.log('Avaliados disponíveis:', this.avaliadosDisponiveis);

    this.performanceMonitor.endTimer('onAssessmentChange');

    // Mensagem informativa para modo individual
    if (this.isIndividualMode && this.individualParticipantName) {
      const targetParticipantCount = results.filter(r => r.isTargetParticipant).length;
      const totalParticipants = results.length;

      console.log(`Modo individual: ${targetParticipantCount} registros do avaliado alvo, ${totalParticipants} total de participantes`);

      const message = this.t('Relatório individual para {{name}} carregado. ({{self}} auto-avaliação, {{total}} total de participantes na avaliação)')
        .replace('{{name}}', this.individualParticipantName)
        .replace('{{self}}', String(targetParticipantCount))
        .replace('{{total}}', String(totalParticipants));
      this.snackBar.open(message, this.t('Fechar'), { duration: 4000 });
    }

        // Atualizar perguntas bloqueadas após carregar os dados
    this.atualizarPerguntasBloqueadas();

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

    // Verificação final
    console.log('✅ Verificação final:');
    console.log('  - DynamicColumns length:', this.dynamicColumns.length);
    console.log('  - QuestionMap keys:', Object.keys(this.questionMap).length);
    console.log('  - QuestionMap values:', Object.values(this.questionMap));

    } catch (error) {
      console.error('Erro ao carregar dados da avaliação:', error);
      this.snackBar.open(
        this.t('Erro ao carregar dados da avaliação. Tente novamente.'),
        this.t('Fechar'),
        { duration: 4000 }
      );
    } finally {
      // ✅ Sempre executado — garante que o loading nunca fique preso
      this.loadingService.hide();
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  exportCSV() {
    if (!this.dataSource.length) return;
    exportToCSV(
      'relatorio_avaliacao.csv',
      this.displayedColumns,
      this.dataSource,
      (row, col) => row[col]
    );
  }

  async generatePDFCover() { await this.reportsPdf.generateCoverPDF('report-cover'); }

  async generatePDFSummary() { await this.reportsPdf.generateSummaryPDF(this.competencyAverages, this.topItems, this.lowItems); }

  private buildConsolidationData(dynamicCols: string[], rows: any[]) {
    this.consolidation = computeConsolidation(dynamicCols, rows, this.questionMap as any) as any;
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

  // parseNumeric movido para reports-utils.ts

  salvarCompetencia() {
    if (this.competenciaForm.invalid) return;

    const formValue = this.competenciaForm.value;
    const idCompetenciaEditando = this.competenciaEditando.id;

    if (idCompetenciaEditando) {
      // Editando competência existente
      const idx = this.competencias.findIndex(c => c.id === idCompetenciaEditando);
      if (idx > -1) this.competencias[idx] = { ...this.competenciaEditando, ...formValue };
      this.snackBar.open(this.t('Competência atualizada com sucesso!'), this.t('Fechar'), { duration: 3000 });
    } else {
      // Adicionando nova competência
      const nova: Competencia = {
        id: `comp_${new Date().getTime()}`,
        ...formValue
      };
      this.competencias.push(nova);
      this.snackBar.open(this.t('Competência adicionada com sucesso!'), this.t('Fechar'), { duration: 3000 });
    }
    // Invalida cache de resumos e seções
    this.invalidateCache('resumo-');
    this.invalidateCache('secao-');
    this.cancelarEdicaoCompetencia();
    this.atualizarPerguntasBloqueadas();
  }

  editarCompetencia(c: Competencia) {
    this.competenciaEditando = { ...c };
    this.competenciaForm.setValue({
      nome: c.nome,
      descricao: c.descricao,
      perguntasIds: c.perguntasIds
    });
    this.atualizarPerguntasBloqueadas();
  }

  cancelarEdicaoCompetencia() {
    this.competenciaEditando = { id: '', nome: '', descricao: '', perguntasIds: [] };
    this.competenciaForm.reset({ nome: '', descricao: '', perguntasIds: [] });
    this.atualizarPerguntasBloqueadas();
  }

  get selectedAssessmentName(): string {
    const assessmentName = this.assessments.find(a => a.id === this.selectedAssessmentId)?.name || 'Nenhuma';

    // Se há um avaliado selecionado, incluir no nome
    if (this.selectedAvaliado) {
      return `${assessmentName} - ${this.selectedAvaliado}`;
    }

    return assessmentName;
  }

  // Getter para obter apenas o nome do avaliado selecionado
  get selectedAvaliadoName(): string {
    return this.selectedAvaliado || 'Nenhum avaliado selecionado';
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
    this.relatorioFormArray.insert(index + 1, this.fb.group({
      visivel: [novaSecao.visivel],
      titulo: [novaSecao.titulo],
      texto: [novaSecao.texto],
      competenciasIds: [[]],
      id: [novaSecao.id],
      tipo: [novaSecao.tipo],
      ordem: [novaSecao.ordem],
      tipoGrafico: ['barra'],
      paletaCor: ['padrao'],
      coresPersonalizadas: [[]]
    }));
    this.relatorioConfiguracao.forEach((s, i) => s.ordem = i + 1);
    this.snackBar.open(this.t('Seção adicionada!'), this.t('Fechar'), { duration: 2000 });
  }

  getSecaoFormGroup(index: number): FormGroup {
    return this.relatorioFormArray.at(index) as FormGroup;
  }

  atualizarSecaoConfiguracao(index: number) {
    const formValue = this.relatorioFormArray.at(index).value;
    const secao = this.relatorioConfiguracao[index];

    // Logar conteúdo do texto antes de atualizar (especialmente para capa)
    if (secao.tipo === 'capa' && formValue.texto) {
      const texto = formValue.texto;
      console.log('✏️ EDITANDO - Conteúdo do texto do form (primeiros 1000 chars):', texto?.substring(0, 1000));
      console.log('✏️ EDITANDO - Tipo do conteúdo:', typeof texto);
      console.log('✏️ EDITANDO - Tamanho total:', texto?.length);
      console.log('✏️ EDITANDO - Contém HTML:', texto?.includes('<div') || texto?.includes('<h3'));
      console.log('✏️ EDITANDO - Contém Markdown:', texto?.includes('##') || texto?.includes('**'));
      console.log('✏️ EDITANDO - Contém "Respondentes":', texto?.toLowerCase().includes('respondentes'));
      console.log('✏️ EDITANDO - Contém "por Categoria":', texto?.toLowerCase().includes('por categoria'));
      console.log('✏️ EDITANDO - Contém HTML entities:', texto?.includes('&nbsp;') || texto?.includes('&amp;') || texto?.includes('&lt;') || texto?.includes('&gt;'));

      // Verificar estrutura específica da seção de categorias
      const temH3Respondentes = /<h3[^>]*>[\s\S]*?[Rr]espondentes[\s\S]*?por[\s\S]*?[Cc]ategoria[\s\S]*?<\/h3>/i.test(texto);
      const temDivRespondentes = /<div[^>]*>[\s\S]*?[Rr]espondentes[\s\S]*?por[\s\S]*?[Cc]ategoria[\s\S]*?<\/div>/i.test(texto);
      console.log('✏️ EDITANDO - Tem H3 com "Respondentes por Categoria":', temH3Respondentes);
      console.log('✏️ EDITANDO - Tem DIV com "Respondentes por Categoria":', temDivRespondentes);

      // Extrair trecho onde deveria estar a seção
      const indice = texto.toLowerCase().indexOf('respondentes');
      if (indice >= 0) {
        const trecho = texto.substring(Math.max(0, indice - 100), Math.min(texto.length, indice + 800));
        console.log('✏️ EDITANDO - Trecho encontrado (índice', indice, '):', trecho);
      }
    }

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

    // Logar conteúdo após atualizar
    if (secao.tipo === 'capa') {
      console.log('✏️ EDITANDO - Conteúdo da seção após atualizar (primeiros 500 chars):', secao.texto?.substring(0, 500));
    }
  }

  get relatorioFormGroups(): FormGroup[] {
    return this.relatorioFormArray.controls as FormGroup[];
  }

  getOrInitTextoCompetencia(secao: RelatorioSecao, comp: Competencia): string {
    if (!secao.textosPorCompetencia) {
      secao.textosPorCompetencia = {};
    }
    if (!secao.textosPorCompetencia[comp.id]) {
      // Cria o texto padrão a partir das perguntas
      secao.textosPorCompetencia[comp.id] = comp.perguntasIds
        .map(pId => this.questionMap[pId] || '')
        .join('. ');
    }
    return secao.textosPorCompetencia[comp.id];
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

  // Retorna as médias por competência e grupo de avaliadores para o bloco de Resumo
  getResumoMedias() {
    return this.getCachedCalculation('resumo-medias', () => {
      const grupos = ['Avaliado(a)', 'Gestor(es)', 'Pares', 'Subordinados', 'Outros'];
      const secaoResumo = this.relatorioConfiguracao.find(s => s.tipo === 'resumo');
      if (!secaoResumo || !secaoResumo.competenciasIds?.length) {
        console.log('[Resumo] Nenhuma competência selecionada na seção de resumo.');
        return [];
      }
      const competenciasSelecionadas = this.competencias.filter(c => secaoResumo.competenciasIds!.includes(c.id));
      console.log('[Resumo] Competências selecionadas:', competenciasSelecionadas.map(c => ({ id: c.id, nome: c.nome, perguntasIds: c.perguntasIds })));

      if (this.dataSource.length) {
        console.log('[Resumo] Exemplo de linha do dataSource:', this.dataSource[0]);
      }

      const resultado: any[] = [];
      for (const comp of competenciasSelecionadas) {
        const perguntas = comp.perguntasIds;
        console.log(`[Resumo] Processando competência: ${comp.nome} (Perguntas: ${perguntas})`);

        for (const grupo of grupos) {
          let soma = 0;
          let count = 0;

          // 🚀 PERFORMANCE: Usar índice para buscar dados por categoria
          const indicesGrupo = this.dataIndexes.participantsByCategory.get(grupo) || [];

          for (const index of indicesGrupo) {
            const row = this.dataSource[index];
            for (const pid of perguntas) {
              const val = parseNumeric(row[pid]);
              console.log(`[Resumo] Valor encontrado para pid='${pid}':`, val);
              if (val !== null) {
                soma += val;
                count++;
              }
            }
          }

          console.log(`[Resumo] Competência: ${comp.nome}, Grupo: ${grupo}, Soma: ${soma}, Count: ${count}, Média: ${count ? soma / count : null}`);
          resultado.push({
            competencia: comp.nome,
            descricao: comp.descricao,
            grupo,
            media: count ? soma / count : null
          });
        }
      }
      return resultado;
    });
  }

  // Retorna as médias organizadas por competência para melhor apresentação no relatório
  getResumoMediasPorCompetencia() {
    return this.getCachedCalculation('resumo-medias-por-competencia', () => {
      const resumoMedias = this.getResumoMedias();
      const competenciasAgrupadas: { [key: string]: any } = {};

      for (const linha of resumoMedias) {
        if (!competenciasAgrupadas[linha.competencia]) {
          competenciasAgrupadas[linha.competencia] = {
            nome: linha.competencia,
            descricao: linha.descricao,
            dados: []
          };
        }
        competenciasAgrupadas[linha.competencia].dados.push({
          grupo: linha.grupo,
          media: linha.media
        });
      }

      return Object.values(competenciasAgrupadas);
    });
  }

  // 🚀 PERFORMANCE: Métodos utilitários para gráficos dinâmicos na visualização do relatório
  getSecaoStackedData(secao: any) {
    const competenciasSelecionadas = this.getCompetenciasSelecionadasParaGraficos(secao);
    const grupos = this.getGrupos();

    if (competenciasSelecionadas.length === 0 || grupos.length === 0) {
      return [];
    }

    const result = competenciasSelecionadas.map(comp => {
      const series = grupos.map(grupo => {
        const media = this.getMediaPorPerguntaEGrupo(comp, grupo);
        const valor = (media !== null && !isNaN(media)) ? media : 0;
        return {
          name: grupo,
          value: valor
        };
      });

      return {
        name: comp.nome,
        series: series
      };
    });

    return result;
  }

  // Novo método para gráfico de barras comparativo por categoria
  getSecaoBarraComparativaData(secao: any) {
    const competenciasSelecionadas = this.getCompetenciasSelecionadasParaGraficos(secao);
    const grupos = this.getGrupos();

    if (competenciasSelecionadas.length === 0 || grupos.length === 0) {
      return [];
    }

    // Para cada competência, criar uma série de dados
    const result: any[] = [];

    competenciasSelecionadas.forEach(comp => {
      // Adicionar dados para cada grupo/categoria
      grupos.forEach(grupo => {
        const media = this.getMediaPorPerguntaEGrupo(comp, grupo);
        const valor = (media !== null && !isNaN(media)) ? media : 0;

        result.push({
          name: `${comp.nome} - ${grupo}`,
          value: valor,
          competencia: comp.nome,
          grupo: grupo
        });
      });

      // Adicionar "Resultado final" (média ponderada de todos os grupos)
      let somaTotal = 0;
      let contadorTotal = 0;

      grupos.forEach(grupo => {
        const media = this.getMediaPorPerguntaEGrupo(comp, grupo);
        if (media !== null && !isNaN(media)) {
          somaTotal += media;
          contadorTotal++;
        }
      });

      if (contadorTotal > 0) {
        const mediaFinal = somaTotal / contadorTotal;
        result.push({
          name: `${comp.nome} - Resultado Final`,
          value: mediaFinal,
          competencia: comp.nome,
          grupo: 'Resultado Final'
        });
      }
    });

    return result;
  }

  // Método para obter dados de gráfico de barras comparativo para uma competência específica
  getCompetenciaBarraComparativaData(competencia: Competencia): any[] {
    const grupos = this.getGrupos();
    const data: any[] = [];

    grupos.forEach(grupo => {
      const media = this.getMediaPorPerguntaEGrupo(competencia, grupo);
      if (media !== null && !isNaN(media)) {
        data.push({
          name: grupo,
          value: media
        });
      }
    });

    // Adicionar resultado final (média geral) para a competência
    let somaTotal = 0;
    let contadorTotal = 0;

    grupos.forEach(grupo => {
      const media = this.getMediaPorPerguntaEGrupo(competencia, grupo);
      if (media !== null && !isNaN(media)) {
        somaTotal += media;
        contadorTotal++;
      }
    });

    if (contadorTotal > 0) {
      const mediaFinal = somaTotal / contadorTotal;
      data.push({
        name: 'Resultado Final',
        value: mediaFinal
      });
    }

    return data;
  }

  // Método para obter esquema de cores específico para gráfico de barras comparativo
  getSecaoBarraComparativaColorScheme(secao: any) {
    const grupos = this.getGrupos();
    const coresCategorias = this.paletasCores.categorias.cores;
    const corResultadoFinal = '#FF6B35'; // Cor especial para resultado final

    const domain: string[] = [];

    // Cores para cada categoria
    grupos.forEach((grupo, index) => {
      domain.push(coresCategorias[index % coresCategorias.length]);
    });

    // Cor para resultado final
    domain.push(corResultadoFinal);

    return { domain };
  }

  // Método para gerar tooltip informativo para cada cor
  getCorTooltip(secao: any, index: number): string {
    const paletaSelecionada = secao?.paletaCor || secao?.['paletaCor'] || 'padrao';

    if (paletaSelecionada === 'categorias') {
      const grupos = this.getGrupos();
      const coresCategorias = this.paletasCores.categorias.cores;

      if (index < grupos.length) {
        return `${grupos[index]}: ${coresCategorias[index % coresCategorias.length]}`;
      } else if (index === grupos.length) {
        return `Resultado Final: #FF6B35`;
      }
    }

    // Para outras paletas, retornar apenas a cor
    const cores = this.getColorSchemeParaSecao(secao).domain;
    return cores[index] || '';
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
        name: comp.nome,
        value: mediaGeral
      };
    });

    return result;
  }

  // Métodos para gráficos individuais por característica
  getCompetenciaStackedData(comp: Competencia) {
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

  getCompetenciaRadarOptions(comp: Competencia): EChartsOption {
    const stackedData = this.getCompetenciaStackedData(comp);
    if (!stackedData.length) return {};

    const indicator = stackedData.map((d: any) => ({ name: d.name, max: 5 }));
    const seriesData = [{
      name: comp.nome,
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
        name: comp.nome,
        value: values
      };
    });

    return {
      legend: {
        top: 'bottom',
        data: competenciasSelecionadas.map(comp => comp.nome)
      },
      radar: { indicator },
      series: [{
        type: 'radar' as const,
        data: seriesData
      }]
    };
  }

  getCompetenciaPieData(comp: Competencia) {
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
    const novoTipo = this.getTipoGraficoControl(i).value;
    secao['tipoGrafico'] = novoTipo;

    // Se mudou para "Barra Comparativa", automaticamente selecionar paleta "Categorias Distintas"
    if (novoTipo === 'barra') {
      const paletaControl = this.getPaletaCorControl(i);
      if (paletaControl && paletaControl.value !== 'categorias') {
        paletaControl.setValue('categorias');
        secao['paletaCor'] = 'categorias';
        console.log('Paleta automaticamente alterada para "Categorias Distintas" para gráfico de barras comparativo');
      }
    }

    this.invalidateCache(`secao-${secao.id}`);
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

    if (paletaSelecionada === 'personalizada') {
      const coresPersonalizadas = secao?.coresPersonalizadas || secao?.['coresPersonalizadas'] || [];
      if (coresPersonalizadas.length > 0) {
        return { domain: coresPersonalizadas };
      } else {
        // Se não tem cores personalizadas, usar cores padrão da paleta personalizada
        return { domain: this.paletasCores['personalizada'].cores };
      }
    }

    // Para paleta "Categorias Distintas", usar cores específicas para cada categoria
    if (paletaSelecionada === 'categorias') {
      return this.getSecaoBarraComparativaColorScheme(secao);
    }

    const paletas = this.paletasCores as any;
    const cores = paletas[paletaSelecionada]?.cores || this.paletasCores['padrao'].cores;
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
    const gruposEncontrados = Array.from(this.dataIndexes.participantsByCategory.keys());

    // Combinar grupos padrão com grupos encontrados, removendo duplicatas
    const todosGrupos = [...new Set([...gruposPadrao, ...gruposEncontrados])];

    return todosGrupos;
  }

  // Método auxiliar para obter característica por ID
  getCompetenciaPorId(id: string): Competencia | undefined {
    return this.competencias.find(c => c.id === id);
  }

  // Características selecionadas para a seção de gráficos
  getCompetenciasSelecionadasParaGraficos(secao: any): Competencia[] {
    const result = (!secao || !secao.competenciasIds) ? [] : this.competencias.filter(c => secao.competenciasIds.includes(c.id));
    // console.log('🔍 getCompetenciasSelecionadasParaGraficos() - secao:', secao);
    // console.log('🔍 getCompetenciasSelecionadasParaGraficos() - result:', result);
    return result;
  }

  getCompetenciasSelecionadasParaSecao(secao: RelatorioSecao): Competencia[] {
    if (!secao || !secao.competenciasIds) {
      return [];
    }
    return this.competencias.filter(c => secao.competenciasIds!.includes(c.id));
  }

  getCompetenciasSelecionadasParaTabela() {
    const secaoTabela = this.relatorioConfiguracao.find(s => s.tipo === 'tabela');
    if (!secaoTabela || !secaoTabela.competenciasIds) {
      return [];
    }
    return this.competencias.filter(c => secaoTabela.competenciasIds!.includes(c.id));
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
    for (const pid of carac.perguntasIds || []) {
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

    for (const pid of carac.perguntasIds || []) {
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
      this.snackBar.open(erro, this.t('Fechar'), { duration: 3000 });
      return;
    }
    if (!this.nomeRelatorioControl.value) {
      this.snackBar.open(this.t('Por favor, dê um nome ao relatório.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    // Verificar nome duplicado
    const nomeExistente = this.savedReports.find(
      r => r.name.toLowerCase() === this.nomeRelatorioControl.value!.toLowerCase()
    );
    if (nomeExistente) {
      this.snackBar.open(this.t('Já existe um relatório com este nome. Escolha outro nome ou carregue e atualize o existente.'), this.t('Fechar'), { duration: 4000 });
      return;
    }

    const assessment = this.assessments.find(a => a.id === this.selectedAssessmentId);
    const sanitize = (val: any) => JSON.parse(JSON.stringify(val ?? []));
    const reportData = {
      nome: this.nomeRelatorioControl.value,
      assessmentId: this.selectedAssessmentId,
      assessmentName: assessment ? assessment.name : '',
      competencias: sanitize(this.competencias),
      configuracao: sanitize(this.relatorioConfiguracao),
      criadoEm: new Date()
    };
    try {
      const docRef = await addDoc(collection(this.firestore, 'reports'), reportData);
      this.snackBar.open(this.t('Relatório salvo com sucesso!'), this.t('Fechar'), { duration: 3000 });
      this.selectedReportId.setValue(docRef.id);
      this.carregarRelatoriosSalvos();
    } catch (e) {
      console.error('Erro ao salvar relatório: ', e);
      this.snackBar.open(this.t('Ocorreu um erro ao salvar o relatório.'), this.t('Fechar'), { duration: 3000 });
    }
  }

  async carregarRelatoriosSalvos() {
    const reportsSnap = await getDocs(collection(this.firestore, 'reports'));
    this.savedReports = reportsSnap.docs.map(doc => ({
      id: doc.id,
      name: doc.data()['nome'] || doc.id
    }));
  }

  async atualizarRelatorioNoFirebase() {
    if (!this.selectedReportId.value) {
      this.snackBar.open(this.t('Selecione um relatório para atualizar.'), this.t('Fechar'), { duration: 3000 });
      return;
    }
    const nomeRelatorio = this.nomeRelatorioControl.value
      || this.savedReports.find(r => r.id === this.selectedReportId.value)?.name
      || '';
    if (!nomeRelatorio) {
      this.snackBar.open(this.t('Por favor, dê um nome ao relatório.'), this.t('Fechar'), { duration: 3000 });
      return;
    }
    const assessment = this.assessments.find(a => a.id === this.selectedAssessmentId);
    const sanitize = (val: any) => JSON.parse(JSON.stringify(val ?? []));
    const reportRef = doc(this.firestore, 'reports', this.selectedReportId.value);
    const reportData = {
      nome: nomeRelatorio,
      assessmentId: this.selectedAssessmentId,
      assessmentName: assessment ? assessment.name : '',
      competencias: sanitize(this.competencias),
      configuracao: sanitize(this.relatorioConfiguracao),
      atualizadoEm: new Date()
    };
    try {
      await setDoc(reportRef, reportData, { merge: true });
      this.snackBar.open(this.t('Relatório atualizado com sucesso!'), this.t('Fechar'), { duration: 3000 });
      this.carregarRelatoriosSalvos();
    } catch (e) {
      console.error('Erro ao atualizar relatório: ', e);
      this.snackBar.open(this.t('Ocorreu um erro ao atualizar o relatório.'), this.t('Fechar'), { duration: 3000 });
    }
  }

  async carregarRelatorioSelecionado() {
    if (!this.selectedReportId.value) return;
      const reportRef = doc(this.firestore, 'reports', this.selectedReportId.value);
      const reportSnap = await getDoc(reportRef);
      if (reportSnap.exists()) {
        const reportData = reportSnap.data();
        this.relatorioConfiguracao = reportData['configuracao'] || [];
        this.competencias = reportData['competencias'] || [];

        // Preencher automaticamente o nome do relatório no campo de nome
        if (reportData['nome']) {
          this.nomeRelatorioControl.setValue(reportData['nome']);
        }

      // Logar conteúdo das seções após carregar
      const secaoCapa = this.relatorioConfiguracao.find(s => s.tipo === 'capa');
      if (secaoCapa && secaoCapa.texto) {
        const texto = secaoCapa.texto;
        console.log('📥 CARREGANDO - Conteúdo da capa (primeiros 1000 chars):', texto.substring(0, 1000));
        console.log('📥 CARREGANDO - Tipo do conteúdo:', typeof texto);
        console.log('📥 CARREGANDO - Tamanho total:', texto.length);
        console.log('📥 CARREGANDO - Contém HTML:', texto.includes('<div') || texto.includes('<h3'));
        console.log('📥 CARREGANDO - Contém Markdown:', texto.includes('##') || texto.includes('**'));
        console.log('📥 CARREGANDO - Contém "Respondentes":', texto.toLowerCase().includes('respondentes'));
        console.log('📥 CARREGANDO - Contém "por Categoria":', texto.toLowerCase().includes('por categoria'));
        console.log('📥 CARREGANDO - Contém HTML entities:', texto.includes('&nbsp;') || texto.includes('&amp;') || texto.includes('&lt;') || texto.includes('&gt;'));

        // Verificar estrutura específica
        const temH3Respondentes = /<h3[^>]*>[\s\S]*?[Rr]espondentes[\s\S]*?por[\s\S]*?[Cc]ategoria[\s\S]*?<\/h3>/i.test(texto);
        console.log('📥 CARREGANDO - Tem H3 com "Respondentes por Categoria":', temH3Respondentes);

        // Extrair trecho onde deveria estar a seção
        const indice = texto.toLowerCase().indexOf('respondentes');
        if (indice >= 0) {
          const trecho = texto.substring(Math.max(0, indice - 100), Math.min(texto.length, indice + 800));
          console.log('📥 CARREGANDO - Trecho encontrado (índice', indice, '):', trecho);
        }
      }

      // Atualizar o form reativo
        this.atualizarFormArrayComConfiguracao();
      // Atualizar perguntas bloqueadas após carregar competências
      this.atualizarPerguntasBloqueadas();
        this.snackBar.open(this.t('Relatório carregado!'), this.t('Fechar'), { duration: 3000 });
        this.builderHasUnsavedChanges = false;
    }
  }

  // Adiciona uma nova seção customizada ao relatório
  addSecaoCustomizada(
    tipo: 'texto' | 'graficos' | 'tabela' | 'competencia_detalhada' | 'grafico_defasagem' | 'janela_johari' | 'perguntas_abertas',
    indice?: number
  ) {
    const novaSecao: RelatorioSecao = {
      id: `custom_${new Date().getTime()}`,
      tipo,
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
      case 'janela_johari':
        novaSecao.titulo = 'Janela de Johari';
        novaSecao.competenciasIds = [];
        break;
      case 'perguntas_abertas':
        novaSecao.titulo = 'Perguntas Abertas';
        novaSecao.texto = '<p>Respostas qualitativas dos participantes (avaliado e avaliadores) às perguntas: o que continuar, parar e começar a fazer.</p>';
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
    this.snackBar.open(this.t('Seção removida!'), this.t('Fechar'), { duration: 2500 });
  }

  // Método para drag-and-drop das seções
  dropSecao(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.relatorioConfiguracao, event.previousIndex, event.currentIndex);
    moveItemInArray(this.relatorioFormArray.controls, event.previousIndex, event.currentIndex);
    // Atualiza ordem
    this.relatorioConfiguracao.forEach((s, i) => s.ordem = i + 1);
  }

  /**
   * Handler para mudança de modo de montagem
   */
  onModoMontagemChange(): void {
    // Sincronizar configuração quando mudar de modo
    if (this.modoMontagem === 'classico') {
      this.atualizarFormArrayComConfiguracao();
    }
  }

  /**
   * Handler para mudanças do componente visual
   */
  onConfiguracaoVisualChange(novaConfiguracao: any[]): void {
    this.relatorioConfiguracao = novaConfiguracao;
    this.atualizarFormArrayComConfiguracao();
    this.invalidateCache('secao-');
    this.builderHasUnsavedChanges = true;
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
      case 'perguntas_abertas': return '#5C6BC0';
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
      case 'tabela': return 'Tabela de Consolidação';
      case 'competencia_detalhada': return 'Tabela por Competência';
      case 'destaques': return 'Pontos de Destaque';
      case 'custom': return 'Customizado';
      case 'texto': return 'Bloco de Texto';
      case 'perguntas_abertas': return 'Perguntas Abertas';
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
        mostrarCaracteristica: false,
        mostrarPontuacaoSemAuto: true
      }
    ];

    // Limpar seleção de avaliado ao resetar
    this.selectedAvaliado = null;
    this.avaliadoControl.setValue('');

    this.atualizarFormArrayComConfiguracao();
    this.snackBar.open(this.t('Relatório resetado para configuração padrão!'), this.t('Fechar'), { duration: 2500 });
  }

  // Salvar template no Firestore
  async salvarTemplateNoFirebase() {
    if (!this.nomeTemplateControl.value) {
      this.snackBar.open(this.t('Por favor, dê um nome ao template.'), this.t('Fechar'), { duration: 3000 });
      return;
    }
    const sanitize = (val: any) => JSON.parse(JSON.stringify(val ?? []));
    // Salvar configuração de seções com competenciasIds zerados — templates são reutilizáveis
    // entre avaliações, então não devem fixar competências de uma avaliação específica.
    const configuracaoSemCompetencias = sanitize(this.relatorioConfiguracao).map((sec: any) => ({
      ...sec,
      competenciasIds: []
    }));
    const templateData = {
      nome: this.nomeTemplateControl.value,
      configuracao: configuracaoSemCompetencias,
      criadoEm: new Date()
    };
    try {
      const docRef = await addDoc(collection(this.firestore, 'reportTemplates'), templateData);
      this.snackBar.open(this.t('Template salvo com sucesso!'), this.t('Fechar'), { duration: 3000 });
      this.nomeTemplateControl.reset();
      this.carregarTemplatesSalvos();
    } catch (e) {
      console.error('Erro ao salvar template: ', e);
      this.snackBar.open(this.t('Ocorreu um erro ao salvar o template.'), this.t('Fechar'), { duration: 3000 });
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

  async excluirRelatorio() {
    const id = this.selectedReportId.value;
    if (!id) {
      this.snackBar.open(this.t('Selecione um relatório para excluir.'), this.t('Fechar'), { duration: 3000 });
      return;
    }
    try {
      await deleteDoc(doc(this.firestore, 'reports', id));
      this.snackBar.open(this.t('Relatório excluído com sucesso!'), this.t('Fechar'), { duration: 3000 });
      this.selectedReportId.setValue('');
      await this.carregarRelatoriosSalvos();
    } catch {
      this.snackBar.open(this.t('Erro ao excluir relatório.'), this.t('Fechar'), { duration: 3000 });
    }
  }

  async excluirTemplate() {
    const id = this.selectedTemplateId.value;
    if (!id) {
      this.snackBar.open(this.t('Selecione um template para excluir.'), this.t('Fechar'), { duration: 3000 });
      return;
    }
    try {
      await deleteDoc(doc(this.firestore, 'reportTemplates', id));
      this.snackBar.open(this.t('Template excluído com sucesso!'), this.t('Fechar'), { duration: 3000 });
      this.selectedTemplateId.setValue('');
      await this.carregarTemplatesSalvos();
    } catch {
      this.snackBar.open(this.t('Erro ao excluir template.'), this.t('Fechar'), { duration: 3000 });
    }
  }

  // Aplicar template selecionado ao relatório atual
  async aplicarTemplateSelecionado() {
    if (!this.selectedTemplateId.value) return;
      const templateRef = doc(this.firestore, 'reportTemplates', this.selectedTemplateId.value);
      const templateSnap = await getDoc(templateRef);
      if (templateSnap.exists()) {
        const templateData = templateSnap.data();
        // Carregar seções do template zerando competenciasIds — serão preenchidas
        // pelas competências da avaliação atual, não do momento em que o template foi salvo
        const secoes: RelatorioSecao[] = (templateData['configuracao'] || []).map((sec: any) => ({
          ...sec,
          competenciasIds: []
        }));
        this.relatorioConfiguracao = secoes;

        // Preencher automaticamente o nome do template no campo de nome
        if (templateData['nome']) {
          this.nomeTemplateControl.setValue(templateData['nome']);
        }

        // Injetar as competências da avaliação atual em todas as seções que dependem delas
        if (this.competencias.length > 0) {
          const compIds = this.competencias.map(c => c.id);
          this.relatorioConfiguracao.forEach(sec => {
            if (['resumo', 'graficos', 'tabela', 'tabela_detalhada', 'grafico_defasagem', 'competencia_detalhada', 'janela_johari', 'perguntas_abertas'].includes(sec.tipo)) {
              sec.competenciasIds = [...compIds];
            }
          });
        }

        this.atualizarFormArrayComConfiguracao();
        // Atualizar perguntas bloqueadas após carregar competências
        this.atualizarPerguntasBloqueadas();
        this.snackBar.open(this.t('Template aplicado!'), this.t('Fechar'), { duration: 2500 });
        this.builderHasUnsavedChanges = false;
    }
  }

  // Exportar relatório completo como PDF
  async exportarRelatorioPDF(): Promise<boolean> {
    if (this.isExporting) return false;
    this.isExporting = true;
    this.exportingLabel = 'Gerando PDF...';
    this.cdr.markForCheck();
    try {
    const jsPDFmod = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');
    const element = document.getElementById('report-preview');
    if (!element) {
      this.snackBar.open(this.t('Não foi possível encontrar o preview do relatório.'), this.t('Fechar'), { duration: 3000 });
      return false;
    }
    // Ativar modo exportação (oculta UI visível) e capturar o próprio preview em tela
    const root = document.body;
    root.classList.add('export-mode');
    await new Promise(r => setTimeout(r, 100)); // delay para aplicar estilos e renderizar cores
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 0,
    });
    root.classList.remove('export-mode');
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDFmod.jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    // Sem margem: imagem ocupa toda a largura A4
    const imgWidth = pageWidth;
    const imgHeight = canvas.height * imgWidth / canvas.width;

    // Fatiar a imagem verticalmente para não cortar conteúdo entre páginas
    const sliceHeight = pageHeight * (canvas.width / imgWidth);
    let y = 0;
    let firstPage = true;
    while (y < canvas.height) {
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.min(sliceHeight, canvas.height - y);
      const ctx = sliceCanvas.getContext('2d');
      if (ctx) ctx.drawImage(canvas, 0, y, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
      const sliceImg = sliceCanvas.toDataURL('image/png');
      if (!firstPage) pdf.addPage();
      pdf.addImage(sliceImg, 'PNG', 0, 0, imgWidth, sliceCanvas.height * imgWidth / canvas.width);
      y += sliceHeight;
      firstPage = false;
    }

    // Nome do arquivo baseado no modo
    let fileName = 'relatorio-360.pdf';
    if (this.isIndividualMode && this.individualParticipantName) {
      const sanitizedName = this.individualParticipantName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      fileName = `relatorio-${sanitizedName}.pdf`;
    }

    pdf.save(fileName);
    this.snackBar.open(this.t('PDF exportado com sucesso!'), this.t('Fechar'), { duration: 3000 });
    return true;
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      this.snackBar.open(this.t('Erro ao gerar o PDF.'), this.t('Fechar'), { duration: 3000 });
      return false;
    } finally {
      this.isExporting = false;
      this.exportingLabel = '';
      this.cdr.markForCheck();
    }
  }

  /**
   * Exporta relatório usando PDFMake (NOVO MÉTODO - POC)
   * Gera PDF nativo com melhor qualidade e performance
   */
  async exportarRelatorioPDFMake(): Promise<void> {
    try {
      // Verificar se há dados
      if (!this.isDataReady()) {
        this.snackBar.open(
          this.t('Por favor, selecione uma avaliação e aguarde o carregamento dos dados.'),
          this.t('Fechar'),
          { duration: 3000 }
        );
        return;
      }

      this.loadingService.show('Gerando PDF com PDFMake...');

      // Preparar dados do componente para o serviço PDFMake
      const reportData = this.pdfMakeService.prepareReportDataFromComponent(this);

      // Gerar PDF
      await this.pdfMakeService.generateReport(reportData);

      this.loadingService.hide();
      this.snackBar.open(
        this.t('PDF gerado com sucesso usando PDFMake!'),
        this.t('Fechar'),
        { duration: 3000 }
      );
    } catch (error: any) {
      this.loadingService.hide();
      console.error('Erro ao gerar PDF com PDFMake:', error);
      const errorMessage = error.message || 'Erro desconhecido';
      this.snackBar.open(
        this.t('Erro ao gerar PDF: ') + errorMessage,
        this.t('Fechar'),
        { duration: 5000 }
      );
    }
  }

  // Exportar relatório como DOCX
  async exportarRelatorioDOCX(): Promise<void> {
    if (this.isExporting) return;
    this.isExporting = true;
    this.exportingLabel = 'Gerando DOCX...';
    this.cdr.markForCheck();
    let docxMod: any;
    try {
      docxMod = await import('docx');
    } catch (e) {
      this.snackBar.open(this.t('Pacote docx não encontrado. Instale com: npm i docx'), this.t('Fechar'), { duration: 4000 });
      this.isExporting = false;
      this.exportingLabel = '';
      return;
    }
    try {
      const { Document, Packer, Paragraph, ImageRun } = docxMod;
      const element = document.getElementById('report-preview');
      if (!element) return;

      // Rasteriza o preview como imagem (ocultando UI) e insere no DOCX
      const { default: html2canvas } = await import('html2canvas');
      const root = document.body;
      root.classList.add('export-mode');
      await new Promise(r => setTimeout(r, 100));
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 0,
      });
      root.classList.remove('export-mode');

      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      const byteChars = atob(base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const uint8Array = new Uint8Array(byteNumbers);

      const image = new ImageRun({
        data: uint8Array,
        transformation: { width: 600, height: Math.round(600 * (canvas.height / canvas.width)) }
      });

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [new Paragraph({ children: [image] })]
          }
        ]
      });

      const blob = await Packer.toBlob(doc);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'relatorio-360.docx';
      a.click();
      URL.revokeObjectURL(a.href);
      this.snackBar.open(this.t('DOCX exportado com sucesso!'), this.t('Fechar'), { duration: 3000 });
    } catch (err) {
      console.error('Erro ao exportar DOCX:', err);
      this.snackBar.open(this.t('Erro ao gerar o DOCX.'), this.t('Fechar'), { duration: 3000 });
    } finally {
      this.isExporting = false;
      this.exportingLabel = '';
      this.cdr.markForCheck();
    }
  }

  removerCompetencia(c: Competencia) {
    this.competencias = this.competencias.filter(x => x.id !== c.id);
    this.snackBar.open(this.t('Competência removida.'), this.t('Fechar'), { duration: 3000 });
    // Invalida cache de resumos e seções
    this.invalidateCache('resumo-');
    this.invalidateCache('secao-');
    this.cancelarEdicaoCompetencia();
    this.atualizarPerguntasBloqueadas();
  }

  getDadosGraficoPorCompetencia(competencia: Competencia): { name: string, value: number }[] {
    // Busca dados para uma competência específica
    const grupos = this.getGrupos();
    const dadosGrafico: { name: string, value: number }[] = [];

    console.log('getDadosGraficoPorCompetencia - competencia:', competencia);
    console.log('getDadosGraficoPorCompetencia - grupos:', grupos);

    grupos.forEach(grupo => {
      const media = this.getMediaPorPerguntaEGrupo(competencia, grupo);
      // Garantir que apenas valores válidos sejam adicionados
      const valor = (media !== null && !isNaN(media)) ? media : 0;
      dadosGrafico.push({
        name: grupo,
        value: valor
      });
    });

    console.log('getDadosGraficoPorCompetencia - result:', dadosGrafico);
    return dadosGrafico;
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
    console.group('�� DEBUG GRÁFICOS');

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
          console.log(`- ${comp.nome}:`, dadosIndividuais);
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
      console.log('Testando primeira competência:', this.competencias[0].nome);

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
  gerarTabelaCompetencia(competencia: Competencia): TabelaCompetencia {
    console.log(`🔍 gerarTabelaCompetencia:`, {
      competencia: competencia.nome,
      selectedAssessmentId: this.selectedAssessmentId,
      selectedAvaliado: this.selectedAvaliado,
      dataSourceLength: this.dataSource.length,
      perguntasIds: competencia.perguntasIds
    });

    // Debug específico quando há avaliado selecionado
    if (this.selectedAvaliado) {
      this.debugTabelaCompetencia(competencia);
    }

    if (!this.selectedAssessmentId || !this.dataSource.length) {
      console.log(`❌ Dados insuficientes: assessmentId=${this.selectedAssessmentId}, dataSource=${this.dataSource.length}`);
      return {
        competencia,
        linhas: [],
        mediasGerais: []
      };
    }

    const grupos = this.getGrupos();
    console.log(`📊 Grupos disponíveis:`, grupos);
    const linhas: LinhaTabela[] = [];

    // Para cada pergunta da competência, calcular distribuição de notas
    competencia.perguntasIds.forEach(perguntaId => {
      // Buscar título da pergunta: primeiro no questionMap (avaliação), depois em customQuestionsByCompetency
      let perguntaTexto = this.questionMap[perguntaId];

      // Se não encontrou no questionMap e é uma pergunta custom, buscar em customQuestionsByCompetency
      if (!perguntaTexto && perguntaId.startsWith('custom_')) {
        const perguntasCustom = this.customQuestionsByCompetency[competencia.id] || [];
        const perguntaCustom = perguntasCustom.find(q => q.id === perguntaId);
        if (perguntaCustom && perguntaCustom.title) {
          perguntaTexto = perguntaCustom.title;
        } else {
          // Tentar encontrar em todas as competências (caso tenha sido migrada)
          const todasPerguntasCustom = Object.values(this.customQuestionsByCompetency).flat();
          const perguntaEncontrada = todasPerguntasCustom.find(q => q.id === perguntaId);
          if (perguntaEncontrada && perguntaEncontrada.title) {
            perguntaTexto = perguntaEncontrada.title;
          }
        }
      }

      // Fallback se ainda não encontrou
      if (!perguntaTexto) {
        perguntaTexto = `Pergunta ${perguntaId}`;
      }

      console.log(`\n📝 Processando pergunta: ${perguntaId} - "${perguntaTexto}"`);
      const categorias: DadosCategoria[] = [];

      grupos.forEach(grupo => {
        // Se um avaliado específico foi selecionado, usar dados filtrados
        let respostasGrupo: number[];
        if (this.selectedAvaliado) {
          console.log(`  🎯 Usando filtro para avaliado específico: ${this.selectedAvaliado}`);
          respostasGrupo = this.getRespostasParaPerguntaEGrupoEAvaliado(perguntaId, grupo, this.selectedAvaliado);
        } else {
          console.log(`  🌐 Usando dados de todos os avaliados`);
          respostasGrupo = this.getRespostasParaPerguntaEGrupo(perguntaId, grupo);
        }

        const distribuicao = this.calcularDistribuicaoNotas(respostasGrupo);
        const media = this.calcularMediaDistribuicao(distribuicao);

        console.log(`  📊 Grupo "${grupo}": ${respostasGrupo.length} respostas, média: ${media.toFixed(2)}`);

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

      competencia.perguntasIds.forEach(perguntaId => {
        // Se um avaliado específico foi selecionado, usar dados filtrados
        let respostas: number[];
        if (this.selectedAvaliado) {
          respostas = this.getRespostasParaPerguntaEGrupoEAvaliado(perguntaId, grupo, this.selectedAvaliado);
        } else {
          respostas = this.getRespostasParaPerguntaEGrupo(perguntaId, grupo);
        }
        todasRespostasGrupo.push(...respostas);
      });

      const distribuicao = this.calcularDistribuicaoNotas(todasRespostasGrupo);
      const media = this.calcularMediaDistribuicao(distribuicao);

      console.log(`📊 Média geral grupo "${grupo}": ${media.toFixed(2)} (${todasRespostasGrupo.length} respostas)`);

      return {
        categoria: grupo,
        distribuicao,
        media,
        totalRespostas: todasRespostasGrupo.length
      };
    });

    const resultado = {
      competencia,
      linhas,
      mediasGerais
    };

    console.log(`✅ Tabela gerada com sucesso:`, {
      totalLinhas: resultado.linhas.length,
      totalMediasGerais: resultado.mediasGerais.length
    });

    return resultado;
  }

  // Método auxiliar para obter respostas de uma pergunta específica para um grupo
  private getRespostasParaPerguntaEGrupo(perguntaId: string, grupo: string): number[] {
    const respostas: number[] = [];

    this.debugLog(`🔍 getRespostasParaPerguntaEGrupo:`, {
      perguntaId,
      grupo,
      totalDataSource: this.dataSource.length
    });

    // Se o grupo for 'Todos', processar todos os dados
    if (grupo === 'Todos') {
      this.debugLog(`  🌐 Processando grupo 'Todos'`);
      this.dataSource.forEach((participant, index) => {
        this.debugLog(`  📋 Participante ${index}:`, {
          categoria: participant?.categoria,
          avaliado: participant?.avaliado,
          temPergunta: participant && participant[perguntaId] !== undefined,
          valor: participant ? participant[perguntaId] : 'undefined'
        });

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
                this.debugLog(`    🔄 String "Column" convertida para: ${valor}`);
              }
            } else {
              // Tentar converter string diretamente para número
              valor = parseFloat(valor);
              this.debugLog(`    🔄 String convertida para: ${valor}`);
            }
          }

          const valorNumerico = Number(valor);
          if (!isNaN(valorNumerico) && valorNumerico >= 1 && valorNumerico <= 5) {
            respostas.push(valorNumerico);
            this.debugLog(`    ➕ Valor válido adicionado: ${valorNumerico}`);
          } else {
            this.debugLog(`    ❌ Valor inválido: ${valorNumerico} (original: "${participant[perguntaId]}")`);
          }
        } else {
          this.debugLog(`    ❌ Participante ${index}: sem pergunta ou participante inválido`);
        }
      });
    } else {
      // Processar grupo específico - usar filtro direto no dataSource
      this.debugLog(`  🎯 Processando grupo específico: "${grupo}"`);
      this.dataSource.forEach((participant, index) => {
        // Verificar se o participante pertence ao grupo especificado
        const categoriaParticipante = this.mapCategoriaToGrupo(participant.categoria);
        this.debugLog(`  📋 Participante ${index}:`, {
          categoria: participant?.categoria,
          categoriaMapeada: categoriaParticipante,
          avaliado: participant?.avaliado,
          pertenceAoGrupo: categoriaParticipante === grupo,
          temPergunta: participant && participant[perguntaId] !== undefined,
          valor: participant ? participant[perguntaId] : 'undefined'
        });

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
                this.debugLog(`    🔄 String "Column" convertida para: ${valor}`);
              }
            } else {
              // Tentar converter string diretamente para número
              valor = parseFloat(valor);
              this.debugLog(`    🔄 String convertida para: ${valor}`);
            }
          }

          const valorNumerico = Number(valor);
          if (!isNaN(valorNumerico) && valorNumerico >= 1 && valorNumerico <= 5) {
            respostas.push(valorNumerico);
            this.debugLog(`    ➕ Valor válido adicionado: ${valorNumerico}`);
          } else {
            this.debugLog(`    ❌ Valor inválido: ${valorNumerico} (original: "${participant[perguntaId]}")`);
          }
        } else {
          if (categoriaParticipante !== grupo) {
            this.debugLog(`    ❌ Participante ${index}: não pertence ao grupo "${grupo}" (é "${categoriaParticipante}")`);
          } else {
            this.debugLog(`    ❌ Participante ${index}: sem pergunta "${perguntaId}"`);
          }
        }
      });
    }

    this.debugLog(`📊 Total de respostas encontradas para "${perguntaId}" no grupo "${grupo}": ${respostas.length} - [${respostas.join(', ')}]`);
    return respostas;
  }

  // Método auxiliar para obter respostas de uma pergunta específica para um grupo e avaliado específico
  private getRespostasParaPerguntaEGrupoEAvaliado(perguntaId: string, grupo: string, avaliadoSelecionado: string): number[] {
    const respostas: number[] = [];

    console.log(`🔍 getRespostasParaPerguntaEGrupoEAvaliado:`, {
      perguntaId,
      grupo,
      avaliadoSelecionado,
      totalDataSource: this.dataSource.length
    });

    // Se o grupo for 'Todos', processar todos os dados do avaliado específico
    if (grupo === 'Todos') {
      this.dataSource.forEach((participant, index) => {
        // Verificar se o participante é o avaliado selecionado
        if (participant && participant['avaliado'] === avaliadoSelecionado && participant[perguntaId] !== undefined) {
          let valor = participant[perguntaId];

          console.log(`  ✅ Participante ${index}: avaliado="${participant['avaliado']}", pergunta=${perguntaId}, valor="${valor}"`);

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
            console.log(`    ➕ Valor válido adicionado: ${valorNumerico}`);
          } else {
            console.log(`    ❌ Valor inválido: ${valorNumerico} (original: "${participant[perguntaId]}")`);
          }
        } else {
          if (participant) {
            console.log(`  ❌ Participante ${index}: avaliado="${participant['avaliado']}", temPergunta=${participant[perguntaId] !== undefined}`);
          }
        }
      });
    } else {
      // Processar grupo específico para o avaliado selecionado
      this.dataSource.forEach((participant, index) => {
        // Verificar se o participante pertence ao grupo especificado E é o avaliado selecionado
        const categoriaParticipante = this.mapCategoriaToGrupo(participant.categoria);
        if (categoriaParticipante === grupo &&
            participant['avaliado'] === avaliadoSelecionado &&
            participant[perguntaId] !== undefined) {
          let valor = participant[perguntaId];

          console.log(`  ✅ Participante ${index}: grupo="${categoriaParticipante}", avaliado="${participant['avaliado']}", pergunta=${perguntaId}, valor="${valor}"`);

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
            console.log(`    ➕ Valor válido adicionado: ${valorNumerico}`);
          } else {
            console.log(`    ❌ Valor inválido: ${valorNumerico} (original: "${participant[perguntaId]}")`);
          }
        } else {
          if (participant) {
            console.log(`  ❌ Participante ${index}: grupo="${categoriaParticipante}", avaliado="${participant['avaliado']}", temPergunta=${participant[perguntaId] !== undefined}`);
          }
        }
      });
    }

    console.log(`📊 Total de respostas encontradas: ${respostas.length} - [${respostas.join(', ')}]`);
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

  private getMediaRespostasCompetencia(competencia: Competencia, grupos: string[]): number {
    const cacheKey = `media-competencia-${competencia.id}-${grupos.join('-')}`;
    return this.getCachedCalculation(cacheKey, () => {
        let todasRespostas: number[] = [];
        for (const perguntaId of competencia.perguntasIds) {
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

      const labels = competenciasSelecionadas.map(c => c.nome);
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
      console.log('🧪 Testando primeira competência:', primeiraComp.nome);
      console.log('- Perguntas:', primeiraComp.perguntasIds);

      if (primeiraComp.perguntasIds.length > 0) {
        const primeiraPergunta = primeiraComp.perguntasIds[0];
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
    console.log('- Participantes por categoria:', this.dataIndexes.participantsByCategory);
    grupos.forEach(grupo => {
      const indices = this.dataIndexes.participantsByCategory.get(grupo) || [];
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
      console.log('🧪 Teste com primeira competência:', comp.nome);
      console.log('- Perguntas da competência:', comp.perguntasIds);

      // Teste de respostas para primeira pergunta
      if (comp.perguntasIds.length > 0) {
        const primeiraPergunta = comp.perguntasIds[0];
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
  getCompetenciasComTabela(): Competencia[] {
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

  // Ordem das categorias para exibição nas perguntas abertas
  private readonly CATEGORIAS_ORDEM = ['Avaliado(a)', 'Gestor(es)', 'Pares', 'Subordinados', 'Outros'];

  /**
   * Retorna dados das perguntas abertas (texto livre) agrupadas por categoria de participante.
   * Inclui as perguntas: continuar, parar e começar a fazer - respondidas por todos (avaliado e avaliadores).
   */
  getPerguntasAbertasData(): { perguntaId: string; perguntaTitulo: string; respostasPorCategoria: { [categoria: string]: string[] } }[] {
    if (!this.allQuestions?.length || !this.dataSource?.length) return [];

    const openTypes = ['text', 'comment', 'multipletext'];
    const perguntasAbertas = this.allQuestions.filter((q: any) => openTypes.includes(q.type));

    return perguntasAbertas.map((q: any) => {
      const perguntaId = q.id;
      const perguntaTitulo = this.questionMap[perguntaId] || q.title || perguntaId;
      const respostasPorCategoria: { [categoria: string]: string[] } = {};

      this.dataSource.forEach((row: any) => {
        const valor = row[perguntaId];
        if (valor == null) return;
        const texto = typeof valor === 'string' ? valor.trim() : String(valor).trim();
        if (!texto) return;

        const categoria = this.mapCategoriaToGrupo(row.categoria || '');
        if (!respostasPorCategoria[categoria]) respostasPorCategoria[categoria] = [];
        respostasPorCategoria[categoria].push(texto);
      });

      return { perguntaId, perguntaTitulo, respostasPorCategoria };
    }).filter(item => Object.keys(item.respostasPorCategoria).length > 0);
  }

  /** Retorna as categorias ordenadas para exibição */
  getCategoriasOrdenadas(respostasPorCategoria: { [categoria: string]: string[] }): string[] {
    const keys = Object.keys(respostasPorCategoria);
    return this.CATEGORIAS_ORDEM.filter(c => keys.includes(c)).concat(keys.filter(k => !this.CATEGORIAS_ORDEM.includes(k)));
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

    // Usar o avaliado selecionado se não foi passado como parâmetro
    const avaliado = avaliadoSelecionado || this.selectedAvaliado;

    // Percorrer todas as competências e suas perguntas
    this.competencias.forEach(competencia => {
      competencia.perguntasIds.forEach(perguntaId => {
        const perguntaTexto = this.questionMap[perguntaId] || `Pergunta ${perguntaId}`;

        // Se há um avaliado específico selecionado, usar dados dele
        let mediaGeral = 0;
        let mediaPorCategoria = 0;

        if (avaliado) {
          // Buscar dados específicos do avaliado
          const mediaAvaliado = this.getMediaPorPerguntaEAvaliadoEspecifico(competencia, 'Todos', avaliado);
          if (mediaAvaliado !== null) {
            mediaGeral = mediaAvaliado;
            mediaPorCategoria = mediaAvaliado;
          }
        } else {
          // Calcular média geral da pergunta (todas as categorias)
          const respostasGerais = this.getRespostasParaPerguntaEGrupo(perguntaId, 'Todos');
          mediaGeral = respostasGerais.length > 0 ?
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

          mediaPorCategoria = contadorCategorias > 0 ? somaPorCategoria / contadorCategorias : 0;
        }

        // Só adicionar se tiver dados válidos
        if (mediaGeral > 0 && !isNaN(mediaGeral)) {
          items.push({
            classificacao: 0, // Será definido depois da ordenação
            comportamento: perguntaTexto,
            pontuacaoMediaAvaliado: mediaGeral,
            pontuacaoMediaSemAutoavaliacao: mediaPorCategoria,
            perguntaId: perguntaId,
            competenciaId: competencia.id
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

    // Usar o avaliado selecionado se não foi passado como parâmetro
    const avaliado = avaliadoSelecionado || this.selectedAvaliado;

    // Percorrer todas as competências e suas perguntas
    this.competencias.forEach(competencia => {
      competencia.perguntasIds.forEach(perguntaId => {
        const perguntaTexto = this.questionMap[perguntaId] || `Pergunta ${perguntaId}`;

        // Se há um avaliado específico selecionado, usar dados dele
        let mediaGeral = 0;
        let mediaPorCategoria = 0;

        if (avaliado) {
          // Buscar dados específicos do avaliado
          const mediaAvaliado = this.getMediaPorPerguntaEAvaliadoEspecifico(competencia, 'Todos', avaliado);
          if (mediaAvaliado !== null) {
            mediaGeral = mediaAvaliado;
            mediaPorCategoria = mediaAvaliado;
          }
        } else {
          // Calcular média geral da pergunta (todas as categorias)
          const respostasGerais = this.getRespostasParaPerguntaEGrupo(perguntaId, 'Todos');
          mediaGeral = respostasGerais.length > 0 ?
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

          mediaPorCategoria = contadorCategorias > 0 ? somaPorCategoria / contadorCategorias : 0;
        }

        // Só adicionar se tiver dados válidos
        if (mediaGeral > 0 && !isNaN(mediaGeral)) {
          items.push({
            classificacao: 0, // Será definido depois da ordenação
            comportamento: perguntaTexto,
            pontuacaoMediaAvaliado: mediaGeral,
            pontuacaoMediaSemAutoavaliacao: mediaPorCategoria,
            perguntaId: perguntaId,
            competenciaId: competencia.id
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
  private getMediaPorPerguntaEAvaliadoEspecifico(competencia: Competencia, grupo: string, avaliadoSelecionado: string): number | null {
    const perguntasIds = competencia.perguntasIds;
    let soma = 0;
    let count = 0;

    perguntasIds.forEach(perguntaId => {
      const respostasGrupo = this.dataSource.filter(row => {
        const grupoMapeado = this.mapCategoriaToGrupo(row['categoria']);
        const avaliado = row['avaliado'];
        return grupoMapeado === grupo && avaliado === avaliadoSelecionado;
      });

      respostasGrupo.forEach(row => {
        const valor = parseNumeric(row[perguntaId]);
        if (valor !== null) {
          soma += valor;
          count++;
        }
      });
    });

    return count > 0 ? soma / count : null;
  }

  // Método para obter lista de avaliados disponíveis (apenas participantes tipo 'avaliado')
  getAvaliadosDisponiveis(): string[] {
    const avaliados = new Set<string>();

    this.dataSource.forEach(row => {
      const tipo = (row['tipo'] || '').toLowerCase();
      const avaliado = row['avaliado'];
      // Incluir apenas avaliados (pessoas sendo avaliadas), não avaliadores
      if (tipo === 'avaliado' && avaliado && avaliado.trim()) {
        avaliados.add(avaliado.trim());
      }
    });

    return Array.from(avaliados).sort();
  }

  // Removido: funções relacionadas a características ADEO

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

    this.snackBar.open(this.t('Dados de Destaques enviados para o console.'), this.t('Fechar'), { duration: 3000 });
  }

  getPerguntasDataSource(perguntasIds: string[]): { id: string }[] {
    if (!perguntasIds) return [];
    return perguntasIds.map(id => ({ id }));
  }

  // Adiciona método para atualizar template existente
  async atualizarTemplateNoFirebase() {
    if (!this.selectedTemplateId.value) {
      this.snackBar.open(this.t('Selecione um template para editar.'), this.t('Fechar'), { duration: 3000 });
      return;
    }
    // Usa o nome do campo ou, se vazio, o nome do template já salvo
    const nomeTemplate = this.nomeTemplateControl.value
      || this.savedTemplates.find(t => t.id === this.selectedTemplateId.value)?.name
      || '';
    if (!nomeTemplate) {
      this.snackBar.open(this.t('Por favor, dê um nome ao template.'), this.t('Fechar'), { duration: 3000 });
      return;
    }
    const templateRef = doc(this.firestore, 'reportTemplates', this.selectedTemplateId.value);
    // Sanitizar undefined antes de salvar no Firestore (JSON.parse/stringify remove undefined)
    const sanitize = (val: any) => JSON.parse(JSON.stringify(val ?? []));
    const templateData = {
      nome: nomeTemplate,
      configuracao: sanitize(this.relatorioConfiguracao),
      competencias: sanitize(this.competencias),
      atualizadoEm: new Date()
    };
    try {
      await setDoc(templateRef, templateData, { merge: true });
      this.snackBar.open(this.t('Template atualizado com sucesso!'), this.t('Fechar'), { duration: 3000 });
      this.carregarTemplatesSalvos();
    } catch (e) {
      console.error('Erro ao atualizar template: ', e);
      this.snackBar.open(this.t('Ocorreu um erro ao atualizar o template.'), this.t('Fechar'), { duration: 3000 });
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

  // =============================================
  // MÉTODOS PARA GERENCIAMENTO DE CLIENTES E GRUPOS DE COMPETÊNCIAS
  // =============================================

  async loadClients(): Promise<void> {
    try {
      const userRole = await this.authService.getCurrentUserRole();
      const clientId = await this.authService.getCurrentClientId();

      const clientsCollection = collection(this.firestore, 'clients');
      let clientsSnapshot;

      if (userRole === 'admin_client' && clientId) {
        // Admin de cliente específico - só carrega seu cliente
        clientsSnapshot = await getDocs(
          query(clientsCollection, where('__name__', '==', clientId))
        );
        // Se for admin_client, já seleciona automaticamente o cliente
        this.selectedClientId = clientId;
        this.clientControl.setValue(clientId);
        await this.loadCompetencyGroups(clientId);
      } else if (userRole === 'admin_master') {
        // Admin master - carrega todos os clientes
        clientsSnapshot = await getDocs(clientsCollection);
      } else {
        console.warn('Usuário não tem permissão para acessar clientes.');
        this.clients = [];
        return;
      }

      this.clients = clientsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['companyName'] || 'Cliente sem nome',
      }));

    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open(this.t('Erro ao carregar clientes.'), this.t('Fechar'), {
        duration: 3000,
      });
    }
  }

  async onClientChange(): Promise<void> {
    this.selectedClientId = this.clientControl.value;
    if (this.selectedClientId) {
      await this.loadCompetencyGroups(this.selectedClientId);
      this.competencyGroupControl.reset();
      this.cdr.detectChanges();
    }
  }

  async loadCompetencyGroups(clientId: string): Promise<void> {
    try {
      const groupsCollection = collection(this.firestore, 'competencyGroups');
      const groupsSnapshot = await getDocs(
        query(groupsCollection, where('clientId', '==', clientId))
      );

      this.competencyGroups = groupsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

    } catch (error) {
      console.error('Erro ao carregar grupos de competências:', error);
      this.snackBar.open(this.t('Erro ao carregar grupos de competências.'), this.t('Fechar'), {
        duration: 3000,
      });
    }
  }

  async saveCompetencyGroup(): Promise<void> {
    if (!this.selectedClientId) {
      this.snackBar.open(this.t('Selecione um cliente primeiro.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    if (!this.groupNameControl.value) {
      this.snackBar.open(this.t('Digite um nome para o grupo de competências.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    if (this.competencias.length === 0) {
      this.snackBar.open(this.t('Adicione pelo menos uma competência antes de salvar o grupo.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    try {
      const groupData = {
        name: this.groupNameControl.value,
        clientId: this.selectedClientId,
        competencias: this.competencias,
        createdAt: new Date(),
        assessmentId: this.selectedAssessmentId
      };

      const docRef = await addDoc(collection(this.firestore, 'competencyGroups'), groupData);

      this.snackBar.open(this.t('Grupo salvo com sucesso!'), this.t('Fechar'), { duration: 3000 });
      this.groupNameControl.reset();

      // Atualizar lista de grupos
      await this.loadCompetencyGroups(this.selectedClientId);

    } catch (error) {
      console.error('Erro ao salvar grupo de competências:', error);
      this.snackBar.open(this.t('Erro ao salvar grupo de competências.'), this.t('Fechar'), { duration: 3000 });
    }
  }

    async loadCompetencyGroup(): Promise<void> {
    const selectedGroupId = this.competencyGroupControl.value;
    if (!selectedGroupId) return;

    try {
      const groupDoc = await getDoc(doc(this.firestore, 'competencyGroups', selectedGroupId));

      if (groupDoc.exists()) {
        const groupData = groupDoc.data();

        // Carregar competências do grupo
        this.competencias = groupData['competencias'] || [];

        // Carregar perguntas custom por competência se existirem
        if (groupData['customQuestionsByCompetency'] && typeof groupData['customQuestionsByCompetency'] === 'object') {
          this.customQuestionsByCompetency = { ...groupData['customQuestionsByCompetency'] };
          console.log('✅ Perguntas custom carregadas do grupo:', Object.keys(this.customQuestionsByCompetency).length, 'competências');
        } else {
          this.customQuestionsByCompetency = {};
        }

        // Se o grupo tem assessmentId associado, selecionar a avaliação
        if (groupData['assessmentId']) {
          this.selectedAssessmentId = groupData['assessmentId'];
          this.assessmentControl.setValue(groupData['assessmentId']);
          await this.onAssessmentChange();
        }

        this.snackBar.open(this.t('Grupo carregado com sucesso!'), this.t('Fechar'), { duration: 3000 });
        this.atualizarPerguntasBloqueadas();
        this.cdr.detectChanges();

      } else {
        this.snackBar.open(this.t('Grupo não encontrado.'), this.t('Fechar'), { duration: 3000 });
      }

    } catch (error) {
      console.error('Erro ao carregar grupo de competências:', error);
      this.snackBar.open(this.t('Erro ao carregar grupo de competências.'), this.t('Fechar'), { duration: 3000 });
    }
  }

  navigateToCompetencies(): void {
    const extras = this.selectedAssessmentId
      ? { queryParams: { assessmentId: this.selectedAssessmentId } }
      : {};
    this.router.navigate(['/competencies'], extras);
  }

  goToTab(index: number): void {
    this.selectedTabIndex = index;
    this.cdr.detectChanges();
  }

  isCompetenciaAtiva(id: string): boolean {
    return this.competencias.some(c => c.id === id);
  }

  toggleCompetencia(comp: Competencia): void {
    if (this.isCompetenciaAtiva(comp.id)) {
      this.competencias = this.competencias.filter(c => c.id !== comp.id);
    } else {
      this.competencias = [...this.competencias, comp];
    }
    this.invalidateCache('secao-');
    this.cdr.detectChanges();
  }

  selectAllCompetencias(): void {
    this.competencias = [...this.allCompetencies];
    this.invalidateCache('secao-');
    this.cdr.detectChanges();
  }

  deselectAllCompetencias(): void {
    this.competencias = [];
    this.invalidateCache('secao-');
    this.cdr.detectChanges();
  }

  async loadAllAvailableGroups(): Promise<void> {
    if (this.allAvailableGroups.length > 0) return; // já carregado
    this.importGroupLoading = true;
    this.cdr.detectChanges();
    try {
      const snap = await getDocs(collection(this.firestore, 'competencyGroups'));
      // Monta mapa de assessmentId → nome para exibição
      const assessmentNames: { [id: string]: string } = {};
      this.assessments.forEach(a => { assessmentNames[a.id] = a.name; });

      this.allAvailableGroups = snap.docs
        .map(d => {
          const data = d.data();
          const competencias: any[] = Array.isArray(data['competencias']) ? data['competencias'] : [];
          return {
            id: d.id,
            name: data['name'] || 'Grupo sem nome',
            assessmentName: assessmentNames[data['assessmentId']] || data['assessmentId'] || '—',
            clientName: data['clientName'] || data['clientId'] || '—',
            competencias
          };
        })
        .filter(g => g.competencias.length > 0); // só grupos com competências
    } catch (e) {
      console.error('Erro ao carregar grupos disponíveis:', e);
    }
    this.importGroupLoading = false;
    this.cdr.detectChanges();
  }

  getImportGroupHint(): string {
    const group = this.allAvailableGroups.find(g => g.id === this.importGroupControl.value);
    if (!group) return '';
    const n = group.competencias.length;
    return `${n} competência${n !== 1 ? 's' : ''} neste grupo — ${group.assessmentName}`;
  }

  importCompetenciasFromGroup(): void {
    const groupId = this.importGroupControl.value;
    if (!groupId) return;
    const group = this.allAvailableGroups.find(g => g.id === groupId);
    if (!group) return;

    let added = 0;
    group.competencias.forEach((c: any) => {
      const compId = c.id || `${group.id}_${c.nome || c.name}`;
      const jaExiste = this.allCompetencies.some(ac => ac.id === compId);
      if (!jaExiste) {
        const comp: Competencia = {
          id: compId,
          nome: c.nome || c.name || 'Competência sem nome',
          descricao: c.descricao || c.description || '',
          perguntasIds: c.perguntasIds || c.questionIds || []
        };
        this.allCompetencies = [...this.allCompetencies, comp];
        this.competencias = [...this.competencias, comp];
        added++;
      }
    });

    this.importGroupControl.setValue('');
    this.invalidateCache('secao-');
    this.snackBar.open(
      added > 0
        ? `${added} competência${added !== 1 ? 's' : ''} importada${added !== 1 ? 's' : ''} de "${group.name}"`
        : 'Todas as competências desse grupo já estão na lista.',
      'Fechar',
      { duration: 3500 }
    );
    this.cdr.detectChanges();
  }

  // Métodos auxiliares para simplificar expressões no template
  getClientName(): string {
    const client = this.clients.find(c => c.id === this.selectedClientId);
    return client ? client.name : '';
  }

  getCompetenciaText(): string {
    const count = this.competencias.length;
    return `${count} competência${count !== 1 ? 's' : ''} ativa${count !== 1 ? 's' : ''}`;
  }

  getGrupoText(): string {
    const count = this.competencyGroups.length;
    return `${count} grupo${count !== 1 ? 's' : ''} salvo${count !== 1 ? 's' : ''}`;
  }

  getQuestaoText(count: number): string {
    return `${count} questão${count !== 1 ? 'ões' : ''}`;
  }

  getSecaoText(): string {
    const count = this.getSecoesVisiveisOrdenadas().length;
    return `${count} seção${count !== 1 ? 'ões' : ''} ativa${count !== 1 ? 's' : ''}`;
  }

  getCompetenciaCountText(competenciasIds: string[]): string {
    const count = competenciasIds?.length || 0;
    return `${count} competência${count !== 1 ? 's' : ''}`;
  }

  // Métodos para verificar condições de paleta personalizada
  isPaletaPersonalizada(secaoCtrl: any, i: number): boolean {
    return secaoCtrl.get('paletaCor')?.value === 'personalizada' ||
           this.relatorioConfiguracao[i]['paletaCor'] === 'personalizada';
  }

  // Métodos para tipos de seção
  isSecaoTipo(secaoCtrl: any, tipo: string): boolean {
    return secaoCtrl.get('tipo')?.value === tipo;
  }

  // Método para aplicar template rico à seção
  // Método para obter contagem de respondentes por categoria
  getContagemRespondentesPorCategoria(): { categoria: string; quantidade: number }[] {
    const contagem: { [key: string]: number } = {};

    // Mapear categorias para nomes amigáveis
    const categoriaMap: { [key: string]: string } = {
      'Avaliado(a)': 'Avaliado(a)',
      'Gestor(es)': 'Gestor(es)',
      'Pares': 'Pares',
      'Subordinados': 'Subordinados',
      'Outros': 'Outros'
    };

    // Se não há dados carregados, retornar array vazio
    if (!this.dataSource || this.dataSource.length === 0 || !this.dataIndexes.participantsByCategory) {
      return [];
    }

    // Contar participantes por categoria que responderam (têm respostas)
    this.dataIndexes.participantsByCategory.forEach((indices, grupo) => {
      let quantidade = 0;
      indices.forEach(index => {
        const participant = this.dataSource[index];
        if (participant) {
          // Verificar se o participante tem pelo menos uma resposta válida
          // Verificar nas colunas dinâmicas se disponíveis, senão verificar qualquer propriedade numérica
          let temResposta = false;

          if (this.dynamicColumns && this.dynamicColumns.length > 0) {
            temResposta = this.dynamicColumns.some(col => {
              const valor = participant[col];
              return valor !== undefined && valor !== null && valor !== '' && !isNaN(Number(valor));
            });
          } else {
            // Se não há colunas dinâmicas, verificar propriedades numéricas no objeto
            temResposta = Object.keys(participant).some(key => {
              if (key === 'categoria' || key === 'avaliado' || key === 'data' || key === 'dataAvaliacao' || key === 'participante' || key === 'id') {
                return false;
              }
              const valor = participant[key];
              return valor !== undefined && valor !== null && valor !== '' && !isNaN(Number(valor));
            });
          }

          if (temResposta) {
            quantidade++;
          }
        }
      });

      if (quantidade > 0) {
        const categoriaNome = categoriaMap[grupo] || grupo;
        contagem[categoriaNome] = quantidade;
      }
    });

    // Retornar como array ordenado
    return Object.keys(contagem)
      .map(categoria => ({ categoria, quantidade: contagem[categoria] }))
      .sort((a, b) => {
        // Ordenar: Avaliado primeiro, depois Gestor, Pares, Subordinados, Outros
        const ordem: { [key: string]: number } = {
          'Avaliado(a)': 1,
          'Gestor(es)': 2,
          'Pares': 3,
          'Subordinados': 4,
          'Outros': 5
        };
        return (ordem[a.categoria] || 99) - (ordem[b.categoria] || 99);
      });
  }

  // Método para substituir variáveis dinâmicas na capa
  safeHtml(html: string | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html || '');
  }

  getCapaComDadosDinamicos(textoOriginal: string | undefined): string {
    if (!textoOriginal) return '';
    const nomeAvaliado = this.selectedAvaliadoName || '';
    const dataRelatorio = this.today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return textoOriginal
      .replace(/\$%NOME_AVALIADO\$%/g, nomeAvaliado)
      .replace(/\$%DATA_RELATORIO\$%/g, dataRelatorio);
  }

  _getCapaComDadosDinamicos_UNUSED(textoOriginal: string | undefined): string {
    if (!textoOriginal) {
      return '';
    }

    // Logar o conteúdo recebido com mais detalhes
    console.log('🔄 PROCESSANDO - Conteúdo recebido (primeiros 1000 chars):', textoOriginal.substring(0, 1000));
    console.log('🔄 PROCESSANDO - Tipo do conteúdo:', typeof textoOriginal);
    console.log('🔄 PROCESSANDO - Tamanho total:', textoOriginal.length);
    console.log('🔄 PROCESSANDO - Contém HTML:', textoOriginal.includes('<div') || textoOriginal.includes('<h3'));
    console.log('🔄 PROCESSANDO - Contém Markdown:', textoOriginal.includes('##') || textoOriginal.includes('**'));
    console.log('🔄 PROCESSANDO - Contém HTML entities:', textoOriginal.includes('&nbsp;') || textoOriginal.includes('&amp;') || textoOriginal.includes('&lt;') || textoOriginal.includes('&gt;'));

    // Verificar se o texto contém a seção de categorias de forma mais robusta
    const textoLower = textoOriginal.toLowerCase();
    const temRespondentes = textoLower.includes('respondentes');
    const temPorCategoria = textoLower.includes('por categoria');
    const temRespondentesPorCategoria = textoLower.includes('respondentes por categoria');
    console.log('🔄 PROCESSANDO - Contém "respondentes":', temRespondentes);
    console.log('🔄 PROCESSANDO - Contém "por categoria":', temPorCategoria);
    console.log('🔄 PROCESSANDO - Contém "respondentes por categoria":', temRespondentesPorCategoria);

    // Verificar estrutura HTML específica
    const temH3Respondentes = /<h3[^>]*>[\s\S]*?[Rr]espondentes[\s\S]*?por[\s\S]*?[Cc]ategoria[\s\S]*?<\/h3>/i.test(textoOriginal);
    const temDivRespondentes = /<div[^>]*>[\s\S]*?[Rr]espondentes[\s\S]*?por[\s\S]*?[Cc]ategoria[\s\S]*?<\/div>/i.test(textoOriginal);
    console.log('🔄 PROCESSANDO - Tem H3 com "Respondentes por Categoria":', temH3Respondentes);
    console.log('🔄 PROCESSANDO - Tem DIV com "Respondentes por Categoria":', temDivRespondentes);

    // Obter informações dinâmicas
    const nomeAvaliado = this.selectedAvaliadoName || 'Não informado';
    const dataRelatorio = this.today.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const contagemPorCategoria = this.getContagemRespondentesPorCategoria();

    // Criar HTML para contagem por categoria (uma abaixo da outra)
    let contagemHtml = '';
    if (contagemPorCategoria.length > 0) {
      contagemHtml = contagemPorCategoria
        .map(item => `<div style="margin: 8px 0; padding: 10px 20px; background: #e3f2fd; border-radius: 8px; font-size: 14px; text-align: left;"><strong>${item.categoria}:</strong> ${item.quantidade}</div>`)
        .join('');
    } else {
      contagemHtml = '<div style="color: #999; font-size: 14px; padding: 10px;">Nenhum respondente encontrado</div>';
    }

    // Verificar se o texto já contém a estrutura de categorias (case-insensitive e mais robusto)
    // Tentar múltiplas formas de detectar a seção
    const temEstruturaCategorias1 = /respondentes\s+por\s+categoria/i.test(textoOriginal);
    const temEstruturaCategorias2 = /respondentes.*?por.*?categoria/i.test(textoOriginal);
    const temEstruturaCategorias3 = textoLower.includes('respondentes') && textoLower.includes('por') && textoLower.includes('categoria');
    const temEstruturaCategorias = temEstruturaCategorias1 || temEstruturaCategorias2 || temEstruturaCategorias3;

    const temFlexWrap = /flex-wrap/i.test(textoOriginal);
    const temFlexColumn = /flex-direction:\s*column/i.test(textoOriginal);
    const temSpanInline = /display:\s*inline-block/i.test(textoOriginal);

    console.log('🔍 Análise da seção "Respondentes por Categoria":');
    console.log('  - Encontrada (regex 1):', temEstruturaCategorias1);
    console.log('  - Encontrada (regex 2):', temEstruturaCategorias2);
    console.log('  - Encontrada (includes):', temEstruturaCategorias3);
    console.log('  - Encontrada (final):', temEstruturaCategorias);
    console.log('  - Tem flex-wrap:', temFlexWrap);
    console.log('  - Tem flex-direction: column:', temFlexColumn);
    console.log('  - Tem display: inline-block:', temSpanInline);

    // Logar trecho específico onde deveria estar a seção
    const indiceCategoria = textoOriginal.toLowerCase().indexOf('respondentes');
    if (indiceCategoria >= 0) {
      const trechoCategoria = textoOriginal.substring(Math.max(0, indiceCategoria - 50), Math.min(textoOriginal.length, indiceCategoria + 500));
      console.log('  - 📋 Trecho HTML encontrado:', trechoCategoria);
    }

    // Substituir variáveis dinâmicas no texto
    let textoProcessado = textoOriginal
      .replace(/\$%NOME_AVALIADO\$%/g, nomeAvaliado)
      .replace(/\$%DATA_RELATORIO\$%/g, dataRelatorio)
      .replace(/\$%CONTAGEM_CATEGORIAS\$%/g, contagemHtml);

    // Se o texto não contém variáveis, mas é a capa padrão, garantir que as informações dinâmicas estejam atualizadas
    if (!textoOriginal.includes('$%') && /relatório\s+feedback\s+360/i.test(textoOriginal)) {
      // Atualizar nome do avaliado se estiver presente no template
      textoProcessado = textoProcessado.replace(
        /<h2[^>]*>.*?<\/h2>/gi,
        `<h2 style="margin: 0; font-size: 28px; font-weight: 600;">${nomeAvaliado}</h2>`
      );

      // Atualizar data do relatório se estiver presente
      textoProcessado = textoProcessado.replace(
        /Data\s+do\s+Relatório:\s*[\d\/]+/gi,
        `Data do Relatório: ${dataRelatorio}`
      );

      // Verificar se já tem a seção de respondentes por categoria (case-insensitive)
      if (temEstruturaCategorias) {
        console.log('  - 🔄 Substituindo seção existente...');

        // Estrutura nova com layout vertical
        const estruturaNova = `<div style="margin-top: 30px; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
              <h3 style="color: #1976d2; font-size: 20px; margin-bottom: 15px;">Respondentes por Categoria</h3>
              <div style="display: flex; flex-direction: column; align-items: center; gap: 0;">
                ${contagemHtml}
              </div>
            </div>`;

        // Regex mais robustos e flexíveis para encontrar a seção
        // Padrão 1: Seção completa com h3 e div container
        const regexSecaoCompleta = /<div[^>]*>[\s\S]*?<h3[^>]*>[\s\S]*?Respondentes\s+por\s+Categoria[\s\S]*?<\/h3>[\s\S]*?<div[^>]*style="[^"]*"[\s\S]*?>[\s\S]*?<\/div>[\s\S]*?<\/div>/gi;

        // Padrão 2: Seção com flex-wrap ou justify-content
        const regexSecaoHorizontal = /<div[^>]*style="[^"]*display:\s*flex[^"]*(?:flex-wrap|justify-content)[^"]*"[^>]*>[\s\S]*?Respondentes\s+por\s+Categoria[\s\S]*?<\/div>[\s\S]*?<\/div>/gi;

        // Padrão 3: Seção genérica com qualquer estrutura
        const regexSecaoGenerica = /<div[^>]*>[\s\S]*?Respondentes\s+por\s+Categoria[\s\S]*?<\/div>[\s\S]*?<\/div>/gi;

        let substituido = false;

        // Tentar substituir usando regex mais específicos primeiro
        if (regexSecaoCompleta.test(textoProcessado)) {
          console.log('    ✅ Padrão 1 (seção completa)');
          textoProcessado = textoProcessado.replace(regexSecaoCompleta, estruturaNova);
          substituido = true;
        } else if (regexSecaoHorizontal.test(textoProcessado)) {
          console.log('    ✅ Padrão 2 (seção horizontal)');
          textoProcessado = textoProcessado.replace(regexSecaoHorizontal, estruturaNova);
          substituido = true;
        } else if (regexSecaoGenerica.test(textoProcessado)) {
          console.log('    ✅ Padrão 3 (seção genérica)');
          textoProcessado = textoProcessado.replace(regexSecaoGenerica, estruturaNova);
          substituido = true;
        }

        if (!substituido) {
          console.log('    ⚠️ Nenhum regex fez match, tentando abordagem alternativa...');

          // Abordagem alternativa: encontrar o índice da seção e substituir manualmente
          const regexTitulo = /<h3[^>]*>[\s\S]*?Respondentes\s+por\s+Categoria[\s\S]*?<\/h3>/gi;
          const matchTitulo = regexTitulo.exec(textoProcessado);

          if (matchTitulo) {
            console.log('    📍 Título encontrado na posição:', matchTitulo.index);
            const inicioTitulo = matchTitulo.index;

            // Encontrar o início do div pai que contém o h3
            let inicioDiv = inicioTitulo;
            while (inicioDiv > 0 && textoProcessado.substring(inicioDiv - 5, inicioDiv) !== '<div') {
              inicioDiv--;
            }
            if (inicioDiv < inicioTitulo - 200) inicioDiv = inicioTitulo - 50; // Limite de busca

            // Encontrar o fim do div pai (procurar por </div> correspondente)
            let fimDiv = inicioTitulo + matchTitulo[0].length;
            let nivelDiv = 1;
            let tentativas = 0;
            while (nivelDiv > 0 && tentativas < 1000 && fimDiv < textoProcessado.length) {
              if (textoProcessado.substring(fimDiv, fimDiv + 6) === '</div>') {
                nivelDiv--;
                fimDiv += 6;
              } else if (textoProcessado.substring(fimDiv, fimDiv + 4) === '<div') {
                nivelDiv++;
                fimDiv += 4;
              } else {
                fimDiv++;
              }
              tentativas++;
            }

            if (nivelDiv === 0 && fimDiv > inicioTitulo) {
              console.log('    ✅ Div completo encontrado e substituído');
              textoProcessado = textoProcessado.substring(0, inicioDiv) + estruturaNova + textoProcessado.substring(fimDiv);
              substituido = true;
            }
          }

          // Se ainda não foi substituído, tentar substituir apenas os estilos inline-block
          if (!substituido) {
            console.log('    ⚠️ Substituindo estilos inline-block...');
            // Substituir spans inline-block por divs verticais
            textoProcessado = textoProcessado.replace(
              /<span[^>]*style="[^"]*display:\s*inline-block[^"]*"[^>]*>/gi,
              '<div style="margin: 8px 0; padding: 10px 20px; background: #e3f2fd; border-radius: 8px; font-size: 14px; text-align: left;">'
            );
            textoProcessado = textoProcessado.replace(/<\/span>/gi, '</div>');

            // Atualizar container para flex-direction: column
            textoProcessado = textoProcessado.replace(
              /(display:\s*flex[^;]*)(?:flex-wrap|justify-content)[^;]*;?/gi,
              'display: flex; flex-direction: column; align-items: center; gap: 0;'
            );

            // Substituir todo o conteúdo dentro do container de categorias pela nova contagemHtml
            const regexContainerCategorias = /(<div[^>]*style="[^"]*display:\s*flex[^"]*"[^>]*>)([\s\S]*?)(<\/div>)/gi;
            textoProcessado = textoProcessado.replace(regexContainerCategorias, (match, inicio, conteudo, fim) => {
              if (/respondentes\s+por\s+categoria/i.test(match)) {
                return inicio + contagemHtml + fim;
              }
              return match;
            });
          }
        }
      } else {
        console.log('  - ⚠️ Seção não encontrada, adicionando nova seção...');
        // Adicionar informações dinâmicas ao final se não estiverem presentes
        textoProcessado = textoProcessado.replace(
          /<\/div>\s*<\/div>\s*$/,
          `<div style="margin-top: 30px; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <h3 style="color: #1976d2; font-size: 20px; margin-bottom: 15px;">Respondentes por Categoria</h3>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0;">
              ${contagemHtml}
            </div>
          </div>
          </div>`
        );
      }

      // Verificar resultado final
      const temFlexColumnFinal = /flex-direction:\s*column/i.test(textoProcessado);
      const temSpanFinal = /display:\s*inline-block/i.test(textoProcessado);
      const temFlexWrapFinal = /flex-wrap/i.test(textoProcessado);
      console.log('  - Resultado final:');
      console.log('    - flex-direction: column:', temFlexColumnFinal);
      console.log('    - display: inline-block:', temSpanFinal);
      console.log('    - flex-wrap:', temFlexWrapFinal);

      // Logar trecho final da seção de categorias para verificação
      const indiceCategoriaFinal = textoProcessado.toLowerCase().indexOf('respondentes');
      if (indiceCategoriaFinal >= 0) {
        const trechoCategoriaFinal = textoProcessado.substring(Math.max(0, indiceCategoriaFinal - 50), Math.min(textoProcessado.length, indiceCategoriaFinal + 500));
        console.log('  - 📋 Trecho final:', trechoCategoriaFinal);
      }
    }

    return textoProcessado;
  }

  aplicarTemplateRico(secaoIndex: number, tipo: 'capa' | 'introducao'): void {
    const secao = this.relatorioConfiguracao[secaoIndex];
    if (!secao) {
      return;
    }

    if (tipo === 'capa') {
      // Obter informações dinâmicas
      const nomeAvaliado = this.selectedAvaliadoName || 'Não informado';
      const dataRelatorio = this.today.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const contagemPorCategoria = this.getContagemRespondentesPorCategoria();

      // Criar HTML para contagem por categoria (uma abaixo da outra)
      let contagemHtml = '';
      if (contagemPorCategoria.length > 0) {
        contagemHtml = contagemPorCategoria
          .map(item => `<div style="margin: 8px 0; padding: 10px 20px; background: #e3f2fd; border-radius: 8px; font-size: 14px; text-align: left;"><strong>${item.categoria}:</strong> ${item.quantidade}</div>`)
          .join('');
      } else {
        contagemHtml = '<div style="color: #999; font-size: 14px; padding: 10px;">Nenhum respondente encontrado</div>';
      }

      secao.texto = `
        <div style="text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 15px; box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
          <h1 style="color: #1976d2; font-size: 36px; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.1);">
            Relatório Feedback 360°
          </h1>
          <p style="font-size: 20px; color: #666; margin-bottom: 30px; font-weight: 300;">
            Avaliação de Competências e Desenvolvimento Profissional
          </p>
          <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px 50px; border-radius: 15px; box-shadow: 0 6px 20px rgba(0,0,0,0.2); margin: 20px 0;">
            <h2 style="margin: 0; font-size: 28px; font-weight: 600;">
              ${nomeAvaliado}
            </h2>
            <p style="margin: 15px 0 0 0; opacity: 0.9; font-size: 18px;">
              Feedback 360° Profissional
            </p>
          </div>
          <div style="margin-top: 30px; display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;">
            <div style="background: white; padding: 15px 25px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
              <strong style="color: #1976d2;">Data do Relatório:</strong> ${dataRelatorio}
            </div>
            <div style="background: white; padding: 15px 25px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
              <strong style="color: #1976d2;">Tipo:</strong> Avaliação 360°
            </div>
          </div>
          <div style="margin-top: 30px; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <h3 style="color: #1976d2; font-size: 20px; margin-bottom: 15px;">Respondentes por Categoria</h3>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0;">
              ${contagemHtml}
            </div>
          </div>
        </div>
      `;
    } else if (tipo === 'introducao') {
      secao.texto = `
        <div style="max-width: 800px; margin: 0 auto;">
          <h2 style="color: #7b1fa2; border-bottom: 3px solid #e1bee7; padding-bottom: 15px; margin-bottom: 25px; font-size: 28px;">
            Introdução ao Relatório
          </h2>

          <p style="font-size: 18px; line-height: 1.8; color: #333; margin-bottom: 25px; text-align: justify;">
            Este relatório apresenta os resultados da avaliação 360° realizada com o objetivo de identificar pontos fortes
            e áreas de desenvolvimento profissional. A metodologia 360° permite uma visão abrangente das competências
            através de múltiplas perspectivas.
          </p>

          <div style="background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); padding: 25px; border-radius: 12px; margin: 30px 0; border-left: 5px solid #9c27b0; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <h3 style="margin: 0 0 20px 0; color: #7b1fa2; font-size: 22px; display: flex; align-items: center;">
              <span style="background: #9c27b0; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 16px;">🎯</span>
              Objetivos da Avaliação
            </h3>
            <ul style="margin: 0; padding-left: 25px; font-size: 16px; line-height: 1.8;">
              <li style="margin-bottom: 10px;"><strong>Identificar competências desenvolvidas</strong> e pontos de excelência</li>
              <li style="margin-bottom: 10px;"><strong>Reconhecer pontos fortes</strong> para potencializar resultados</li>
              <li style="margin-bottom: 10px;"><strong>Mapear oportunidades de melhoria</strong> para desenvolvimento contínuo</li>
              <li style="margin-bottom: 10px;"><strong>Fornecer base sólida</strong> para planejamento de carreira</li>
            </ul>
          </div>

          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #4caf50;">
            <h4 style="margin: 0 0 15px 0; color: #2e7d32; font-size: 18px;">
              <mat-icon style="vertical-align: middle; margin-right: 8px; color: #4caf50;">info</mat-icon>
              Metodologia
            </h4>
            <p style="margin: 0; color: #2e7d32; font-size: 16px;">
              A avaliação foi conduzida através de questionários estruturados, aplicados a diferentes grupos de
              stakeholders, garantindo uma visão holística e imparcial das competências avaliadas.
            </p>
          </div>
        </div>
      `;
    }

    // Atualizar o formulário
    this.atualizarFormArrayComConfiguracao();
    this.cdr.detectChanges();
  }

  // Métodos para obter valores seguros
  getSecaoTipoValue(secaoCtrl: any): string {
    return secaoCtrl.get('tipo')?.value || '';
  }

  getPaletaCorValue(secaoCtrl: any): string {
    return secaoCtrl.get('paletaCor')?.value || '';
  }

  getCompetenciasIdsValue(secaoCtrl: any): string[] {
    return secaoCtrl.get('competenciasIds')?.value || [];
  }

  // Método para verificar se tem competências selecionadas
  hasCompetenciasSelecionadas(secaoCtrl: any): boolean {
    const competenciasIds = this.getCompetenciasIdsValue(secaoCtrl);
    return competenciasIds.length > 0;
  }

  // =============================================
  // MÉTODOS PARA FILTRAGEM DE TIPOS DE PERGUNTAS
  // =============================================

  applyQuestionFilter(): void {
    if (!this.allQuestions.length) {
      this.filteredQuestions = [];
      return;
    }

    const includeOpen = !!this.includeOpenQuestions.value;
    this.filteredQuestions = filterQuestionsByType(this.allQuestions as any, includeOpen) as any;

    console.log(`🔍 Filtro aplicado - Incluir abertas: ${includeOpen}`);
    console.log(`📊 Perguntas totais: ${this.allQuestions.length}`);
    console.log(`📊 Perguntas filtradas: ${this.filteredQuestions.length}`);
    console.log('📊 Perguntas por tipo:', this.getQuestionTypeStats());
  }

  getQuestionTypeStats(): any { return getQuestionTypeStats(this.allQuestions as any); }

  onQuestionFilterChange(): void {
    this.applyQuestionFilter();

    // Atualizar dynamicColumns com as perguntas filtradas
    this.dynamicColumns = this.filteredQuestions.map(q => q.id);

    // Forçar detecção de mudanças
    this.cdr.detectChanges();

    console.log('📊 Filtro alterado - Perguntas disponíveis:', this.dynamicColumns.length);
  }

  getQuestionTypeLabel(type: string): string {
    const typeLabels: { [key: string]: string } = {
      'rating': 'Escala/Rating',
      'dropdown': 'Lista Suspensa',
      'radiogroup': 'Múltipla Escolha',
      'matrix': 'Matriz',
      'checkbox': 'Caixas de Seleção',
      'boolean': 'Sim/Não',
      'ranking': 'Ranking',
      'text': 'Texto Livre',
      'comment': 'Comentário',
      'multipletext': 'Múltiplos Textos',
      'file': 'Upload de Arquivo',
      'signaturepad': 'Assinatura',
      'question': 'Pergunta de Matriz'
    };
    return typeLabels[type] || type;
  }

  getQuestionTypeByIdSafe(questionId: string): string {
    const question = this.allQuestions.find(q => q.id === questionId);
    return question ? this.getQuestionTypeLabel(question.type) : '';
  }

  getAvailableQuestionCount(): string {
    const total = this.allQuestions.length;
    const filtered = this.filteredQuestions.length;
    const includeOpen = this.includeOpenQuestions.value;

    if (includeOpen) {
      return `${filtered} questões disponíveis (todas)`;
    } else {
      const excluded = total - filtered;
      return `${filtered} questões disponíveis (${excluded} questões abertas excluídas)`;
    }
  }

    debugTiposPerguntas(): void {
    console.group('🔍 DEBUG: Tipos de Perguntas');

    console.log('📊 Total de perguntas:', this.allQuestions.length);
    console.log('📊 Perguntas filtradas:', this.filteredQuestions.length);
    console.log('📊 Incluir abertas:', this.includeOpenQuestions.value);

    console.log('\n📈 Estatísticas por tipo:');
    const stats = this.getQuestionTypeStats();
    Object.entries(stats).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} perguntas - ${this.getQuestionTypeLabel(type)}`);
    });

    console.log('\n📝 Perguntas por tipo:');
    const grouped = this.allQuestions.reduce((acc: any, q) => {
      if (!acc[q.type]) acc[q.type] = [];
      acc[q.type].push(q);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([type, questions]: [string, any]) => {
      console.log(`\n${type} (${questions.length}):`);
      questions.forEach((q: any) => {
        const isFiltered = this.filteredQuestions.some(fq => fq.id === q.id);
        console.log(`  ${isFiltered ? '✅' : '❌'} ${q.id}: ${q.title}`);
      });
    });

    console.groupEnd();

    this.snackBar.open(this.t('Debug executado! Veja o console.'), this.t('Fechar'), { duration: 5000 });
  }

  async loadAllCompetencies(): Promise<void> {
    try {
      const seen = new Set<string>();
      const result: Competencia[] = [];

      // ─── competencyGroups filtrado pelo assessmentId atual ────────────────
      // Esta é a fonte principal: a página de Competências salva grupos em
      // `competencyGroups` com assessmentId + array `competencias` contendo
      // os perguntasIds que batem com as colunas do dataSource.
      if (this.selectedAssessmentId) {
        const groupsSnap = await getDocs(
          query(
            collection(this.firestore, 'competencyGroups'),
            where('assessmentId', '==', this.selectedAssessmentId)
          )
        );
        groupsSnap.docs.forEach(groupDoc => {
          const groupData = groupDoc.data();
          const competencias: any[] = Array.isArray(groupData['competencias']) ? groupData['competencias'] : [];
          competencias.forEach((c: any) => {
            const compId = c.id || `${groupDoc.id}_${c.nome || c.name}`;
            if (!seen.has(compId)) {
              seen.add(compId);
              result.push({
                id: compId,
                nome: c.nome || c.name || 'Competência sem nome',
                descricao: c.descricao || c.description || '',
                perguntasIds: c.perguntasIds || c.questionIds || []
              } as Competencia);
            }
          });
        });
        console.log('🎯 Grupos para esta avaliação:', groupsSnap.size, '→', result.length, 'competências');
      }

      // ─── Fallback: competencies collection (formato competency-dialog) ────
      // Se não encontrou nada via grupos, tenta a coleção individual.
      if (result.length === 0) {
        const competenciesSnap = await getDocs(collection(this.firestore, 'competencies'));
        competenciesSnap.docs.forEach(docSnap => {
          if (!seen.has(docSnap.id)) {
            seen.add(docSnap.id);
            const data = docSnap.data();
            const questions: any[] = Array.isArray(data['questions']) ? data['questions'] : [];
            const perguntasIds: string[] =
              data['perguntasIds'] ||
              data['questionIds'] ||
              questions.map((q: any) => q.id || '').filter(Boolean);

            questions.forEach((q: any) => {
              if (q.id && (q.text || q.title) && !this.questionMap[q.id]) {
                this.questionMap[q.id] = q.text || q.title;
              }
            });

            result.push({
              id: docSnap.id,
              nome: data['name'] || data['nome'] || 'Competência sem nome',
              descricao: data['description'] || data['descricao'] || '',
              perguntasIds
            } as Competencia);
          }
        });
        console.log('🎯 Fallback competencies collection:', result.length, 'competências');
      }

      this.allCompetencies = result;
      console.log('🎯 Total competências disponíveis:', this.allCompetencies.length);

      // Aplicar competências pendentes se houver
      if (this.pendingCompetencyIds.length > 0) {
        console.log('🎯 Aplicando competências pendentes:', this.pendingCompetencyIds);
        this.competencias = this.allCompetencies.filter((comp: Competencia) =>
          this.pendingCompetencyIds.includes(comp.id)
        );
        console.log('🎯 Competências aplicadas:', this.competencias);
        this.pendingCompetencyIds = [];
      } else if (this.competencias.length === 0) {
        // Auto-selecionar todas as competências da avaliação para evitar configuração manual
        this.competencias = [...this.allCompetencies];
      }
    } catch (error) {
      console.error('Erro ao carregar competências:', error);
      this.allCompetencies = [];
    }
  }

  // Método para lidar com mudança de avaliado selecionado
  onAvaliadoChange(): void {
    this.selectedAvaliado = this.avaliadoControl.value;
    console.log('Avaliado selecionado:', this.selectedAvaliado);

    // Invalidar cache relacionado a cálculos de competências
    this.invalidateCache('media-competencia');
    this.invalidateCache('tabela-competencia');

    // Forçar atualização da view para refletir mudanças
    this.cdr.detectChanges();
  }

  // Método para limpar a seleção de avaliado
  limparSelecaoAvaliado(): void {
    this.selectedAvaliado = null;
    this.avaliadoControl.setValue('');
    console.log('Seleção de avaliado limpa');

    // Forçar atualização da view
    this.cdr.detectChanges();

    this.snackBar.open(this.t('Seleção de avaliado limpa. Visualizando dados de todos os avaliados.'), this.t('Fechar'), { duration: 3000 });
  }

  // Método de debug específico para investigar dados da tabela de competência
  debugTabelaCompetencia(competencia: Competencia): void {
    console.group(`🔍 DEBUG TABELA COMPETÊNCIA: ${competencia.nome}`);

    console.log('📊 Dados básicos:', {
      competencia: competencia.nome,
      perguntasIds: competencia.perguntasIds,
      selectedAssessmentId: this.selectedAssessmentId,
      selectedAvaliado: this.selectedAvaliado,
      dataSourceLength: this.dataSource.length
    });

    if (!this.dataSource.length) {
      console.log('❌ DataSource vazio!');
      console.groupEnd();
      return;
    }

    // Mostrar estrutura dos primeiros participantes
    console.log('📋 Estrutura dos primeiros 3 participantes:');
    this.dataSource.slice(0, 3).forEach((participant, index) => {
      console.log(`  Participante ${index}:`, {
        avaliado: participant['avaliado'],
        categoria: participant['categoria'],
        categoriaMapeada: this.mapCategoriaToGrupo(participant['categoria']),
        perguntasComDados: Object.keys(participant).filter(key =>
          key !== 'data' && key !== 'categoria' && key !== 'avaliado' &&
          key !== 'dataAvaliacao' && key !== 'isTargetParticipant'
        ).slice(0, 5) // Mostrar apenas as primeiras 5 perguntas
      });
    });

    // Verificar dados específicos para a competência
    const grupos = this.getGrupos();
    console.log('🏷️ Grupos disponíveis:', grupos);

    competencia.perguntasIds.forEach(perguntaId => {
      console.group(`📝 Pergunta: ${perguntaId}`);

      // Verificar dados para cada grupo
      grupos.forEach(grupo => {
        if (this.selectedAvaliado) {
          const respostas = this.getRespostasParaPerguntaEGrupoEAvaliado(perguntaId, grupo, this.selectedAvaliado);
          console.log(`  🎯 Grupo "${grupo}" + Avaliado "${this.selectedAvaliado}": ${respostas.length} respostas - [${respostas.join(', ')}]`);
        } else {
          const respostas = this.getRespostasParaPerguntaEGrupo(perguntaId, grupo);
          console.log(`  🌐 Grupo "${grupo}" (todos): ${respostas.length} respostas - [${respostas.join(', ')}]`);
        }
      });

      console.groupEnd();
    });

    // Verificar se há dados para o avaliado selecionado
    if (this.selectedAvaliado) {
      console.group(`🎯 VERIFICAÇÃO ESPECÍFICA PARA AVALIADO: ${this.selectedAvaliado}`);

      const participantesDoAvaliado = this.dataSource.filter(p => p['avaliado'] === this.selectedAvaliado);
      console.log(`  Total de participantes com este nome: ${participantesDoAvaliado.length}`);

      if (participantesDoAvaliado.length > 0) {
        const primeiro = participantesDoAvaliado[0];
        console.log('  Primeiro participante encontrado:', {
          avaliado: primeiro['avaliado'],
          categoria: primeiro['categoria'],
          categoriaMapeada: this.mapCategoriaToGrupo(primeiro['categoria']),
          perguntasComValores: competencia.perguntasIds.map(perguntaId => ({
            perguntaId,
            valor: primeiro[perguntaId],
            valorNumerico: parseNumeric(primeiro[perguntaId])
          }))
        });
      }

      console.groupEnd();
    }

    console.groupEnd();
  }

  // Getter para tabela de competência com cache otimizado
  getTabelaCompetencia(competencia: Competencia): TabelaCompetencia | null {
    const cacheKey = `tabela-competencia-${competencia.id}-${this.selectedAssessmentId}-${this.selectedAvaliado || 'todos'}`;

    return this.getCachedCalculation(cacheKey, () => {
      console.log(`🔄 Gerando tabela para competência: ${competencia.nome} (cache: ${cacheKey})`);
      return this.gerarTabelaCompetencia(competencia);
    });
  }

  // Método de debug para verificar estrutura dos dados
  debugEstruturaDados(): void {
    console.log('🔍 DEBUG ESTRUTURA DOS DADOS');
    console.log('📊 Total de registros:', this.dataSource.length);

    if (this.dataSource.length > 0) {
      const primeiroRegistro = this.dataSource[0];
      console.log('📋 Primeiro registro completo:', primeiroRegistro);

      // Listar todas as chaves disponíveis
      const todasChaves = Object.keys(primeiroRegistro);
      console.log('🔑 Todas as chaves disponíveis:', todasChaves);

      // Filtrar chaves que parecem ser perguntas
      const chavesPerguntas = todasChaves.filter(chave =>
        chave.startsWith('pergunta') || chave.includes('Row') || chave.includes('Column')
      );
      console.log('❓ Chaves que parecem ser perguntas:', chavesPerguntas);

      // Verificar valores das primeiras perguntas
      chavesPerguntas.slice(0, 5).forEach(chave => {
        const valor = primeiroRegistro[chave];
        console.log(`  ${chave}: "${valor}" (tipo: ${typeof valor})`);
      });

      // Verificar se as perguntas da competência existem
      if (this.competencias.length > 0) {
        const primeiraComp = this.competencias[0];
        console.log('🏆 Primeira competência:', primeiraComp);
        console.log('📝 IDs das perguntas:', primeiraComp.perguntasIds);

        // Verificar se cada pergunta existe nos dados
        primeiraComp.perguntasIds.forEach(perguntaId => {
          const existe = this.dataSource.some(registro =>
            registro[perguntaId] !== undefined
          );
          console.log(`  ${perguntaId}: ${existe ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);

          if (existe) {
            const valores = this.dataSource.map(registro => registro[perguntaId]).filter(v => v !== undefined);
            console.log(`    Valores encontrados: [${valores.join(', ')}]`);
          }
        });
      }
    }
  }

  /**
   * Calcula os dados para a Janela de Johari (pontos Auto x Outros).
   */
  getJohariWindowData(secao: any): JohariWindowData {
    const competenciasSelecionadas = this.getCompetenciasSelecionadasParaSecao(secao);
    const threshold = 3.5; // linha de corte
    const palette = [
      '#5C6BC0', // A
      '#43A047', // B
      '#E53935', // C
      '#FB8C00', // D
      '#8D6E63', // E (marrom/oliva)
      '#546E7A', // F (cinza azulado)
      '#7E57C2', '#00897B', '#EF6C00', '#26A69A', '#9CCC65', '#FF7043'
    ];

    const points = [] as JohariWindowData['points'];

    // Basear o cálculo na mesma fonte do gráfico de defasagem (dataSource por pergunta)
    competenciasSelecionadas.forEach((competencia, idx) => {
      const perguntas = competencia.perguntasIds || [];
      const selfVals: number[] = [];
      const othersVals: number[] = [];

      perguntas.forEach((perguntaId: string) => {
        const dados = this.getDadosPerguntaDefasagem(perguntaId);
        if (!dados) return;
        if (dados.selfScore !== null) selfVals.push(dados.selfScore);
        if (dados.othersScore !== null) othersVals.push(dados.othersScore);
      });

      const avg = (arr: number[]) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
      const self = avg(selfVals);
      const others = avg(othersVals);

      const label = String.fromCharCode(65 + (idx % 26));
      const color = palette[idx % palette.length];
      points.push({ label, name: competencia.nome, self, others, color });
    });

    return { points, threshold };
  }

  /**
   * Calcula a média ponderada das avaliações de todos os grupos, exceto 'Autoavaliação'.
   */
  private getMediaPonderadaOutros(medias: { grupo: string; media: number | null }[]): number {
    const mediasOutros = medias.filter(m => m.grupo !== 'Autoavaliação' && m.media !== null);
    if (mediasOutros.length === 0) return 0;

    const soma = mediasOutros.reduce((acc, curr) => acc + (curr.media ?? 0), 0);
    return soma / mediasOutros.length;
  }

  /**
   * Calcula as médias para cada competência com base nos dados filtrados da avaliação.
   * Agrupa os resultados por competência e, dentro de cada uma, por grupo de avaliador.
   */
  async calcularMediasPorCompetencia(): Promise<void> {
    if (!this.selectedAssessmentId) {
      this.mediasPorCompetencia = [];
      this.prepareGapChartData(); // Chamar para limpar/atualizar
      return;
    }

    const mediasCalculadas = this.competencias.map(competencia => {
      const mediasPorGrupo = this.calcularMediasParaCompetencia(competencia);
      return {
        competenciaId: competencia.id,
        nome: competencia.nome,
        medias: mediasPorGrupo,
      };
    });

    this.mediasPorCompetencia = mediasCalculadas;
    this.prepareGapChartData(); // Chamar para limpar/atualizar
  }

  /**
   * Função auxiliar que calcula a média para uma única competência,
   * agrupando por categoria de avaliador.
   * @param competencia A competência para a qual as médias serão calculadas.
   * @returns Um array com as médias por grupo.
   */
  private calcularMediasParaCompetencia(competencia: any): { grupo: string; media: number | null }[] {
    const todosOsGrupos = ['Autoavaliação', 'Líder', 'Par', 'Liderado', 'Outros'];
    const mediasFinais = todosOsGrupos.map(grupo => {
      let soma = 0;
      let contagem = 0;

      competencia.perguntasIds.forEach((perguntaId: string) => {
        this.dataSource.forEach(linha => {
          if (linha.categoria === grupo && linha[perguntaId] !== undefined && linha[perguntaId] !== null) {
            soma += Number(linha[perguntaId]);
            contagem++;
          }
        });
      });

      return {
        grupo: grupo,
        media: contagem > 0 ? soma / contagem : null,
      };
    });

    return mediasFinais;
  }

  public prepareGapChartData(): void {
    const secaoDefasagem = this.relatorioFormGroups.find(g => g.value.tipo === 'grafico_defasagem');
    const competenciasSelecionadasIds = new Set(secaoDefasagem?.value.competenciasIds || []);

    if (competenciasSelecionadasIds.size === 0) {
      this.gapChartData = [];
      return;
    }

    const competenciasSelecionadas = this.competencias.filter(c => competenciasSelecionadasIds.has(c.id));

    // Para cada competência, criar dados para cada pergunta individual
    const dadosPorPergunta: GapChartDataItem[] = [];

    competenciasSelecionadas.forEach(comp => {
      // Buscar as perguntas desta competência
      const perguntasIds = comp.perguntasIds || [];

      perguntasIds.forEach(perguntaId => {
        const perguntaTexto = this.questionMap[perguntaId] || perguntaId;

        // Buscar dados de resposta para esta pergunta específica
        const dadosPergunta = this.getDadosPerguntaDefasagem(perguntaId);

        if (dadosPergunta) {
          dadosPorPergunta.push({
            competencyName: perguntaTexto,
            selfScore: dadosPergunta.selfScore,
            othersScore: dadosPergunta.othersScore,
            gap: dadosPergunta.gap
          });
        }
      });
    });

    this.gapChartData = dadosPorPergunta.sort((a, b) => a.competencyName.localeCompare(b.competencyName));
  }

    private getDadosPerguntaDefasagem(perguntaId: string): { selfScore: number | null; othersScore: number | null; gap: number | null } | null {
    console.log(`🔍 Buscando dados para pergunta: ${perguntaId}`);

    if (!this.dataSource || this.dataSource.length === 0) {
      console.log('❌ dataSource vazio ou nulo');
      return null;
    }

    console.log(`📊 dataSource tem ${this.dataSource.length} linhas`);

    // Coletar todas as respostas para esta pergunta específica
    const respostasSelf: number[] = [];
    const respostasOutros: number[] = [];

    this.dataSource.forEach((row, index) => {
      if (row[perguntaId] !== undefined) {
        const valor = this.parseLikertAnswer(row[perguntaId]);
        console.log(`📝 Linha ${index}: categoria=${row.categoria}, perguntaId=${perguntaId}, valor=${row[perguntaId]}, parseado=${valor}`);

        if (valor !== null) {
          if (row.categoria === 'Avaliado') {
            respostasSelf.push(valor);
            console.log(`✅ Adicionado à autoavaliação: ${valor}`);
          } else {
            respostasOutros.push(valor);
            console.log(`✅ Adicionado aos outros: ${valor}`);
          }
        }
      } else {
        console.log(`❌ Linha ${index}: perguntaId ${perguntaId} não encontrada`);
      }
    });

    console.log(`📊 Respostas coletadas - Self: ${respostasSelf.length}, Outros: ${respostasOutros.length}`);

    // Calcular médias
    const selfScore = respostasSelf.length > 0 ? respostasSelf.reduce((a, b) => a + b, 0) / respostasSelf.length : null;
    const othersScore = respostasOutros.length > 0 ? respostasOutros.reduce((a, b) => a + b, 0) / respostasOutros.length : null;

    const gap = (selfScore !== null && othersScore !== null) ? (selfScore - othersScore) : null;

    console.log(`🎯 Resultado final - Self: ${selfScore}, Outros: ${othersScore}, Gap: ${gap}`);

    return { selfScore, othersScore, gap };
  }

    public getGapChartDataForCompetency(competencyId: string): GapChartDataItem[] {
    console.log(`🔍 getGapChartDataForCompetency chamado para competência: ${competencyId}`);

    const competencia = this.competencias.find(c => c.id === competencyId);
    if (!competencia || !competencia.perguntasIds) {
      console.log('❌ Competência não encontrada ou sem perguntas');
      return [];
    }

    console.log(`✅ Competência encontrada: ${competencia.nome} com ${competencia.perguntasIds.length} perguntas`);

    const dadosPorPergunta: GapChartDataItem[] = [];

    competencia.perguntasIds.forEach((perguntaId, index) => {
      console.log(`📝 Processando pergunta ${index + 1}/${competencia.perguntasIds.length}: ${perguntaId}`);

      const perguntaTexto = this.questionMap[perguntaId] || perguntaId;
      console.log(`📋 Texto da pergunta: ${perguntaTexto}`);

      const dadosPergunta = this.getDadosPerguntaDefasagem(perguntaId);

      if (dadosPergunta) {
        const item = {
          competencyName: perguntaTexto,
          selfScore: dadosPergunta.selfScore,
          othersScore: dadosPergunta.othersScore,
          gap: dadosPergunta.gap
        };

        console.log(`✅ Item criado:`, item);
        dadosPorPergunta.push(item);
      } else {
        console.log(`❌ Dados não encontrados para pergunta ${perguntaId}`);
      }
    });

    console.log(`📊 Total de itens criados: ${dadosPorPergunta.length}`);
    const resultado = dadosPorPergunta.sort((a, b) => a.competencyName.localeCompare(b.competencyName));

    console.log(`🎯 Resultado final ordenado:`, resultado);
    return resultado;
  }

  ngAfterViewInit(): void { }
}
