import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, AfterViewInit, OnDestroy } from '@angular/core';
import {
  parseNumeric,
  exportToCSV,
  filterQuestionsByType,
  computeConsolidation,
  getQuestionTypeStats,
  isParticipantIncludedInReports,
  resolveExportAnswer,
  getExportAnswerTipoResposta,
  parseLikertAnswerForExport,
  normalizeQuestionType,
} from './reports-utils';
import { MatTableModule } from '@angular/material/table';
import { Firestore, collection, getDocs, doc, getDoc, addDoc, setDoc, deleteDoc, updateDoc } from '@angular/fire/firestore';
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
import { getInstanceByDom } from 'echarts/core';
import { ReportsPdfService } from './reports-pdf.service';
import { ReportPdfMakeService, DocumentoConfig, DOCUMENTO_CONFIG_PADRAO, PdfHtmlRenderOptions } from '../../services/report-pdfmake.service';
import { ReportClientExportService } from '../../services/report-client-export.service';
import {
  ClientExportDialogComponent,
  ClientExportDialogResult,
} from './client-export-dialog/client-export-dialog.component';
import { NgxEchartsModule } from 'ngx-echarts';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { PerformanceMonitorService } from './performance-monitor.service';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ActivatedRoute, NavigationEnd } from '@angular/router';
import { Input } from '@angular/core';
import { Router } from '@angular/router';
import { AppPageHeaderComponent } from '../../components/page-header/page-header.component';
import { LoadingService } from '../../services/loading.service';
import { FirestoreLoadingInterceptor } from '../../interceptors/firestore-loading.interceptor';
import { AuthService } from '../../services/apps/authentication/auth.service';
import { CompetencyQuestionsService } from '../../services/competency-questions.service';
import { query, where } from '@angular/fire/firestore';
import { JohariWindowChartComponent, JohariWindowData } from './charts/johari-window-chart/johari-window-chart.component';
import { JOHARI_THRESHOLD } from './charts/johari-window-chart/johari-window.utils';
import {
  CAPA_HTML_PDF_STYLES,
  DEFAULT_CAPA_HTML,
  REPORT_CAPA_EDITOR_CONFIG,
  REPORT_RICH_TEXT_EDITOR_CONFIG,
  secaoSuportaHtmlBruto,
} from './report-rich-text.config';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { GapChartComponent, GapChartDataItem } from './charts/gap-chart/gap-chart.component';
import { ReportBuilderVisualComponent } from './report-builder-visual/report-builder-visual.component';
import { SurveyDashboardComponent } from './survey-dashboard/survey-dashboard.component';
import { Subject, from, of, takeUntil, tap, debounceTime, switchMap, filter, distinctUntilChanged, firstValueFrom } from 'rxjs';
import {
  ReportTemplateManageDialogComponent,
  ReportTemplateManageDialogData,
} from './report-template-manage-dialog/report-template-manage-dialog.component';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
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
  private readonly GRUPO_AVALIADO = 'Avaliado(a)';
  private readonly LABEL_MEDIA_GERAL = 'Média geral (com autoavaliação)';
  private readonly LABEL_MEDIA_SEM_AUTO = 'Média sem autoavaliação';
  // Cache de participantes para evitar múltiplas idas ao Firestore
  private participantsCache: Map<string, any> = new Map<string, any>();
  /** Snapshot autoritativo dos participantes do ciclo (recarregado do Firestore). */
  private participantDataById = new Map<string, Record<string, unknown>>();
  /** IDs de participantes bloqueados no projeto atual (consulta fresca ao Firestore). */
  private blockedParticipantIds = new Set<string>();

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

  private isFilterContextStale(expectedGeneration: number): boolean {
    return expectedGeneration !== this.filterContextGeneration;
  }

  /** Carrega participantes do ciclo e monta o set de bloqueados (sempre do Firestore, sem cache stale). */
  private async loadParticipantsForReport(
    projectId: string,
    resultParticipantIds: string[]
  ): Promise<void> {
    this.blockedParticipantIds.clear();
    this.participantDataById.clear();
    this.participantsCache.clear();
    this.projectParticipantIdsForFilter.clear();

    if (projectId) {
      try {
        const snap = await getDocs(query(
          collection(this.firestore, 'participants'),
          where('projectId', '==', projectId)
        ));
        snap.docs.forEach(d => {
          this.projectParticipantIdsForFilter.add(d.id);
          const data = d.data() as Record<string, unknown>;
          this.participantDataById.set(d.id, data);
          this.participantsCache.set(d.id, data);
          if (data['blocked'] === true) {
            this.blockedParticipantIds.add(d.id);
          }
        });
      } catch (error) {
        console.warn('[Relatório] Erro ao carregar participantes do projeto:', error);
      }
    }

    const missingIds = [...new Set(resultParticipantIds.filter(id => id && !this.participantDataById.has(id)))];
    await Promise.all(missingIds.map(async (participantId) => {
      try {
        const snap = await getDoc(doc(this.firestore, 'participants', participantId));
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        this.participantDataById.set(participantId, data);
        this.participantsCache.set(participantId, data);
        if (data['blocked'] === true) {
          this.blockedParticipantIds.add(participantId);
        }
      } catch (error) {
        console.warn(`[Relatório] Erro ao carregar participante ${participantId}:`, error);
      }
    }));
    this.soleAvaliadoIdForCurrentProject = projectId
      ? this.resolveSoleAvaliadoIdFromLoadedProject(projectId) ?? null
      : null;
  }

  private normalizeCategory(raw: unknown): string {
    return String(raw || '').trim();
  }

  /** Infere tipo a partir de type ou category (Excel/modal às vezes omitem type). */
  private inferParticipantType(participantData: Record<string, unknown>): 'avaliado' | 'avaliador' {
    const type = String(participantData['type'] || '').toLowerCase();
    if (type === 'avaliador') return 'avaliador';
    if (type === 'avaliado') return 'avaliado';
    const cat = this.normalizeCategory(participantData['category'] || participantData['categoria']);
    if (cat === 'Avaliado' || cat === 'Avaliado(a)') return 'avaliado';
    return 'avaliador';
  }

  private inferRowTipo(row: Record<string, unknown>): 'avaliado' | 'avaliador' {
    const tipo = String(row['tipo'] || '').toLowerCase();
    if (tipo === 'avaliador') return 'avaliador';
    if (tipo === 'avaliado') return 'avaliado';
    const cat = this.normalizeCategory(row['categoria']);
    if (cat === 'Avaliado' || cat === 'Avaliado(a)') return 'avaliado';
    return 'avaliador';
  }

  /** Único avaliado do projeto a partir dos participantes já carregados. */
  private resolveSoleAvaliadoIdFromLoadedProject(projectId: string): string | undefined {
    if (!projectId) return undefined;
    const avaliadoIds: string[] = [];
    this.participantDataById.forEach((data, id) => {
      if (!this.projectParticipantIdsForFilter.has(id)) return;
      if (String(data['projectId'] || '') !== projectId && !this.projectParticipantIdsForFilter.has(id)) return;
      if (this.inferParticipantType(data) === 'avaliado') {
        avaliadoIds.push(id);
      }
    });
    return avaliadoIds.length === 1 ? avaliadoIds[0] : undefined;
  }

  private resolveEvaluatorAvaliadoId(
    participantId: string,
    participantData: Record<string, unknown>,
    filterProjectId: string,
    soleAvaliadoId: string | undefined,
    evaluatorToAvaliadoIdMap: Map<string, string>
  ): string | undefined {
    const inProject = this.projectParticipantIdsForFilter.has(participantId)
      || participantData['projectId'] === filterProjectId;

    // Regra de negócio 360: 1 avaliado por projeto → todo avaliador do ciclo avalia esse avaliado
    if (soleAvaliadoId && inProject) {
      return soleAvaliadoId;
    }

    const fromParticipant = participantData['avaliadoId'] as string | undefined;
    if (fromParticipant) return fromParticipant;

    return evaluatorToAvaliadoIdMap.get(participantId);
  }

  private getBlockedCacheSuffix(): string {
    return [...this.blockedParticipantIds].sort().join('|') || 'none';
  }

  /** Atualiza flags de bloqueio sem recarregar todo o dataSource (ex.: retorno à aba). */
  private async refreshBlockedParticipantsStatus(projectId: string): Promise<void> {
    this.blockedParticipantIds.clear();

    if (projectId) {
      try {
        const snap = await getDocs(query(
          collection(this.firestore, 'participants'),
          where('projectId', '==', projectId)
        ));
        snap.docs.forEach(d => {
          const data = d.data() as Record<string, unknown>;
          this.participantDataById.set(d.id, data);
          this.participantsCache.set(d.id, data);
          if (data['blocked'] === true) {
            this.blockedParticipantIds.add(d.id);
          }
        });
        return;
      } catch (error) {
        console.warn('[Relatório] Erro ao atualizar status de bloqueio:', error);
      }
    }

    this.participantDataById.forEach((data, id) => {
      if (data['blocked'] === true) {
        this.blockedParticipantIds.add(id);
      }
    });
  }

  /** Remove linhas de participantes bloqueados do dataSource e recalcula índices/cache. */
  private async applyBlockedParticipantsFilter(): Promise<void> {
    const projectId = this.filterProjectControl.value || '';

    await this.refreshBlockedParticipantsStatus(projectId);

    this.dataSource = this.dataSource.filter(
      row => !row.participanteId || !this.blockedParticipantIds.has(row.participanteId)
    );

    this.createDataIndexes();
    this.invalidateCache();
    this.cdr.markForCheck();
  }

  private isRowFromBlockedParticipant(row: Record<string, unknown> | null | undefined): boolean {
    const participantId = row?.['participanteId'] as string | undefined;
    if (!participantId) return false;
    if (this.blockedParticipantIds.has(participantId)) return true;
    const data = this.participantDataById.get(participantId);
    return data?.['blocked'] === true;
  }

  private getRowsForReportCalculations(): any[] {
    return this.dataSource.filter(row => !this.isRowFromBlockedParticipant(row));
  }

  // Converte respostas tipo "Column N" para número (1..5)
  private parseLikertAnswer(answer: unknown): number | null {
    return parseLikertAnswerForExport(answer);
  }

  // Exporta base de dados plana (uma linha por resposta por pergunta)
  exportarBaseExcel(): void {
    if (!this.dataSource || this.dataSource.length === 0) {
      this.snackBar.open(this.translate.instant('Sem dados para exportar.'), this.translate.instant('Fechar'), { duration: 2500 });
      return;
    }

    const perguntasIds: string[] = this.allQuestions?.map(q => q.id) || Object.keys(this.questionMap || {});
    const tipoPerguntaPorId = new Map(
      (this.allQuestions || []).map(q => [q.id, normalizeQuestionType(q.type)])
    );
    const competenciaPorPergunta = new Map<string, string>();

    for (const comp of this.competencias || []) {
      for (const perguntaId of comp.perguntasIds || []) {
        if (!competenciaPorPergunta.has(perguntaId)) {
          competenciaPorPergunta.set(perguntaId, comp.nome);
        }
      }
    }

    const resolverCompetenciaPorPergunta = (perguntaId: string): string => {
      if (competenciaPorPergunta.has(perguntaId)) {
        return competenciaPorPergunta.get(perguntaId) || '';
      }

      for (const [idBase, nomeComp] of competenciaPorPergunta.entries()) {
        if (perguntaId.startsWith(`${idBase}_`) || idBase.startsWith(`${perguntaId}_`)) {
          return nomeComp;
        }
      }

      return '';
    };

    const linhas: Record<string, string | number>[] = [];
    for (const row of this.dataSource) {
      for (const perguntaId of perguntasIds) {
        if (!(perguntaId in row)) continue;

        const exportAnswer = resolveExportAnswer(row[perguntaId], tipoPerguntaPorId.get(perguntaId));
        if (exportAnswer.kind === 'skip') continue;

        linhas.push({
          AssessmentId: this.selectedAssessmentId || '',
          Data: row['dataAvaliacao'] || '',
          Horário: row['horarioAvaliacao'] || '',
          Categoria: row['categoria'] || '',
          Avaliado: row['avaliado'] || '',
          Cargo: row['cargo'] || '',
          'Área/Setor': row['setor'] || '',
          Competência: resolverCompetenciaPorPergunta(perguntaId),
          PerguntaId: perguntaId,
          Pergunta: this.substituirVariaveisRelatorio(this.questionMap[perguntaId] || perguntaId),
          TipoResposta: getExportAnswerTipoResposta(exportAnswer.kind),
          Resposta: exportAnswer.value,
        });
      }
    }

    if (linhas.length === 0) {
      this.snackBar.open(this.translate.instant('Sem respostas válidas para exportar.'), this.translate.instant('Fechar'), { duration: 2500 });
      return;
    }

    const linhasAbertas = linhas.filter(l => l['TipoResposta'] === 'Aberta');
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(linhas), 'Base');
    if (linhasAbertas.length > 0) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(linhasAbertas),
        'Perguntas Abertas'
      );
    }

    const fileName = this.getExportFileName('xlsx');

    XLSX.writeFile(workbook, fileName);
    this.snackBar.open(this.translate.instant('Base exportada com sucesso!'), this.translate.instant('Fechar'), { duration: 2500 });
  }

  async abrirExtratoClienteExcel(): Promise<void> {
    if (!this.clients.length) {
      this.snackBar.open(
        this.t('Nenhum cliente disponível para exportação.'),
        this.t('Fechar'),
        { duration: 3500 }
      );
      return;
    }

    const dialogRef = this.dialog.open(ClientExportDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      data: {
        clients: this.clients,
        preselectedClientId: this.filterClientControl.value || this.selectedClientId || undefined,
        releasedOnly: this.shouldFilterByReleaseStatus,
      },
    });

    const result = await dialogRef.afterClosed().toPromise() as ClientExportDialogResult | undefined;
    if (!result) return;

    this.isExporting = true;
    this.exportingLabel = this.t('Gerando extrato do cliente...');
    this.cdr.markForCheck();

    try {
      const exportResult = await this.clientExportService.exportClientExtract(
        {
          clientId: result.clientId,
          clientName: result.clientName,
          projectIds: result.projectIds,
          releasedOnly: this.shouldFilterByReleaseStatus,
        },
        message => {
          this.exportingLabel = message;
          this.cdr.markForCheck();
        }
      );

      this.snackBar.open(
        this.t('Extrato exportado: {{resumo}} linhas (Resumo), {{respostas}} linhas (Respostas).')
          .replace('{{resumo}}', String(exportResult.resumoCount))
          .replace('{{respostas}}', String(exportResult.respostasCount)),
        this.t('Fechar'),
        { duration: 5000 }
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : this.t('Erro ao exportar extrato.');
      this.snackBar.open(message, this.t('Fechar'), { duration: 5000 });
    } finally {
      this.isExporting = false;
      this.exportingLabel = '';
      this.cdr.markForCheck();
    }
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
    this.initClientSearch();
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
      this.selectedTemplateId.setValue(cfg.templateId, { emitEvent: false });
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

  // ── Geração em Lote ─────────────────────────────────────────────
  batchPanelOpen = false;
  batchSelectedParticipants = new Set<string>();
  batchExcludedCategories = new Set<string>();
  availableCategoriesForBatch: { grupo: string; totalCount: number }[] = [];
  isBatchGenerating = false;
  batchProgress = 0;
  batchTotal = 0;
  batchCurrentName = '';
  batchErrors: { name: string; error: string }[] = [];
  batchShowEvaluatorConfig = false;
  readonly ANONYMITY_THRESHOLD = 3;

  get builderSavedLabel(): string {
    if (this.selectedTemplateId.value) {
      return this.savedTemplates.find(t => t.id === this.selectedTemplateId.value)?.name || '';
    }
    if (this.selectedReportId.value) {
      return this.savedReports.find(r => r.id === this.selectedReportId.value)?.name || '';
    }
    return '';
  }

  get nomeTemplateSelecionado(): string {
    return this.savedTemplates.find(t => t.id === this.selectedTemplateId.value)?.name || this.selectedTemplateId.value || '';
  }

  get nomeTemplateAplicado(): string {
    if (!this.appliedTemplateId) return '';
    return this.savedTemplates.find(t => t.id === this.appliedTemplateId)?.name || this.appliedTemplateId;
  }

  async onBuilderSaveRequested(): Promise<void> {
    if (this.appliedTemplateId) {
      await this.salvarAlteracoesNoTemplate();
    } else if (this.selectedReportId.value) {
      await this.atualizarRelatorioNoFirebase();
      this.builderHasUnsavedChanges = false;
    } else {
      this.snackBar.open(
        this.t('Aplique um template ou carregue um rascunho antes de salvar.'),
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

  // Filtros de Cliente e Projeto no topo do relatório
  filterClientControl = new FormControl('');
  filterProjectControl = new FormControl('');
  filterProjects: { id: string; name: string; assessmentId?: string; reportTemplateId?: string }[] = [];
  allAssessmentsByProject = new Map<string, string>(); // projectId → assessmentId
  /** Avaliações do cliente selecionado (passo 2). */
  clientAssessments: AssessmentOption[] = [];
  /** assessmentId → projectIds que usam esse formulário. */
  private assessmentProjectsMap = new Map<string, string[]>();
  /** Projetos candidatos quando a avaliação mapeia para mais de um ciclo. */
  projectsForAssessment: { id: string; name: string }[] = [];
  /** true quando o usuário precisa escolher o projeto manualmente. */
  projectSelectionRequired = false;
  /** true quando o projeto foi deduzido automaticamente (1 candidato). */
  projectAutoDeduced = false;
  /** Evita auto-seleção de avaliação enquanto query params de projeto estão sendo aplicados. */
  private pendingQueryProjectId: string | null = null;
  /** Sentinel em pendingQueryProjectId durante export ZIP multi-projeto. */
  private static readonly CLIENT_BATCH_QUERY_SENTINEL = '__clientBatch__';
  /** Evita reentrada do handler de query params (ex.: ao limpar params do batch). */
  private suppressQueryParamsHandler = false;
  /** Quando exportação veio de Projetos → Gerar Relatório, volta para /projects após concluir. */
  private projectExportReturnTo: string | null = null;
  /** Incrementado ao limpar filtros — invalida cargas assíncronas em andamento. */
  private filterContextGeneration = 0;
  /** IDs de participantes do projeto filtrado (para incluir avaliadores mesmo sem projectId no doc). */
  private projectParticipantIdsForFilter = new Set<string>();
  /** Quando o projeto tem exatamente 1 avaliado, usado para vincular gestores/pares. */
  private soleAvaliadoIdForCurrentProject: string | null = null;

  // Controles para cliente e grupos de competências
  clients: any[] = [];
  clientsFiltered: any[] = [];
  clientSearchCtrl = new FormControl('');
  currentUserRole: string = '';
  viewerProjectIds = new Set<string>();
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

  get canExportPdf(): boolean {
    return ['admin_master', 'admin_client', 'viewer'].includes(this.currentUserRole);
  }

  get canExportExcel(): boolean {
    return ['admin_master', 'admin_client'].includes(this.currentUserRole);
  }

  get canExportDocx(): boolean {
    return this.currentUserRole === 'admin_master';
  }

  get canReleaseReport(): boolean {
    return this.currentUserRole === 'admin_master';
  }

  get shouldFilterByReleaseStatus(): boolean {
    return ['admin_client', 'viewer'].includes(this.currentUserRole);
  }

  get selectedAvaliadoReleaseStatus(): 'released' | 'pending' {
    if (!this.selectedAvaliado) return 'pending';
    const row = this.dataSource.find(r => r.avaliado === this.selectedAvaliado);
    return row?.reportStatus === 'released' ? 'released' : 'pending';
  }

  get reportNeedsPublish(): boolean {
    return this.selectedAvaliadoReleaseStatus !== 'released'
      && (this.competencias.length > 0 || this.relatorioConfiguracao.length > 0);
  }

  // Assinatura do que foi publicado pela última vez (para detectar alterações pendentes)
  private publishedSignature: string | null = null;

  /** Serializa o estado atual do relatório (competências + seções + layout). */
  private computeReportSignature(): string {
    try {
      return JSON.stringify({
        c: this.competencias ?? [],
        s: this.relatorioConfiguracao ?? [],
        d: this.documentoConfig ?? {},
      });
    } catch {
      return '';
    }
  }

  /** True quando o relatório já foi publicado mas há mudanças não publicadas. */
  get hasUnpublishedChanges(): boolean {
    if (this.selectedAvaliadoReleaseStatus !== 'released') return false;
    if (this.publishedSignature === null) return false;
    return this.computeReportSignature() !== this.publishedSignature;
  }

  // True quando existe um snapshot ativo (não revogado) que o viewer consegue acessar.
  hasActiveSnapshot = false;

  /** True quando o viewer tem acesso ao relatório (por status OU por snapshot ativo). */
  get viewerHasAccess(): boolean {
    return this.selectedAvaliadoReleaseStatus === 'released' || this.hasActiveSnapshot;
  }

  /** True quando o status diz "não publicado" mas ainda existe snapshot ativo (estado inconsistente). */
  get isSnapshotOrphaned(): boolean {
    return this.selectedAvaliadoReleaseStatus !== 'released' && this.hasActiveSnapshot;
  }

  /** ID do cliente ativo nos filtros de relatório. */
  private getReportClientId(): string {
    return this.filterClientControl.value || this.selectedClientId || '';
  }

  private buildReleasedSnapshotId(clientId: string, assessmentId: string, avaliadoName: string): string {
    const safeKey = avaliadoName.replace(/[^a-zA-Z0-9À-ÿ]/g, '_');
    return clientId
      ? `${clientId}_${assessmentId}_${safeKey}`
      : `${assessmentId}_${safeKey}`;
  }

  /** Verifica se um snapshot pertence ao escopo do cliente (com fallback legado por projeto). */
  private snapshotMatchesScope(data: Record<string, unknown> | undefined): boolean {
    if (!data || data['revoked'] === true) return false;
    const clientId = this.getReportClientId();
    const projectId = this.filterProjectControl.value;
    const snapClientId = data['clientId'] as string | undefined;
    if (snapClientId) {
      return !!clientId && snapClientId === clientId;
    }
    const snapProjectId = data['projectId'] as string | undefined;
    if (snapProjectId && projectId) {
      return snapProjectId === projectId;
    }
    return !snapProjectId;
  }

  /** Verifica no Firestore se há snapshot ativo (não revogado) para o avaliado/cliente atual. */
  private async checkActiveSnapshot(avaliadoName: string): Promise<void> {
    this.hasActiveSnapshot = false;
    if (!this.selectedAssessmentId || !avaliadoName) return;
    try {
      const qSnap = await getDocs(query(
        collection(this.firestore, 'releasedReports'),
        where('assessmentId', '==', this.selectedAssessmentId),
        where('avaliadoName', '==', avaliadoName)
      ));
      this.hasActiveSnapshot = qSnap.docs.some(d => this.snapshotMatchesScope(d.data()));
    } catch {
      this.hasActiveSnapshot = false;
    }
  }

  viewerSnapshotLoaded = false;

  get isReportPendingForViewer(): boolean {
    return ['viewer', 'admin_client'].includes(this.currentUserRole)
      && this.selectedTabIndex === 2
      && !!this.selectedAssessmentId
      && !this.viewerSnapshotLoaded;
  }

  async toggleReportRelease(): Promise<void> {
    if (!this.selectedAvaliado) return;
    if (this.selectedAvaliadoReleaseStatus === 'released') {
      await this.revokeReportRelease(this.selectedAvaliado);
    } else {
      await this.releaseReport(this.selectedAvaliado);
    }
  }

  consolidation: any[] = [];
  consolidationColumns: string[] = ['pergunta', 'sessao', 'tema', 'resposta', 'respondentes', 'percent', 'score'];

  // Competências e gráficos
  stackedData: any[] = [];
  colorScheme = { domain: ['#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575', '#424242'] };

  // Sistema de cores customizáveis
  paletasCores: { [key: string]: { nome: string; cores: string[]; tipo: 'gradiente' | 'flat' | 'especial' } } = {
    // ── GRADIENTES ──────────────────────────────────────────────────────────
    'padrao':      { nome: 'Padrão (Cinza)',       tipo: 'gradiente', cores: ['#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575', '#424242'] },
    'azul':        { nome: 'Azul Profissional',    tipo: 'gradiente', cores: ['#E3F2FD', '#90CAF9', '#42A5F5', '#1E88E5', '#0D47A1'] },
    'verde':       { nome: 'Verde Sucesso',         tipo: 'gradiente', cores: ['#E8F5E8', '#A5D6A7', '#66BB6A', '#43A047', '#1B5E20'] },
    'laranja':     { nome: 'Laranja Energia',       tipo: 'gradiente', cores: ['#FFF3E0', '#FFCC80', '#FF9800', '#F57C00', '#E65100'] },
    'roxo':        { nome: 'Roxo Criativo',         tipo: 'gradiente', cores: ['#F3E5F5', '#CE93D8', '#AB47BC', '#8E24AA', '#4A148C'] },
    'vermelho':    { nome: 'Vermelho Impacto',      tipo: 'gradiente', cores: ['#FFEBEE', '#EF9A9A', '#EF5350', '#E53935', '#B71C1C'] },
    'teal':        { nome: 'Teal Moderno',          tipo: 'gradiente', cores: ['#E0F2F1', '#80CBC4', '#26A69A', '#00897B', '#004D40'] },
    'indigo':      { nome: 'Índigo Elegante',       tipo: 'gradiente', cores: ['#E8EAF6', '#9FA8DA', '#5C6BC0', '#3949AB', '#1A237E'] },
    'coral':       { nome: 'Coral & Rosê',          tipo: 'gradiente', cores: ['#FCE4EC', '#F48FB1', '#EC407A', '#C2185B', '#880E4F'] },
    'dourado':     { nome: 'Dourado & Âmbar',       tipo: 'gradiente', cores: ['#FFFDE7', '#FFE082', '#FFCA28', '#FFA000', '#E65100'] },
    'esmeralda':   { nome: 'Esmeralda',             tipo: 'gradiente', cores: ['#ECFDF5', '#A7F3D0', '#34D399', '#059669', '#064E3B'] },
    'marinho':     { nome: 'Azul Marinho',          tipo: 'gradiente', cores: ['#DBEAFE', '#93C5FD', '#3B82F6', '#1D4ED8', '#1E3A5F'] },
    'slate':       { nome: 'Cinza Azulado',         tipo: 'gradiente', cores: ['#F1F5F9', '#94A3B8', '#64748B', '#334155', '#0F172A'] },
    // ── ESPECIAIS ───────────────────────────────────────────────────────────
    'categorias':    { nome: 'Categorias Distintas', tipo: 'especial', cores: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'] },
    'personalizada': { nome: 'Personalizada',        tipo: 'especial', cores: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'] },
  };

  readonly paletasGradiente = Object.entries(this.paletasCores)
    .filter(([, v]) => v.tipo === 'gradiente')
    .map(([key, value]) => ({ key, value }));

  readonly paletasFlat = Object.entries(this.paletasCores)
    .filter(([, v]) => v.tipo === 'flat')
    .map(([key, value]) => ({ key, value }));

  readonly paletasEspecial = Object.entries(this.paletasCores)
    .filter(([, v]) => v.tipo === 'especial')
    .map(([key, value]) => ({ key, value }));
  dynamicColumns: string[] = [];
  dadosTextEnabled = false;
  competenciasTextEnabled = false;
  graficosTextEnabled = false;
  dadosTextControl = new FormControl('');
  competenciasTextControl = new FormControl('');
  graficosTextControl = new FormControl('');
  editorConfig: AngularEditorConfig = REPORT_RICH_TEXT_EDITOR_CONFIG;
  capaEditorConfig: AngularEditorConfig = REPORT_CAPA_EDITOR_CONFIG;

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

  documentoConfig: DocumentoConfig = {
    ...DOCUMENTO_CONFIG_PADRAO,
    cabecalho: { ...DOCUMENTO_CONFIG_PADRAO.cabecalho } as DocumentoConfig['cabecalho'],
    rodape: { ...DOCUMENTO_CONFIG_PADRAO.rodape }
  };

  // Exemplo de configuração inicial do relatório
  relatorioConfiguracao: RelatorioSecao[] = [
    {
      id: 'capa',
      tipo: 'capa',
      titulo: 'Relatório Feedback 360°',
      texto: DEFAULT_CAPA_HTML,
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
  /** Template efetivamente aplicado ao editor (distinto da seleção no dropdown). */
  appliedTemplateId: string | null = null;
  private templateAutoApplyReady = false;
  private applyingTemplate = false;

  // �Ys? PERFORMANCE: Cache para cálculos pesados
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
    private sanitizer: DomSanitizer,
    private confirmDialog: ConfirmDialogService,
    private competencyQuestionsService: CompetencyQuestionsService,
    private dialog: MatDialog,
    private clientExportService: ReportClientExportService
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

    this.selectedTemplateId.valueChanges.pipe(
      distinctUntilChanged(),
      filter((id): id is string => !!id),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      void this.onTemplateDropdownChanged();
    });

    queueMicrotask(() => {
      this.templateAutoApplyReady = true;
    });


    this.assessmentSearchControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(term => {
        const t = (term || '').toLowerCase();
        this.filteredAssessments = this.clientAssessments.filter(a =>
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
          this.filteredAssessments = [...this.clientAssessments];
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

  private sanitizeFileNamePart(value: string | null | undefined, fallback: string): string {
    const sanitized = (value || '')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return sanitized || fallback;
  }

  private getExportBaseName(): string {
    const participantName = this.sanitizeFileNamePart(
      this.individualParticipantName || this.selectedAvaliado,
      'Participante'
    );
    const clientName = this.sanitizeFileNamePart(this.getClientName(), 'Cliente');
    return `${participantName}_Relatório Feedback 360_${clientName}`;
  }

  private getExportFileName(extension: 'pdf' | 'docx' | 'xlsx'): string {
    return `${this.getExportBaseName()}.${extension}`;
  }

  private readonly PREVIEW_CACHE_PATTERNS = [
    'secao-', 'tabela-competencia', 'destaques-', 'competencias-secao-',
    'competencias-graficos-', 'contagem-respondentes', 'secoes-visiveis',
    'johari-data-', 'grafico-comp-', 'resumo-',
  ];

  private getCachedCalculation<T>(key: string, calculationFn: () => T): T {
    if (!this.calculosCache.has(key)) {
      this.calculosCache.set(key, calculationFn());
    }
    return this.calculosCache.get(key);
  }

  private invalidateCache(pattern?: string) {
    let keysToDelete: string[];
    if (!pattern) {
      keysToDelete = Array.from(this.calculosCache.keys());
    } else if (pattern === 'secao-') {
      keysToDelete = Array.from(this.calculosCache.keys()).filter(key =>
        this.PREVIEW_CACHE_PATTERNS.some(p => key.includes(p))
      );
    } else {
      keysToDelete = Array.from(this.calculosCache.keys()).filter(key => key.includes(pattern));
    }
    keysToDelete.forEach(key => this.calculosCache.delete(key));
  }

  // Indexação de dados
  private createDataIndexes() {

    this.dataIndexes.participantsByCategory.clear();
    this.dataIndexes.responsesByParticipant.clear();
    this.dataIndexes.questionsByType.clear();

    // Indexar participantes por categoria (armazenar índices numéricos)
    this.dataSource.forEach((row, index) => {
      if (this.isRowFromBlockedParticipant(row)) return;
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

    console.log(`�o. Índices criados: ${this.dataIndexes.participantsByCategory.size} categorias, ${this.dataIndexes.responsesByParticipant.size} participantes`);
  }

  // �Ys? PERFORMANCE: TrackBy functions
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

  // �Ys? PERFORMANCE: Método para exibir relatório de performance
  showPerformanceReport(): void {
    this.performanceMonitor.logPerformanceReport();
  }

    debugCores(secao: any, i: number): void {
    console.group(`�YZ� DEBUG CORES - Seção ${i} (${secao.id})`);
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
      console.log('�Y"� Testando mudança para paleta personalizada...');
      paletaControl.setValue('personalizada');
      this.onPaletaCorChange(secao, i);
    } else {
      console.log('�Y"� Testando adição de nova cor...');
      this.adicionarCorPersonalizada(secao, i);
    }

    console.groupEnd();
  }

  async ngOnInit() {
    this.today = new Date();
    this.currentUserRole = (await this.authService.getCurrentUserRole()) || '';
    if (this.currentUserRole === 'viewer') {
      await this.loadViewerProjectIds();
    }

    // Configurar o listener para mudanças no filtro de perguntas
    this.includeOpenQuestions.valueChanges.subscribe(() => {
      this.onQuestionFilterChange();
    });

    // Carregar clientes, avaliações e templates primeiro
    await this.loadClients();
    this.initClientSearch();
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
    this.route.queryParams.pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged((a, b) =>
        a['mode'] === b['mode'] &&
        a['clientId'] === b['clientId'] &&
        a['projectId'] === b['projectId'] &&
        a['assessmentId'] === b['assessmentId'] &&
        a['participantId'] === b['participantId'] &&
        a['templateId'] === b['templateId'] &&
        a['competencyIds'] === b['competencyIds'] &&
        a['exportAction'] === b['exportAction'] &&
        a['returnTo'] === b['returnTo'] &&
        a['projectIds'] === b['projectIds'] &&
        a['projectTemplates'] === b['projectTemplates']
      )
    ).subscribe(async params => {
      if (this.suppressQueryParamsHandler) return;

      // Pré-popular filtros a partir de params de projeto (sem modo individual)
      if (params['mode'] !== 'individual') {
        this.resetIndividualMode();
        const clientIdParam: string | undefined = params['clientId'];
        const projectIdParam: string | undefined = params['projectId'];
        if (!clientIdParam && !projectIdParam) return;

        let resolvedClientId = clientIdParam;
        if (!resolvedClientId && projectIdParam) {
          try {
            const projectDoc = await getDoc(doc(this.firestore, 'projects', projectIdParam));
            if (projectDoc.exists()) {
              resolvedClientId = projectDoc.data()['clientId'] || undefined;
            }
          } catch (e) {
            console.error('[Relatório] Erro ao resolver cliente do projeto:', e);
          }
        }

        const exportAction = params['exportAction'] as string | undefined;
        this.projectExportReturnTo = (params['returnTo'] as string) || null;
        const batchProjectIds = (params['projectIds'] as string | undefined)
          ?.split(',')
          .map(id => id.trim())
          .filter(Boolean) || [];
        const isClientBatchExport = exportAction === 'clientBatchPdf' && batchProjectIds.length > 0;

        if (resolvedClientId) {
          this.pendingQueryProjectId = isClientBatchExport
            ? ReportsComponent.CLIENT_BATCH_QUERY_SENTINEL
            : (projectIdParam || null);
          this.filterClientControl.setValue(resolvedClientId, { emitEvent: false });
          await this.onFilterClientChange();
          this.pendingQueryProjectId = null;
        }

        if (isClientBatchExport) {
          // Geração em lote PDF multi-projeto desabilitada nesta versão.
          this.snackBar.open(
            'Exportação em lote de PDF temporariamente indisponível.',
            this.t('Fechar'),
            { duration: 4000 }
          );
          this.clearClientBatchQueryParams();
          this.cdr.markForCheck();
          return;
          /*
          if (this.isBatchGenerating) return;
          const templateByProject = this.parseProjectTemplateMap(params['projectTemplates'] as string | undefined);
          await this.executeClientBatchPdfExport(batchProjectIds, templateByProject);
          this.cdr.markForCheck();
          return;
          */
        }

        if (projectIdParam) {
          await this.initializeReportFromProject(projectIdParam, params['templateId']);
          if (exportAction && exportAction !== 'openReports') {
            await this.executeProjectExportAction(exportAction);
          } else if (params['templateId'] || exportAction === 'openReports') {
            this.selectedTabIndex = 2;
          }
        }

        this.cdr.markForCheck();
        return;
      }

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

      // 1b. Popular filtros sequenciais quando vindo de Projetos → Participantes
      const clientIdParam: string | null = params['clientId'] || null;
      const projectIdParam: string | null = params['projectId'] || null;

      if (clientIdParam) {
        this.pendingQueryProjectId = projectIdParam || null;
        this.filterClientControl.setValue(clientIdParam, { emitEvent: false });
        await this.onFilterClientChange();
        this.pendingQueryProjectId = null;
      } else if (projectIdParam) {
        this.pendingQueryProjectId = projectIdParam;
        try {
          const projectDoc = await getDoc(doc(this.firestore, 'projects', projectIdParam));
          const resolvedClientId = projectDoc.data()?.['clientId'];
          if (resolvedClientId) {
            this.filterClientControl.setValue(resolvedClientId, { emitEvent: false });
            await this.onFilterClientChange();
          }
        } catch (e) {
          console.error('[Relatório Individual] Erro ao resolver cliente do projeto:', e);
        }
        this.pendingQueryProjectId = null;
      }

      if (projectIdParam) {
        this.filterProjectControl.setValue(projectIdParam, { emitEvent: false });
        this.projectAutoDeduced = true;
        this.projectSelectionRequired = false;
      }

      // 2. Setar avaliação nos controles (sem disparar subscriptions)
      this.selectedAssessmentId = assessmentId;
      this.assessmentControl.setValue(assessmentId, { emitEvent: false });

      // 3. Resolver e exibir nome da avaliação ANTES de carregar dados pesados
      const assessmentName = await this.resolveAssessmentName(assessmentId);
      this.assessmentSearchControl.setValue(assessmentName, { emitEvent: false });

      // Garantir que filteredAssessments contenha esta avaliação (para o filtro sequencial)
      if (!this.filteredAssessments.find(a => a.id === assessmentId)) {
        this.filteredAssessments = [{ id: assessmentId, name: assessmentName }];
      }
      if (!this.clientAssessments.find(a => a.id === assessmentId)) {
        this.clientAssessments = [...this.filteredAssessments];
      }

      if (!projectIdParam) {
        await this.resolveProjectForAssessment(assessmentId);
      }

      // 4. Definir competências pendentes ANTES de onAssessmentChange
      if (params['competencyIds']) {
        try {
          this.pendingCompetencyIds = JSON.parse(params['competencyIds']);
        } catch (e) {
          console.error('[Relatório Individual] Erro ao processar competencyIds:', e);
        }
      }

      // 5. Carregar dados da avaliação e calcular médias
      try {
        await this.onAssessmentChange();
        await this.calcularMediasPorCompetencia();
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
      } else if (projectIdParam) {
        await this.applyProjectReportTemplate(projectIdParam);
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

    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event) => {
      if (!event.urlAfterRedirects.includes('/reports')) return;
      if (!this.selectedAssessmentId || this.dataSource.length === 0) return;
      void this.applyBlockedParticipantsFilter().then(() => {
        if (this.selectedTabIndex === 2) {
          this.prewarmPreviewCache();
        }
      });
    });

    // Subscription única para seleção manual de avaliação pelo usuário
    this.assessmentControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(async id => {
        if (this.pendingQueryProjectId || this.isBatchGenerating) return;
        const loadGeneration = this.filterContextGeneration;
        this.selectedAssessmentId = id;
        if (id) {
          const ready = await this.resolveProjectForAssessment(id);
          if (loadGeneration !== this.filterContextGeneration || this.isBatchGenerating) return;
          if (ready) {
            await this.onAssessmentChange(loadGeneration);
            if (loadGeneration !== this.filterContextGeneration || this.isBatchGenerating) return;
            await this.calcularMediasPorCompetencia();
          } else if (loadGeneration === this.filterContextGeneration && !this.isBatchGenerating) {
            this.dataSource = [];
            this.avaliadosDisponiveis = [];
          }
        } else {
          this.filterProjectControl.setValue('', { emitEvent: false });
          this.projectSelectionRequired = false;
          this.projectAutoDeduced = false;
          this.projectsForAssessment = [];
          this.dataSource = [];
          this.competencias = [];
          this.mediasPorCompetencia = [];
        }
        this.cdr.markForCheck();
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
        mostrarPontuacaoSemAuto: [secao['mostrarPontuacaoSemAuto'] !== false],
        htmlBruto: [secao['htmlBruto'] === true],
        ocultarInfoDinamicaCapa: [secao['ocultarInfoDinamicaCapa'] === true],
      }));
    });
  }

  displayAssessmentName(id: string | null): string {
    if (!id) return '';
    return (
      this.clientAssessments.find(a => a.id === id)?.name ||
      this.filteredAssessments.find(a => a.id === id)?.name ||
      this.assessments.find(a => a.id === id)?.name ||
      ''
    );
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
        // Tenta name �?' surveyJSON.title �?' id (fallback final)
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

  async onAssessmentChange(expectedGeneration = this.filterContextGeneration) {
    if (!this.selectedAssessmentId) {
      this.dataSource = [];
      this.displayedColumns = [];
      this.dynamicColumns = [];
      this.questionMap = {};
      return;
    }

    // Limpar questionMap antes de recarregar
    this.questionMap = {};

    // Carregar todas as competências disponíveis
    await this.loadAllCompetencies();
    if (this.isFilterContextStale(expectedGeneration)) return;
    this.debugLog('Avaliação selecionada:', this.selectedAssessmentId, 'modo individual:', this.isIndividualMode);

    // PERFORMANCE: Monitorar tempo de carregamento
    this.performanceMonitor.startTimer('onAssessmentChange');
    if (!this.isBatchGenerating) {
      this.loadingService.show('Carregando dados da avaliação...');
    }
    this.participantsCache.clear();
    this.participantDataById.clear();
    this.blockedParticipantIds.clear();
    this.dataSource = [];
    this.displayedColumns = [];
    this.questionMap = {};
    this.viewerSnapshotLoaded = false;
    this.hasActiveSnapshot = false;

    // Limpar avaliados (em modo individual preserva a seleção definida via query params)
    this.avaliadosDisponiveis = [];
    if (!this.isIndividualMode) {
      this.selectedAvaliado = null;
      this.avaliadoControl.setValue('');
    }

    try {
    const assessmentRef = doc(this.firestore, 'assessments', this.selectedAssessmentId);
    const assessmentSnap = await getDoc(assessmentRef);
    if (this.isFilterContextStale(expectedGeneration)) return;
    if (!assessmentSnap.exists()) {
      return; // finally handles hide()
    }
    const assessmentData = assessmentSnap.data();

    const surveyJSON = assessmentData['surveyJSON'];

    if (!surveyJSON || !surveyJSON.pages) {
      return; // finally handles hide()
    }

    // Extrair questões (rows) das perguntas do surveyJSON
    const questions: any[] = [];

    surveyJSON.pages.forEach((page: any) => {
      if (page.elements) {
        page.elements.forEach((element: any) => {
          // Para elementos do tipo matrix, extrair as rows (questões)
          if ((element.type === 'matrix' || element.type === 'matrixdropdown') && element.rows && Array.isArray(element.rows)) {
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
              }
            });
          }
          // Para outros tipos de perguntas, capturar TODOS os tipos agora
          else if (element.name) {
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
          }
        });
      }
    });

    // Armazenar todas as perguntas
    this.allQuestions = questions;

    // Aplicar filtro de tipos de perguntas
    this.applyQuestionFilter();

    // Definir colunas da tabela e popular dynamicColumns
    this.displayedColumns = ['data', 'categoria', 'avaliado', 'dataAvaliacao', ...this.filteredQuestions.map(q => q.id)];
    this.dynamicColumns = this.filteredQuestions.map(q => q.id);

    this.debugLog('�Y"S DynamicColumns populado:', this.dynamicColumns);
    this.debugLog('�Y"S DisplayedColumns:', this.displayedColumns);

    // Carregar resultados
    const resultsSnap = await getDocs(collection(this.firestore, `assessments/${this.selectedAssessmentId}/results`));
    if (this.isFilterContextStale(expectedGeneration)) return;
    this.debugLog('Resultados encontrados:', resultsSnap.docs.length);

    const filterProjectId = this.filterProjectControl.value || '';

    const resultParticipantIds = resultsSnap.docs
      .map(d => d.data()['participantId'] as string)
      .filter(Boolean);
    await this.loadParticipantsForReport(filterProjectId, resultParticipantIds);
    const soleAvaliadoId = this.soleAvaliadoIdForCurrentProject || undefined;

    // Carregar assessmentLinks para identificar a qual avaliado cada avaliador pertence.
    // Em modo individual: filtrar apenas pelos links do avaliado alvo.
    // Em modo normal: carregar todos os links para setar corretamente o campo 'avaliado' dos avaliadores.
    const evaluatorIdsForTarget = new Set<string>();
    const evaluatorToAvaliadoIdMap = new Map<string, string>(); // participantId → avaliadoId
    const projectScopedLinkParticipantIds = new Set<string>();
    try {
      if (this.isIndividualMode && this.individualParticipantId) {
        const linksSnap = await getDocs(query(
          collection(this.firestore, 'assessmentLinks'),
          where('assessmentId', '==', this.selectedAssessmentId),
          where('avaliadoId', '==', this.individualParticipantId)
        ));
        linksSnap.docs.forEach(d => {
          const data = d.data();
          const linkProjectId = data['projectId'] as string | undefined;
          const pid: string = data['participantId'];
          if (!pid) return;
          if (filterProjectId) {
            if (linkProjectId && linkProjectId !== filterProjectId) return;
            if (!linkProjectId && !this.projectParticipantIdsForFilter.has(pid)) return;
          }
          evaluatorIdsForTarget.add(pid);
        });
        console.log(`[Relatório Individual] Avaliadores encontrados para ${this.individualParticipantId}:`, evaluatorIdsForTarget.size);
      } else {
        const linksQuery = filterProjectId
          ? query(
            collection(this.firestore, 'assessmentLinks'),
            where('assessmentId', '==', this.selectedAssessmentId),
            where('projectId', '==', filterProjectId)
          )
          : query(
            collection(this.firestore, 'assessmentLinks'),
            where('assessmentId', '==', this.selectedAssessmentId)
          );
        const linksSnap = await getDocs(linksQuery);
        linksSnap.docs.forEach(d => {
          const data = d.data();
          const linkProjectId = data['projectId'] as string | undefined;
          const pid: string = data['participantId'];
          if (!pid) return;
          if (filterProjectId) {
            if (linkProjectId && linkProjectId !== filterProjectId) return;
            if (!linkProjectId && !this.projectParticipantIdsForFilter.has(pid)) return;
            projectScopedLinkParticipantIds.add(pid);
          }
          const aid: string = data['avaliadoId'];
          if (aid) evaluatorToAvaliadoIdMap.set(pid, aid);
        });
      }
    } catch (e) {
      console.warn('[Relatório] Erro ao carregar assessmentLinks:', e);
    }

    const results: any[] = [];
    for (const resultDoc of resultsSnap.docs) {
      const resultData = resultDoc.data();
      this.debugLog('Resultado individual:', resultData);
      this.debugLog('Estrutura completa do resultData:', {
        keys: Object.keys(resultData),
        hasSurveyData: 'surveyData' in resultData,
        surveyDataType: resultData['surveyData'] ? typeof resultData['surveyData'] : 'undefined',
        surveyDataKeys: resultData['surveyData'] ? Object.keys(resultData['surveyData']) : [],
        participantId: resultData['participantId'],
        completedAt: resultData['completedAt']
      });

      // Buscar dados do participante (mapa autoritativo recarregado do Firestore)
      let participantData: any | null = null;
      const participantId: string = resultData['participantId'];
      if (!participantId || this.blockedParticipantIds.has(participantId)) {
        continue;
      }

      participantData = this.participantDataById.get(participantId) ?? null;
      if (!participantData) {
        const participantSnap = await getDoc(doc(this.firestore, 'participants', participantId));
        if (participantSnap.exists()) {
          participantData = participantSnap.data();
          this.participantDataById.set(participantId, participantData as Record<string, unknown>);
          this.participantsCache.set(participantId, participantData as Record<string, unknown>);
          if (participantData['blocked'] === true) {
            this.blockedParticipantIds.add(participantId);
            continue;
          }
        }
      }

      if (participantData) {
        this.debugLog('Dados do participante:', participantData);

        if (!isParticipantIncludedInReports(participantData)) {
          continue;
        }

        if (participantData['type'] === 'avaliador' && participantData['avaliadoId']) {
          evaluatorToAvaliadoIdMap.set(participantId, participantData['avaliadoId']);
        } else if (this.inferParticipantType(participantData) === 'avaliador' && participantData['avaliadoId']) {
          evaluatorToAvaliadoIdMap.set(participantId, participantData['avaliadoId']);
        }

        const participantInFilteredProject = (pid: string, pdata: Record<string, unknown>): boolean => {
          if (!filterProjectId) return true;
          if (pdata['projectId'] === filterProjectId) return true;
          if (this.projectParticipantIdsForFilter.has(pid)) return true;
          if (projectScopedLinkParticipantIds.has(pid)) return true;
          return false;
        };

        let shouldInclude = true;
        let isTargetParticipant = false;

        if (this.isIndividualMode && this.individualParticipantId) {
          if (resultData['participantId'] === this.individualParticipantId) {
            // Autoavaliação do avaliado alvo
            isTargetParticipant = true;
            shouldInclude = true;
          } else if (evaluatorIdsForTarget.has(resultData['participantId'])) {
            // Avaliador que está avaliando este avaliado específico
            shouldInclude = true;
          } else {
            // Resultado de outro avaliado ou avaliador sem vínculo com o alvo
            shouldInclude = false;
          }
        } else {
          shouldInclude = participantInFilteredProject(participantId, participantData);
        }

        if (shouldInclude) {
          const completedAtDate: Date | null = resultData['completedAt']?.toDate
            ? resultData['completedAt'].toDate()
            : null;

          let avaliadoNome: string;
          let avaliadoIdResolved: string;
          const tipoParticipante = this.inferParticipantType(participantData);
          const categoriaParticipante = this.normalizeCategory(
            participantData['category'] || participantData['categoria'] || 'N/A'
          );

          if (this.isIndividualMode && this.individualParticipantName) {
            avaliadoNome = this.individualParticipantName;
            avaliadoIdResolved = this.individualParticipantId || participantId;
          } else if (tipoParticipante === 'avaliador') {
            const avaliadoId = this.resolveEvaluatorAvaliadoId(
              participantId,
              participantData,
              filterProjectId,
              soleAvaliadoId,
              evaluatorToAvaliadoIdMap
            );
            if (avaliadoId) {
              avaliadoIdResolved = avaliadoId;
              avaliadoNome = this.getParticipantNameSync(avaliadoId);
            } else {
              avaliadoIdResolved = participantId;
              avaliadoNome = participantData['name'] || 'N/A';
            }
          } else {
            avaliadoIdResolved = participantId;
            avaliadoNome = participantData['name'] || 'N/A';
          }

          const row: any = {
            data: '',
            categoria: categoriaParticipante,
            avaliado: avaliadoNome,
            avaliadoId: avaliadoIdResolved,
            tipo: tipoParticipante,
            dataAvaliacao: completedAtDate ? completedAtDate.toLocaleDateString('pt-BR') : 'N/A',
            horarioAvaliacao: completedAtDate ? completedAtDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
            cargo: participantData['cargo'] || '',
            setor: participantData['setor'] || '',
            isTargetParticipant: isTargetParticipant,
            reportStatus: participantData['reportStatus'] || 'pending',
            participanteId: participantId,
            projectId: participantData['projectId'] || ''
          };

          // Adicionar respostas às perguntas
          if (resultData['surveyData']) {
            this.debugLog(`�Y"� Processando surveyData para participante ${participantData['name']}:`, {
              surveyDataKeys: Object.keys(resultData['surveyData']),
              surveyDataValues: resultData['surveyData'],
              questionsToProcess: questions.map(q => q.id)
            });

            questions.forEach(question => {
              let resposta: any = null;

              const matrixMatch = question.id.match(/^(pergunta\d+)_Row\s*(\d+)$/);
              if (matrixMatch) {
                const baseId = matrixMatch[1];
                const rowKey = `Row ${matrixMatch[2]}`;
                const grupoPergunta = resultData['surveyData'][baseId];
                if (grupoPergunta && typeof grupoPergunta === 'object') {
                  resposta = grupoPergunta[rowKey] ?? null;
                }
              }

              if (resposta === null || resposta === undefined) {
                resposta = resultData['surveyData'][question.id] ?? null;
              }

              row[question.id] = resposta ?? null;

              this.debugLog(`  Pergunta ${question.id}:`, {
                resposta,
                tipo: typeof resposta,
                valorFinal: row[question.id]
              });
            });
          } else {
            this.debugLog(`�O Sem surveyData para participante ${participantData['name']}:`, {
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
    if (this.isFilterContextStale(expectedGeneration)) return;
    this.dataSource = results.filter(
      row => !row.participanteId || !this.blockedParticipantIds.has(row.participanteId)
    );

    // admin_client: filtrar por reportStatus released
    if (this.currentUserRole === 'admin_client') {
      this.dataSource = this.dataSource.filter(row => row.reportStatus === 'released');
    }

    // viewer: filtrar por projectId (não por reportStatus — snapshot é o gate de acesso)
    if (this.currentUserRole === 'viewer') {
      const selectedProjectId = this.filterProjectControl.value;
      if (selectedProjectId) {
        this.dataSource = this.dataSource.filter(row =>
          !row['projectId'] || row['projectId'] === selectedProjectId
        );
      }
    }

    // Carregar avaliados disponíveis após processar os dados
    this.avaliadosDisponiveis = this.getAvaliadosDisponiveis();
    this.updateSelectedAvaliadoParticipantId();

    // Viewer/admin_client: carregar snapshot e ir direto para Visualizar
    if (!this.isIndividualMode && ['viewer', 'admin_client'].includes(this.currentUserRole)) {
      this.viewerSnapshotLoaded = false;
      this.viewerSnapshotLoaded = await this.loadSnapshotForViewer();
      this.selectedTabIndex = 2;
      this.invalidateCache();
      this.prewarmPreviewCache();
      this.cdr.markForCheck();
      return;
    }

    // Admin: auto-selecionar avaliado quando há exatamente 1
    if (!this.isIndividualMode && this.avaliadosDisponiveis.length === 1 && !this.selectedAvaliado) {
      const onlyAvaliado = this.avaliadosDisponiveis[0];
      this.avaliadoControl.setValue(onlyAvaliado, { emitEvent: false });
      this.selectedAvaliado = onlyAvaliado;
      this.updateSelectedAvaliadoParticipantId();
      this.invalidateCache();
      this.cdr.markForCheck();
    }

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
    this.invalidateCache();

    if (this.selectedTabIndex === 2) {
      await this.applyBlockedParticipantsFilter();
      this.prewarmPreviewCache();
    }

          // Debug: Verificar dados no modo individual
      if (this.isIndividualMode) {
        console.log('�Y"� DEBUG MODO INDIVIDUAL:');
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
    console.log('�Y"" Forçando detecção de mudanças...');
    console.log('�Y"" DynamicColumns final:', this.dynamicColumns);
    console.log('�Y"" QuestionMap final:', this.questionMap);

    // Forçar detecção de mudanças do Angular (markForCheck no batch evita loop de CD)
    if (this.isBatchGenerating) {
      this.cdr.markForCheck();
    } else {
      this.cdr.detectChanges();
    }

    // Verificação final
    console.log('�o. Verificação final:');
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
      if (!this.isBatchGenerating && expectedGeneration === this.filterContextGeneration) {
        this.loadingService.hide();
        this.isLoading = false;
        this.cdr.markForCheck();
      }
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

  get selectedProjectName(): string {
    return this.getFilterProjectLabel();
  }

  // Getter para obter apenas o nome do avaliado selecionado
  get selectedAvaliadoName(): string {
    return this.selectedAvaliado || 'Nenhum avaliado selecionado';
  }

  /** Substitui placeholders dinâmicos (capa, perguntas, textos do relatório). */
  substituirVariaveisRelatorio(texto: string | undefined | null): string {
    if (!texto) return '';
    const nomeAvaliado = (this.selectedAvaliado || this.individualParticipantName || '').trim();
    const dataRelatorio = this.today.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const applyNome = (value: string) =>
      value
        .replace(/\{\{\s*nome_avaliado\s*\}\}/gi, nomeAvaliado)
        .replace(/&#123;&#123;\s*nome_avaliado\s*&#125;&#125;/gi, nomeAvaliado)
        .replace(/&lcub;&lcub;\s*nome_avaliado\s*&rcub;&rcub;/gi, nomeAvaliado)
        .replace(/\$%NOME_AVALIADO\$%/g, nomeAvaliado)
        .replace(/\$%NOME_DO_AVALIADO\$%/g, nomeAvaliado)
        .replace(/\$%DATA_RELATORIO\$%/g, dataRelatorio);
    return applyNome(texto);
  }

  // Métodos utilitários para manipular as seções do relatório
  getSecoesVisiveisOrdenadas(): RelatorioSecao[] {
    return this.getCachedCalculation('secoes-visiveis', () =>
      this.relatorioConfiguracao
        .filter(secao => secao.visivel)
        .sort((a, b) => a.ordem - b.ordem)
    );
  }

  getCompetenciasParaSecaoCached(secao: RelatorioSecao): Competencia[] {
    const idsKey = (secao.competenciasIds || []).join(',');
    const cacheKey = `competencias-secao-${secao.id}-${idsKey}`;
    return this.getCachedCalculation(cacheKey, () => this.getCompetenciasSelecionadasParaSecao(secao));
  }

  getCompetenciasGraficosCached(secao: RelatorioSecao): Competencia[] {
    const idsKey = (secao.competenciasIds || []).join(',');
    const cacheKey = `competencias-graficos-${secao.id}-${idsKey}`;
    return this.getCachedCalculation(cacheKey, () => this.getCompetenciasSelecionadasParaGraficos(secao));
  }

  getDestaquesAltasCached(secao: RelatorioSecao): TabelaAvaliacoesAltas {
    const n = secao['numeroItems'] || this.competencias.length || 5;
    const cacheKey = `destaques-altas-${secao.id}-${this.selectedAssessmentId}-${this.selectedAvaliado || 'todos'}-${n}`;
    return this.getCachedCalculation(cacheKey, () => this.gerarTabelaAvaliacoesAltas(n));
  }

  getDestaquesBaixasCached(secao: RelatorioSecao): TabelaAvaliacoesAltas {
    const n = secao['numeroItems'] || this.competencias.length || 5;
    const cacheKey = `destaques-baixas-${secao.id}-${this.selectedAssessmentId}-${this.selectedAvaliado || 'todos'}-${n}`;
    return this.getCachedCalculation(cacheKey, () => this.gerarTabelaAvaliacoesBaixas(n));
  }

  getContagemRespondentesCached(): { categoria: string; quantidade: number }[] {
    const cacheKey = `contagem-respondentes-${this.selectedAssessmentId}-${this.selectedAvaliado || 'todos'}-${this.dataSource.length}`;
    return this.getCachedCalculation(cacheKey, () => this.getContagemRespondentesPorCategoria());
  }

  getJohariWindowDataCached(secao: RelatorioSecao): JohariWindowData {
    const cacheKey = `johari-data-${secao.id}-${this.selectedAssessmentId}-${this.selectedAvaliado || 'todos'}`;
    return this.getCachedCalculation(cacheKey, () => this.getJohariWindowData(secao));
  }

  getDadosGraficoCompetenciaCached(competencia: Competencia): { name: string; value: number }[] {
    const cacheKey = `grafico-comp-${competencia.id}-${this.selectedAssessmentId}-${this.selectedAvaliado || 'todos'}`;
    return this.getCachedCalculation(cacheKey, () => this.getDadosGraficoPorCompetencia(competencia));
  }

  private prewarmPreviewCache(): void {
    if (!this.dataSource.length) return;

    this.getSecoesVisiveisOrdenadas();
    this.getContagemRespondentesCached();

    this.getSecoesVisiveisOrdenadas().forEach((secao, i) => {
      switch (secao.tipo) {
        case 'destaques':
          this.getDestaquesAltasCached(secao);
          this.getDestaquesBaixasCached(secao);
          break;
        case 'tabela':
          this.getCompetenciasSelecionadasParaTabela().forEach(c => this.getTabelaCompetencia(c));
          break;
        case 'tabela_detalhada':
          this.getCompetenciasParaSecaoCached(secao).forEach(c => this.getTabelaCompetencia(c));
          break;
        case 'competencia_detalhada':
          this.getCompetenciasParaSecaoCached(secao).forEach(c => {
            this.getTabelaCompetencia(c);
            this.getDadosGraficoCompetenciaCached(c);
          });
          break;
        case 'graficos':
          this.getCompetenciasGraficosCached(secao).forEach(c => {
            this.getCompetenciaBarraComparativaData(c);
            this.getCompetenciaPieData(c);
            this.getCompetenciaStackedData(c);
          });
          if (this.getTipoGraficoControl(i)?.value === 'janela_johari') {
            this.getJohariWindowDataCached(secao);
          }
          break;
        case 'resumo':
          this.getResumoMedias();
          this.getResumoMediasPorCompetencia();
          break;
        case 'grafico_defasagem':
        case 'janela_johari':
          this.getCompetenciasParaSecaoCached(secao);
          this.getJohariWindowDataCached(secao);
          break;
        default:
          break;
      }
    });
  }

  mostrarSecao(id: string) {
    const secao = this.relatorioConfiguracao.find(s => s.id === id);
    if (secao) {
      secao.visivel = true;
      this.calculosCache.delete('secoes-visiveis');
    }
  }

  ocultarSecao(id: string) {
    const secao = this.relatorioConfiguracao.find(s => s.id === id);
    if (secao) {
      secao.visivel = false;
      this.calculosCache.delete('secoes-visiveis');
    }
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
      console.log('�o�️ EDITANDO - Conteúdo do texto do form (primeiros 1000 chars):', texto?.substring(0, 1000));
      console.log('�o�️ EDITANDO - Tipo do conteúdo:', typeof texto);
      console.log('�o�️ EDITANDO - Tamanho total:', texto?.length);
      console.log('�o�️ EDITANDO - Contém HTML:', texto?.includes('<div') || texto?.includes('<h3'));
      console.log('�o�️ EDITANDO - Contém Markdown:', texto?.includes('##') || texto?.includes('**'));
      console.log('�o�️ EDITANDO - Contém "Respondentes":', texto?.toLowerCase().includes('respondentes'));
      console.log('�o�️ EDITANDO - Contém "por Categoria":', texto?.toLowerCase().includes('por categoria'));
      console.log('�o�️ EDITANDO - Contém HTML entities:', texto?.includes('&nbsp;') || texto?.includes('&amp;') || texto?.includes('&lt;') || texto?.includes('&gt;'));

      // Verificar estrutura específica da seção de categorias
      const temH3Respondentes = /<h3[^>]*>[\s\S]*?[Rr]espondentes[\s\S]*?por[\s\S]*?[Cc]ategoria[\s\S]*?<\/h3>/i.test(texto);
      const temDivRespondentes = /<div[^>]*>[\s\S]*?[Rr]espondentes[\s\S]*?por[\s\S]*?[Cc]ategoria[\s\S]*?<\/div>/i.test(texto);
      console.log('�o�️ EDITANDO - Tem H3 com "Respondentes por Categoria":', temH3Respondentes);
      console.log('�o�️ EDITANDO - Tem DIV com "Respondentes por Categoria":', temDivRespondentes);

      // Extrair trecho onde deveria estar a seção
      const indice = texto.toLowerCase().indexOf('respondentes');
      if (indice >= 0) {
        const trecho = texto.substring(Math.max(0, indice - 100), Math.min(texto.length, indice + 800));
        console.log('�o�️ EDITANDO - Trecho encontrado (índice', indice, '):', trecho);
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

    // �Ys? PERFORMANCE: Invalidar cache quando configuração da seção muda
    this.invalidateCache(`secao-${secao.id}`);

    // Logar conteúdo após atualizar
    if (secao.tipo === 'capa') {
      console.log('�o�️ EDITANDO - Conteúdo da seção após atualizar (primeiros 500 chars):', secao.texto?.substring(0, 500));
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
  mapCategoriaToGrupo(categoria: string): string {
    if (!categoria) return 'Outros';
    const normalized = this.normalizeCategory(categoria);
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
    if (map[normalized]) return map[normalized];
    const lower = normalized.toLowerCase();
    const lowerMap: { [key: string]: string } = {
      avaliado: 'Avaliado(a)',
      'avaliado(a)': 'Avaliado(a)',
      gestor: 'Gestor(es)',
      'gestor(es)': 'Gestor(es)',
      par: 'Pares',
      pares: 'Pares',
      subordinado: 'Subordinados',
      subordinados: 'Subordinados',
      outro: 'Outros',
      outros: 'Outros',
    };
    return lowerMap[lower] || normalized;
  }

  /** ID Firestore do avaliado selecionado (para vincular respostas de avaliadores). */
  private selectedAvaliadoParticipantId: string | null = null;

  private updateSelectedAvaliadoParticipantId(): void {
    if (!this.selectedAvaliado) {
      this.selectedAvaliadoParticipantId = null;
      return;
    }
    const nomeSel = this.selectedAvaliado.trim();
    const avaliadoRow = this.dataSource.find((row) => {
      if (this.inferRowTipo(row) !== 'avaliado') return false;
      const categoria = this.normalizeCategory(row['categoria']);
      const isAvaliadoCategoria = categoria === 'Avaliado' || categoria === 'Avaliado(a)';
      return isAvaliadoCategoria && String(row['avaliado'] || '').trim() === nomeSel;
    });
    this.selectedAvaliadoParticipantId =
      avaliadoRow?.['participanteId'] || this.soleAvaliadoIdForCurrentProject || null;
  }

  /** Inclui autoavaliação e avaliadores vinculados ao avaliado selecionado. */
  private matchesSelectedAvaliado(row: Record<string, unknown>, avaliadoSelecionado: string): boolean {
    if (!avaliadoSelecionado) return true;

    const tipo = this.inferRowTipo(row);
    const nomeSel = avaliadoSelecionado.trim();
    const participanteId = String(row['participanteId'] || '');

    if (tipo === 'avaliado') {
      return String(row['avaliado'] || '').trim() === nomeSel;
    }

    const targetId = this.selectedAvaliadoParticipantId || this.soleAvaliadoIdForCurrentProject;
    if (targetId && row['avaliadoId'] === targetId) return true;

    // Projeto com único avaliado: qualquer avaliador do ciclo conta para esse avaliado
    if (
      targetId &&
      this.soleAvaliadoIdForCurrentProject === targetId &&
      participanteId &&
      this.projectParticipantIdsForFilter.has(participanteId)
    ) {
      return true;
    }

    return String(row['avaliado'] || '').trim() === nomeSel;
  }

  private resetIndividualMode(): void {
    this.isIndividualMode = false;
    this.individualParticipantId = null;
    this.individualParticipantName = null;
    this.individualTemplateId = null;
    this.individualTemplateName = null;
  }

  private getParticipantNameSync(participantId: string): string {
    const fromMap = this.participantDataById.get(participantId);
    if (fromMap) {
      return String(fromMap['name'] || 'N/A');
    }
    const fromCache = this.participantsCache.get(participantId);
    if (fromCache) {
      return String(fromCache['name'] || 'N/A');
    }
    return 'N/A';
  }

  private async resolveParticipantName(participantId: string): Promise<string> {
    const cachedName = this.getParticipantNameSync(participantId);
    if (cachedName !== 'N/A') {
      return cachedName;
    }

    try {
      const snap = await getDoc(doc(this.firestore, 'participants', participantId));
      if (snap.exists()) {
        const participantData = snap.data() as Record<string, unknown>;
        this.participantDataById.set(participantId, participantData);
        this.participantsCache.set(participantId, participantData);
        return String(participantData['name'] || 'N/A');
      }
    } catch (error) {
      console.warn(`[Relatório] Erro ao resolver nome do participante ${participantId}:`, error);
    }
    return 'N/A';
  }

  // Retorna as médias por competência e grupo de avaliadores para o bloco de Resumo
  getResumoMedias() {
    const cacheKey = `resumo-medias-${this.selectedAssessmentId}-${this.selectedAvaliado || 'todos'}-${this.dataSource.length}-${this.getBlockedCacheSuffix()}`;
    return this.getCachedCalculation(cacheKey, () => {
      const grupos = ['Avaliado(a)', 'Gestor(es)', 'Pares', 'Subordinados', 'Outros'];
      const secaoResumo = this.relatorioConfiguracao.find(s => s.tipo === 'resumo');
      if (!secaoResumo || !secaoResumo.competenciasIds?.length) {
        return [];
      }
      const competenciasSelecionadas = this.competencias.filter(c => secaoResumo.competenciasIds!.includes(c.id));

      const resultado: any[] = [];
      for (const comp of competenciasSelecionadas) {
        const perguntas = comp.perguntasIds;

        for (const grupo of grupos) {
          let soma = 0;
          let count = 0;

          // PERFORMANCE: Usar índice para buscar dados por categoria
          const indicesGrupo = this.dataIndexes.participantsByCategory.get(grupo) || [];

          for (const index of indicesGrupo) {
            const row = this.dataSource[index];
            if (!row || this.isRowFromBlockedParticipant(row)) continue;
            if (this.selectedAvaliado && !this.matchesSelectedAvaliado(row, this.selectedAvaliado)) continue;
            for (const pid of perguntas) {
              const val = parseNumeric(row[pid]);
              if (val !== null) {
                soma += val;
                count++;
              }
            }
          }

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

  // �Ys? PERFORMANCE: Métodos utilitários para gráficos dinâmicos na visualização do relatório
  private calcularMediaCompetenciaPorGrupos(competencia: Competencia, grupos: string[]): number | null {
    let somaTotal = 0;
    let contadorTotal = 0;

    grupos.forEach(grupo => {
      const media = this.getMediaPorPerguntaEGrupo(competencia, grupo);
      if (media !== null && !isNaN(media)) {
        somaTotal += media;
        contadorTotal++;
      }
    });

    return contadorTotal > 0 ? somaTotal / contadorTotal : null;
  }

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

      const mediaGeral = this.calcularMediaCompetenciaPorGrupos(comp, grupos);
      if (mediaGeral !== null) {
        result.push({
          name: `${comp.nome} - ${this.LABEL_MEDIA_GERAL}`,
          value: mediaGeral,
          competencia: comp.nome,
          grupo: this.LABEL_MEDIA_GERAL
        });
      }

      const gruposSemAuto = grupos.filter(grupo => grupo !== this.GRUPO_AVALIADO);
      const mediaSemAuto = this.calcularMediaCompetenciaPorGrupos(comp, gruposSemAuto);
      if (mediaSemAuto !== null) {
        result.push({
          name: `${comp.nome} - ${this.LABEL_MEDIA_SEM_AUTO}`,
          value: mediaSemAuto,
          competencia: comp.nome,
          grupo: this.LABEL_MEDIA_SEM_AUTO
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

    const mediaGeral = this.calcularMediaCompetenciaPorGrupos(competencia, grupos);
    if (mediaGeral !== null) {
      data.push({
        name: this.LABEL_MEDIA_GERAL,
        value: mediaGeral
      });
    }

    const gruposSemAuto = grupos.filter(grupo => grupo !== this.GRUPO_AVALIADO);
    const mediaSemAuto = this.calcularMediaCompetenciaPorGrupos(competencia, gruposSemAuto);
    if (mediaSemAuto !== null) {
      data.push({
        name: this.LABEL_MEDIA_SEM_AUTO,
        value: mediaSemAuto
      });
    }

    return data;
  }

  // Método para obter esquema de cores específico para gráfico de barras comparativo
  getSecaoBarraComparativaColorScheme(secao: any) {
    const grupos = this.getGrupos();
    const coresCategorias = this.paletasCores['categorias'].cores;
    const corMediaGeral = '#FF6B35';
    const corMediaSemAuto = '#8E24AA';

    const domain: string[] = [];

    // Cores para cada categoria
    grupos.forEach((grupo, index) => {
      domain.push(coresCategorias[index % coresCategorias.length]);
    });

    domain.push(corMediaGeral);
    domain.push(corMediaSemAuto);

    return { domain };
  }

  // Retorna as cores de cabeçalho da tabela baseadas na paleta da seção
  getTableHeaderColors(secao: any): { primary: string; secondary: string; footer: string } {
    // Usa a mesma fonte de verdade de cores da seção para respeitar
    // paletas personalizadas e seleção dinâmica do usuário.
    const domain = this.getColorSchemeParaSecao(secao)?.domain || [];
    const cores = Array.isArray(domain) && domain.length > 0
      ? domain
      : this.paletasCores['azul'].cores;

    return {
      primary:   cores[3] || cores[0] || '#1E88E5',
      secondary: cores[2] || cores[1] || cores[0] || '#42A5F5',
      footer:    cores[3] || cores[0] || '#1E88E5'
    };
  }

  getDestaquesAltasColors(secao: any): { header: string; text: string } {
    const paletaKey = secao?.['paletaCor'] || 'verde';
    if (paletaKey === 'cor_unica') {
      const cor = secao?.['corUnica'] || '#43A047';
      return { header: cor, text: cor };
    }
    const paleta = (this.paletasCores as any)[paletaKey] || this.paletasCores['verde'];
    const cores = paleta.cores;
    return { header: cores[3] || '#558B2F', text: cores[3] || '#558B2F' };
  }

  getDestaquesBaixasColors(secao: any): { header: string; text: string } {
    const paletaKey = secao?.['paletaCorBaixas'] || 'vermelho';
    if (paletaKey === 'cor_unica') {
      const cor = secao?.['corUnicaBaixas'] || '#E53935';
      return { header: cor, text: cor };
    }
    const paleta = (this.paletasCores as any)[paletaKey] || this.paletasCores['vermelho'];
    const cores = paleta.cores;
    return { header: cores[3] || '#C62828', text: cores[3] || '#C62828' };
  }

  // Método para gerar tooltip informativo para cada cor
  getCorTooltip(secao: any, index: number): string {
    const paletaSelecionada = secao?.paletaCor || secao?.['paletaCor'] || 'padrao';

    if (paletaSelecionada === 'categorias') {
      const grupos = this.getGrupos();
      const coresCategorias = this.paletasCores['categorias'].cores;

      if (index < grupos.length) {
        return `${grupos[index]}: ${coresCategorias[index % coresCategorias.length]}`;
      } else if (index === grupos.length) {
        return `${this.LABEL_MEDIA_GERAL}: #FF6B35`;
      } else if (index === grupos.length + 1) {
        return `${this.LABEL_MEDIA_SEM_AUTO}: #8E24AA`;
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

  isTipoGraficoPizza(tipoGrafico?: string): boolean {
    return tipoGrafico === 'pizza-comparativa' || tipoGrafico === 'pizza-individual';
  }

  getMediaCompetenciaNoGraficoPizza(secao: any, competencia: Competencia): number {
    const item = this.getSecaoPieData(secao).find((d: any) => d.name === competencia.nome);
    return typeof item?.value === 'number' && !isNaN(item.value) ? item.value : 0;
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

    return this.buildRadarChartOptions(indicator, seriesData, [comp.nome]);
  }

  getSecaoRadarOptions(secao: any): EChartsOption {
    const competenciasSelecionadas = this.getCompetenciasSelecionadasParaGraficos(secao);
    const grupos = this.getGrupos();

    if (competenciasSelecionadas.length === 0 || grupos.length === 0) {
      return {};
    }

    const indicator = grupos.map(grupo => ({ name: grupo, max: 5 }));

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

    return this.buildRadarChartOptions(
      indicator,
      seriesData,
      competenciasSelecionadas.map(comp => comp.nome)
    );
  }

  getRadarChartId(secao: RelatorioSecao): string {
    const labels = this.getCompetenciasGraficosCached(secao).map(c => c.nome).join('-');
    return `chart-radar-${labels.replace(/\s+/g, '-').toLowerCase() || secao.id}`;
  }

  private buildRadarChartOptions(
    indicator: { name: string; max: number }[],
    seriesData: { name: string; value: number[] }[],
    legendNames: string[]
  ): EChartsOption {
    return {
      backgroundColor: '#ffffff',
      textStyle: { color: '#333333' },
      color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272'],
      legend: {
        top: 'bottom',
        data: legendNames,
        textStyle: { color: '#333333' },
      },
      radar: {
        indicator,
        axisName: { color: '#333333' },
        splitArea: {
          areaStyle: {
            color: ['rgba(250, 250, 250, 0.8)', 'rgba(255, 255, 255, 0.8)'],
          },
        },
        axisLine: { lineStyle: { color: '#cccccc' } },
        splitLine: { lineStyle: { color: '#eeeeee' } },
      },
      series: [{
        type: 'radar' as const,
        data: seriesData,
      }],
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

    if (paletaSelecionada === 'cor_unica') {
      const cor = secao?.corUnica || secao?.['corUnica'] || '#1E88E5';
      return { domain: Array(10).fill(cor) };
    }

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

    // Combinar grupos padrão com grupos encontrados, normalizando nomenclatura
    const todosGrupos = [...new Set(
      [...gruposPadrao, ...gruposEncontrados]
        .map(grupo => this.mapCategoriaToGrupo(grupo))
        .filter(Boolean)
    )];

    return todosGrupos;
  }

  // Método auxiliar para obter característica por ID
  getCompetenciaPorId(id: string): Competencia | undefined {
    return this.competencias.find(c => c.id === id);
  }

  // Características selecionadas para a seção de gráficos
  getCompetenciasSelecionadasParaGraficos(secao: any): Competencia[] {
    const result = (!secao || !secao.competenciasIds) ? [] : this.competencias.filter(c => secao.competenciasIds.includes(c.id));
    // console.log('�Y"� getCompetenciasSelecionadasParaGraficos() - secao:', secao);
    // console.log('�Y"� getCompetenciasSelecionadasParaGraficos() - result:', result);
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
    return this.getRowsForReportCalculations()
      .filter(row => this.mapCategoriaToGrupo(row['categoria']) === grupo)
      .map(row => row[perguntaId])
      .filter(val => val !== undefined && val !== null && val !== '');
  }

  // Média para uma característica e grupo
  getMediaPorPerguntaEGrupo(carac: any, grupo: string) {
    let soma = 0;
    let count = 0;
    for (const pid of carac.perguntasIds || []) {
      for (const row of this.getRowsForReportCalculations()) {
        if (this.selectedAvaliado && !this.matchesSelectedAvaliado(row, this.selectedAvaliado)) continue;
        if (this.mapCategoriaToGrupo(row['categoria']) === grupo) {
          let valor = row[pid];

          // Aplicar o mesmo processamento usado em getRespostasParaPerguntaEGrupo
          if (typeof valor === 'string') {
            if (valor.includes('Column')) {
              // Formato: "Column 1" �?' 1
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
    const clientId = this.getReportClientId();
    if (!clientId) {
      this.snackBar.open(this.t('Selecione um cliente antes de salvar o relatório.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    // Verificar nome duplicado (escopo do cliente)
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
      clientId,
      assessmentId: this.selectedAssessmentId,
      assessmentName: assessment ? assessment.name : '',
      competencias: sanitize(this.competencias),
      configuracao: sanitize(this.relatorioConfiguracao),
      documentoConfig: sanitize(this.documentoConfig),
      templateId: this.appliedTemplateId || null,
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
    const clientId = this.getReportClientId();
    if (!clientId) {
      this.savedReports = [];
      return;
    }
    const byClientSnap = await getDocs(
      query(collection(this.firestore, 'reports'), where('clientId', '==', clientId))
    );
    const byClient = byClientSnap.docs.map(doc => ({
      id: doc.id,
      name: doc.data()['nome'] || doc.id
    }));

    // Legado: relatórios criados antes do escopo por cliente (sem clientId)
    const allSnap = await getDocs(collection(this.firestore, 'reports'));
    const legacy = allSnap.docs
      .filter(d => !d.data()['clientId'])
      .map(doc => ({ id: doc.id, name: doc.data()['nome'] || doc.id }));

    const merged = new Map<string, { id: string; name: string }>();
    [...legacy, ...byClient].forEach(r => merged.set(r.id, r));
    this.savedReports = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
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
    const clientId = this.getReportClientId();
    if (!clientId) {
      this.snackBar.open(this.t('Selecione um cliente antes de atualizar o relatório.'), this.t('Fechar'), { duration: 3000 });
      return;
    }
    const assessment = this.assessments.find(a => a.id === this.selectedAssessmentId);
    const sanitize = (val: any) => JSON.parse(JSON.stringify(val ?? []));
    const reportRef = doc(this.firestore, 'reports', this.selectedReportId.value);
    const reportData = {
      nome: nomeRelatorio,
      clientId,
      assessmentId: this.selectedAssessmentId,
      assessmentName: assessment ? assessment.name : '',
      competencias: sanitize(this.competencias),
      configuracao: sanitize(this.relatorioConfiguracao),
      documentoConfig: sanitize(this.documentoConfig),
      templateId: this.appliedTemplateId || null,
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
        if (reportData['documentoConfig']) {
          this.documentoConfig = {
            cabecalho: { ...DOCUMENTO_CONFIG_PADRAO.cabecalho, ...reportData['documentoConfig'].cabecalho },
            rodape: { ...DOCUMENTO_CONFIG_PADRAO.rodape, ...reportData['documentoConfig'].rodape }
          };
        }

        // Preencher automaticamente o nome do relatório no campo de nome
        if (reportData['nome']) {
          this.nomeRelatorioControl.setValue(reportData['nome']);
        }

        // Restaurar vínculo com template (sem re-aplicar a estrutura, pois a config já foi carregada)
        if (reportData['templateId']) {
          this.selectedTemplateId.setValue(reportData['templateId'], { emitEvent: false });
          this.appliedTemplateId = reportData['templateId'];
        } else {
          this.selectedTemplateId.setValue('', { emitEvent: false });
          this.appliedTemplateId = null;
        }

      // Logar conteúdo das seções após carregar
      const secaoCapa = this.relatorioConfiguracao.find(s => s.tipo === 'capa');
      if (secaoCapa && secaoCapa.texto) {
        const texto = secaoCapa.texto;
        console.log('�Y"� CARREGANDO - Conteúdo da capa (primeiros 1000 chars):', texto.substring(0, 1000));
        console.log('�Y"� CARREGANDO - Tipo do conteúdo:', typeof texto);
        console.log('�Y"� CARREGANDO - Tamanho total:', texto.length);
        console.log('�Y"� CARREGANDO - Contém HTML:', texto.includes('<div') || texto.includes('<h3'));
        console.log('�Y"� CARREGANDO - Contém Markdown:', texto.includes('##') || texto.includes('**'));
        console.log('�Y"� CARREGANDO - Contém "Respondentes":', texto.toLowerCase().includes('respondentes'));
        console.log('�Y"� CARREGANDO - Contém "por Categoria":', texto.toLowerCase().includes('por categoria'));
        console.log('�Y"� CARREGANDO - Contém HTML entities:', texto.includes('&nbsp;') || texto.includes('&amp;') || texto.includes('&lt;') || texto.includes('&gt;'));

        // Verificar estrutura específica
        const temH3Respondentes = /<h3[^>]*>[\s\S]*?[Rr]espondentes[\s\S]*?por[\s\S]*?[Cc]ategoria[\s\S]*?<\/h3>/i.test(texto);
        console.log('�Y"� CARREGANDO - Tem H3 com "Respondentes por Categoria":', temH3Respondentes);

        // Extrair trecho onde deveria estar a seção
        const indice = texto.toLowerCase().indexOf('respondentes');
        if (indice >= 0) {
          const trecho = texto.substring(Math.max(0, indice - 100), Math.min(texto.length, indice + 800));
          console.log('�Y"� CARREGANDO - Trecho encontrado (índice', indice, '):', trecho);
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

  private async exportReportPreviewAsPdfBlob(fileName: string): Promise<Blob> {
    const previewEl = await this.prepareReportPreviewForPdfExport();
    const { html, options } = await this.buildReportPreviewHtml(previewEl, fileName);
    return this.pdfMakeService.generateReportBlobFromHtml(html, fileName, options);
  }

  /**
   * Prepara a preview para exportação PDF (individual ou lote).
   * Garante dados, change detection (OnPush) e renderização de gráficos antes da captura HTML.
   */
  private async prepareReportPreviewForPdfExport(): Promise<HTMLElement> {
    this.prewarmPreviewCache();
    await this.calcularMediasPorCompetencia();
    this.prepareGapChartData();
    this.cdr.detectChanges();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const ready = await this.waitForReportReady(12000);
    if (!ready) {
      throw new Error('Preview do relatorio nao ficou pronta a tempo.');
    }

    const previewEl = document.getElementById('report-preview') as HTMLElement | null;
    if (!previewEl) {
      throw new Error('Pre-visualizacao do relatorio nao encontrada.');
    }

    this.refreshEchartsInPreview(previewEl);
    await this.waitForPreviewAssets(previewEl, 10000);
    return previewEl;
  }

  private refreshEchartsInPreview(previewEl: HTMLElement): void {
    window.dispatchEvent(new Event('resize'));
    previewEl.querySelectorAll('.rp-radar-chart, [echarts]').forEach(node => {
      const host = node as HTMLElement;
      const instance = getInstanceByDom(host);
      instance?.resize();
    });
  }

  private canvasHasVisibleContent(canvas: HTMLCanvasElement): boolean {
    if (canvas.width < 2 || canvas.height < 2) return false;
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const samplePoints: Array<[number, number]> = [
        [0.5, 0.5],
        [0.25, 0.25],
        [0.75, 0.75],
        [0.5, 0.15],
        [0.15, 0.5],
      ];
      for (const [rx, ry] of samplePoints) {
        const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(canvas.width * rx)));
        const y = Math.min(canvas.height - 1, Math.max(0, Math.floor(canvas.height * ry)));
        const alpha = ctx.getImageData(x, y, 1, 1).data[3];
        if (alpha > 0) return true;
      }
      return false;
    } catch {
      return canvas.offsetWidth > 10 && canvas.offsetHeight > 10;
    }
  }

  private async exportReportPreviewAsPdf(fileName: string): Promise<void> {
    const blob = await this.exportReportPreviewAsPdfBlob(fileName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async logoUrlToBase64(url: string): Promise<string> {
    if (!url) return '';
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext('2d')!.drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch { resolve(''); }
      };
      img.onerror = () => resolve('');
      img.src = url;
    });
  }

  private buildPdfHeaderTemplate(logoBase64: string): string {
    const cfg = this.documentoConfig.cabecalho;
    if (!cfg.ativo) return '<span></span>';
    const color = cfg.cor || '#666666';
    const borderBottom = cfg.linhaInferior
      ? `padding-bottom:4px;border-bottom:0.5pt solid ${color};`
      : '';
    const logoHtml = logoBase64
      ? `<img src="${logoBase64}" style="height:20px;width:auto;object-fit:contain;flex-shrink:0;">`
      : '';
    const leftParts: string[] = [];
    if (cfg.textoEsquerda) leftParts.push(cfg.textoEsquerda);
    if (cfg.mostrarNomeProjeto && this.selectedProjectName) leftParts.push(this.selectedProjectName);
    const leftText = leftParts.join(' — ');
    const pageNum = cfg.mostrarNumeroPagina
      ? `<span style="white-space:nowrap;opacity:0.75;">Pág. <span class="pageNumber"></span> / <span class="totalPages"></span></span>`
      : '';
    return `<div style="font-family:Roboto,'Helvetica Neue',sans-serif;font-size:0;color:${color};width:100%;margin:0 20px;display:flex;align-items:center;gap:8px;${borderBottom}">` +
      `<span style="font-size:9px;">${logoHtml}</span>` +
      `<span style="font-size:9px;flex:1;font-weight:500;">${leftText}</span>` +
      `<span style="font-size:9px;">${pageNum}</span>` +
      `</div>`;
  }

  private buildPdfFooterTemplate(): string {
    const cfg = this.documentoConfig.rodape;
    if (!cfg.ativo) return '<span></span>';
    const color = cfg.cor || '#666666';
    const borderTop = cfg.linhaSuperior
      ? `padding-top:4px;border-top:0.5pt solid ${color};`
      : '';
    const yearHtml = cfg.mostrarAno
      ? `<span style="white-space:nowrap;">${new Date().getFullYear()}</span>`
      : '';
    const pageNum = cfg.mostrarNumeroPagina
      ? `<span style="white-space:nowrap;opacity:0.75;">Pág. <span class="pageNumber"></span> / <span class="totalPages"></span></span>`
      : '';
    return `<div style="font-family:Roboto,'Helvetica Neue',sans-serif;font-size:0;color:${color};width:100%;margin:0 20px;display:flex;align-items:center;gap:8px;${borderTop}">` +
      `<span style="font-size:9px;flex:1;">${cfg.texto || ''}</span>` +
      (yearHtml ? `<span style="font-size:9px;">${yearHtml}</span>` : '') +
      (pageNum ? `<span style="font-size:9px;">${pageNum}</span>` : '') +
      `</div>`;
  }

  private normalizePdfPageBreaks(root: HTMLElement): void {
    const sections = Array.from(root.querySelectorAll('.report-section'));
    sections.forEach((node, index) => {
      const section = node as HTMLElement;
      if (!section.classList.contains('report-section--johari')) {
        return;
      }

      section.classList.remove('report-section--page-break-before');
      section.style.setProperty('break-before', 'auto', 'important');
      section.style.setProperty('page-break-before', 'auto', 'important');
      section.style.setProperty('break-after', 'auto', 'important');
      section.style.setProperty('page-break-after', 'auto', 'important');
      section.style.setProperty('break-inside', 'auto', 'important');
      section.style.setProperty('page-break-inside', 'auto', 'important');
      section.style.setProperty('min-height', '0', 'important');
      section.style.setProperty('max-height', 'none', 'important');
      section.style.setProperty('margin-bottom', '0', 'important');
      section.style.setProperty('display', 'block', 'important');

      const prev = sections[index - 1] as HTMLElement | undefined;
      const prevForcedBreak = !!prev?.classList.contains('report-section--page-break-after');

      if (!prevForcedBreak) {
        const breaker = document.createElement('div');
        breaker.className = 'pdf-page-break';
        breaker.setAttribute('aria-hidden', 'true');
        breaker.style.cssText =
          'display:block;height:0;margin:0;padding:0;border:0;line-height:0;overflow:hidden;' +
          'break-before:page !important;page-break-before:always !important;';
        section.parentNode?.insertBefore(breaker, section);
      }

      const inner = section.querySelector('.rp-johari-section') as HTMLElement | null;
      if (inner) {
        inner.style.setProperty('display', 'flex', 'important');
        inner.style.setProperty('flex-direction', 'column', 'important');
        inner.style.setProperty('height', '252mm', 'important');
        inner.style.setProperty('min-height', '252mm', 'important');
        inner.style.setProperty('max-height', '252mm', 'important');
        inner.style.setProperty('break-inside', 'avoid', 'important');
        inner.style.setProperty('page-break-inside', 'avoid', 'important');
        inner.style.setProperty('box-sizing', 'border-box', 'important');
      }

      const wrap = section.querySelector('.rp-johari-wrap') as HTMLElement | null;
      if (wrap) {
        wrap.style.setProperty('flex', '1 1 auto', 'important');
        wrap.style.setProperty('display', 'flex', 'important');
        wrap.style.setProperty('flex-direction', 'column', 'important');
        wrap.style.setProperty('min-height', '0', 'important');
      }

      const chartHost = section.querySelector('app-johari-window-chart') as HTMLElement | null;
      if (chartHost) {
        chartHost.style.setProperty('flex', '1 1 auto', 'important');
        chartHost.style.setProperty('display', 'flex', 'important');
        chartHost.style.setProperty('flex-direction', 'column', 'important');
        chartHost.style.setProperty('min-height', '0', 'important');
      }

      section.querySelectorAll('.johari-wrapper').forEach((wrapper) => {
        const el = wrapper as HTMLElement;
        el.style.setProperty('flex', '1 1 auto', 'important');
        el.style.setProperty('display', 'flex', 'important');
        el.style.setProperty('flex-direction', 'column', 'important');
        el.style.setProperty('min-height', '0', 'important');
        el.style.setProperty('max-width', '100%', 'important');
        el.style.setProperty('margin', '0', 'important');
      });

      section.querySelectorAll('.plot-area').forEach((plot) => {
        const el = plot as HTMLElement;
        el.style.setProperty('flex', '1 1 auto', 'important');
        el.style.setProperty('min-height', '0', 'important');
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('max-height', 'none', 'important');
        el.style.setProperty('aspect-ratio', 'unset', 'important');
        el.style.setProperty('width', '100%', 'important');
      });

      section.querySelectorAll('.legend-table').forEach((legend) => {
        const el = legend as HTMLElement;
        el.style.setProperty('flex', '0 0 auto', 'important');
        el.style.setProperty('margin-top', '8px', 'important');
      });
    });
  }

  private async buildReportPreviewHtml(
    previewEl: HTMLElement, fileName: string
  ): Promise<{ html: string; options: PdfHtmlRenderOptions }> {
    const clone = previewEl.cloneNode(true) as HTMLElement;
    this.replaceCanvasWithImages(previewEl, clone);
    this.replaceEchartsHostsWithImages(previewEl, clone);
    this.replaceNgxChartsWithSvgImages(previewEl, clone);
    this.preserveSvgDimensions(previewEl, clone);
    this.replaceReportChipsForPdf(previewEl, clone);
    clone.querySelectorAll('.ui-only').forEach(el => el.remove());
    this.normalizePdfPageBreaks(clone);

    // Remover header/footer fixos — serão substituídos pelos templates do Puppeteer
    clone.querySelector('.rp-doc-cabecalho')?.remove();
    clone.querySelector('.rp-doc-rodape')?.remove();

    // Construir templates do Puppeteer a partir de documentoConfig
    const logoBase64 = await this.logoUrlToBase64(this.documentoConfig.cabecalho.logoUrl || '');
    const headerTemplate = this.buildPdfHeaderTemplate(logoBase64);
    const footerTemplate = this.buildPdfFooterTemplate();
    const hasHeaderFooter = this.documentoConfig.cabecalho.ativo || this.documentoConfig.rodape.ativo;

    const documentStyles = this.collectDocumentStyles();
    const safeTitle = this.escapeHtml(fileName.replace(/\.pdf$/i, ''));

    const html = `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>${safeTitle}</title>\n  <base href="${window.location.origin}/">\n  <style>
    ${documentStyles}
    ${CAPA_HTML_PDF_STYLES}
    @page { size: A4 portrait; margin: 18mm 7mm 16mm 7mm; }
    * { box-sizing: border-box; print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      font-family: Roboto, "Helvetica Neue", sans-serif;
      width: auto !important;
      max-width: none !important;
    }
    #report-preview {
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
      padding-top: 0 !important;
      padding-bottom: 0 !important;
      background: #fff !important;
    }
    #report-preview > .report-section {
      width: 100% !important;
      max-width: none !important;
    }
    .report-section {
      break-inside: auto !important;
      page-break-inside: auto !important;
      margin-bottom: 4mm;
    }
    h1, h2, h3, h4, h5, h6 {
      break-after: avoid-page !important;
      page-break-after: avoid !important;
    }
    .rp-secao-header {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      break-after: avoid-page !important;
      page-break-after: avoid !important;
    }
    .pdf-page-break {
      display: block !important;
      height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      line-height: 0 !important;
      overflow: hidden !important;
      break-before: page !important;
      page-break-before: always !important;
    }
    .report-section--johari {
      break-before: auto !important;
      page-break-before: auto !important;
      break-inside: auto !important;
      page-break-inside: auto !important;
      break-after: auto !important;
      page-break-after: auto !important;
      margin-bottom: 0 !important;
      display: block !important;
    }
    .report-section--johari .rp-johari-section {
      display: flex !important;
      flex-direction: column !important;
      height: 252mm !important;
      min-height: 252mm !important;
      max-height: 252mm !important;
      width: 100% !important;
      box-sizing: border-box !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .report-section--johari .rp-secao-header {
      flex: 0 0 auto !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .report-section--johari .rp-johari-wrap {
      flex: 1 1 auto !important;
      display: flex !important;
      flex-direction: column !important;
      min-height: 0 !important;
      margin-top: 4px !important;
      width: 100% !important;
    }
    .report-section--johari app-johari-window-chart,
    .report-section--johari .johari-wrapper {
      flex: 1 1 auto !important;
      display: flex !important;
      flex-direction: column !important;
      min-height: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
    }
    .report-section--johari .x-title {
      flex: 0 0 auto !important;
    }
    .report-section--johari .plot-area {
      flex: 1 1 auto !important;
      min-height: 0 !important;
      height: auto !important;
      max-height: none !important;
      aspect-ratio: unset !important;
      width: 100% !important;
    }
    .report-section--johari .legend-table {
      flex: 0 0 auto !important;
      margin-top: 8px !important;
      width: 100% !important;
      font-size: 11px !important;
    }
    .report-section--johari .legend-table th,
    .report-section--johari .legend-table td {
      padding: 6px 8px !important;
    }
    .rp-defasagem-section,
    .rp-defasagem-preview,
    .rp-defasagem-item,
    .gap-chart-container {
      break-inside: auto !important;
      page-break-inside: auto !important;
    }
    .gap-chart-container .table-header,
    .gap-chart-container .table-row {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .gap-chart-container .table-header {
      break-after: avoid-page !important;
      page-break-after: avoid !important;
    }
    .rp-defasagem-item__title {
      break-after: avoid-page !important;
      page-break-after: avoid !important;
    }
    ngx-charts-bar-horizontal,
    .pdf-svg-chart,
    .capa-info-block {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      display: block !important;
    }
    .report-section--page-break-after + .report-section.report-section--page-break-before:not(.report-section--johari) {
      break-before: auto !important;
      page-break-before: auto !important;
    }
    .tabela-frequencia,
    .tabela-distribuicao-notas,
    .tabela-destaques {
      break-inside: auto !important;
      page-break-inside: auto !important;
    }
    .tabela-frequencia tr,
    .tabela-distribuicao-notas tr,
    .tabela-destaques tr {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    img, canvas { max-width: 100% !important; height: auto; }
    .pdf-echarts-chart,
    .rp-radar-chart img {
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      display: block !important;
    }
    svg { max-width: 100% !important; }
    .pdf-svg-chart {
      display: flex !important;
      align-items: flex-start !important;
      gap: 12px !important;
      max-width: 100% !important;
      overflow: visible !important;
    }
    .pdf-svg-chart__image {
      display: block !important;
      max-width: 100% !important;
      height: auto !important;
      object-fit: contain !important;
      flex: 0 1 auto !important;
    }
    .pdf-svg-chart__legend {
      flex: 0 0 auto !important;
      max-width: 180px !important;
      color: #0f172a !important;
    }
    table { border-collapse: collapse; max-width: 100%; }
    .tabela-frequencia,
    .tabela-distribuicao-notas,
    .tabela-destaques {
      width: 100% !important;
      max-width: 100% !important;
      table-layout: fixed !important;
    }
    .tabela-destaques th, .tabela-destaques td {
      word-break: break-word !important;
      white-space: normal !important;
    }
    #report-preview .pdf-chip-set,
    #report-preview mat-chip-set,
    #report-preview .mat-mdc-chip-set {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 6px !important;
      align-items: center !important;
    }
    #report-preview .pdf-chip,
    #report-preview mat-chip,
    #report-preview .mat-mdc-chip {
      display: inline-flex !important;
      align-items: center !important;
      gap: 7px !important;
      min-height: 26px !important;
      width: auto !important;
      max-width: 100% !important;
      padding: 5px 12px !important;
      margin: 0 !important;
      border: 0 !important;
      border-radius: 999px !important;
      background: #f1f5f9 !important;
      color: #1f2937 !important;
      box-shadow: none !important;
      font-family: Roboto, "Helvetica Neue", sans-serif !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      line-height: 1.2 !important;
      white-space: nowrap !important;
    }
    #report-preview .pdf-chip__label,
    #report-preview mat-chip .mat-mdc-chip-action-label,
    #report-preview .mat-mdc-chip .mat-mdc-chip-action-label {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      overflow: visible !important;
    }
    #report-preview .pdf-chip__icon,
    #report-preview mat-chip mat-icon,
    #report-preview .mat-mdc-chip mat-icon {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 16px !important;
      height: 16px !important;
      min-width: 16px !important;
      margin: 0 !important;
      border-radius: 999px !important;
      background: #e0f2fe !important;
      color: #0f355a !important;
      line-height: 16px !important;
      overflow: hidden !important;
    }
    #report-preview .pdf-chip__icon svg {
      width: 11px !important;
      height: 11px !important;
      display: block !important;
      fill: currentColor !important;
    }
    #report-preview mat-chip mat-icon::before,
    #report-preview .mat-mdc-chip mat-icon::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: #0f172a;
      display: block;
    }
  </style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`;

    return {
      html,
      options: {
        displayHeaderFooter: hasHeaderFooter,
        headerTemplate,
        footerTemplate,
        marginMm: { top: 18, right: 7, bottom: 16, left: 7 },
      },
    };
  }

  private collectDocumentStyles(): string {
    const inlineStyles = Array.from(document.head.querySelectorAll('style'))
      .map(style => style.innerHTML)
      .join('\n');

    const sameOriginStyles = Array.from(document.styleSheets)
      .map(sheet => {
        const href = (sheet as CSSStyleSheet).href;
        if (href && new URL(href, document.baseURI || window.location.href).origin !== window.location.origin) {
          return '';
        }

        try {
          return Array.from(sheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n');
        } catch {
          return '';
        }
      })
      .join('\n');

    return `${inlineStyles}\n${sameOriginStyles}`;
  }

  private replaceCanvasWithImages(source: HTMLElement, clone: HTMLElement): void {
    const sourceCanvases = Array.from(source.querySelectorAll('canvas')) as HTMLCanvasElement[];

    sourceCanvases.forEach(sourceCanvas => {
      if (!this.canvasHasVisibleContent(sourceCanvas)) return;

      const host = sourceCanvas.closest('.rp-radar-chart, [echarts], ngx-charts-bar-horizontal, ngx-charts-pie-chart') as HTMLElement | null;
      let clonedCanvas: HTMLCanvasElement | null = null;

      if (host?.id) {
        clonedCanvas = clone.querySelector(`#${CSS.escape(host.id)} canvas`) as HTMLCanvasElement | null;
      }
      if (!clonedCanvas) {
        const clonedCanvases = Array.from(clone.querySelectorAll('canvas')) as HTMLCanvasElement[];
        const sourceIndex = sourceCanvases.indexOf(sourceCanvas);
        clonedCanvas = clonedCanvases[sourceIndex] || null;
      }
      if (!clonedCanvas) return;

      try {
        const dataUrl = sourceCanvas.toDataURL('image/png');
        if (!dataUrl) return;

        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.width = sourceCanvas.style.width || `${sourceCanvas.offsetWidth}px`;
        img.style.height = sourceCanvas.style.height || `${sourceCanvas.offsetHeight}px`;
        img.style.maxWidth = '100%';
        img.style.display = 'block';
        clonedCanvas.parentNode?.replaceChild(img, clonedCanvas);
      } catch {
        // Se um canvas externo bloquear leitura, mantemos o canvas no HTML clonado.
      }
    });
  }

  private replaceEchartsHostsWithImages(source: HTMLElement, clone: HTMLElement): void {
    const hosts = Array.from(source.querySelectorAll('.rp-radar-chart, [echarts]')) as HTMLElement[];

    hosts.forEach(sourceHost => {
      const sourceCanvas = sourceHost.querySelector('canvas') as HTMLCanvasElement | null;
      if (!sourceCanvas || !this.canvasHasVisibleContent(sourceCanvas)) return;

      const clonedHost = sourceHost.id
        ? clone.querySelector(`#${CSS.escape(sourceHost.id)}`) as HTMLElement | null
        : null;
      if (!clonedHost) return;

      try {
        const dataUrl = sourceCanvas.toDataURL('image/png');
        if (!dataUrl) return;

        const img = document.createElement('img');
        img.src = dataUrl;
        img.className = 'pdf-echarts-chart';
        img.alt = 'Grafico radar do relatorio';
        img.style.width = sourceHost.style.width || `${sourceHost.offsetWidth || sourceCanvas.offsetWidth}px`;
        img.style.height = sourceHost.style.height || `${sourceHost.offsetHeight || sourceCanvas.offsetHeight}px`;
        img.style.maxWidth = '100%';
        img.style.display = 'block';

        clonedHost.innerHTML = '';
        clonedHost.appendChild(img);
      } catch (error) {
        console.warn('[Relatório] Nao foi possivel converter grafico ECharts para imagem.', error);
      }
    });
  }

  private replaceReportChipsForPdf(source: HTMLElement, clone: HTMLElement): void {
    const sourceChipSets = Array.from(source.querySelectorAll('mat-chip-set')) as HTMLElement[];
    const clonedChipSets = Array.from(clone.querySelectorAll('mat-chip-set')) as HTMLElement[];

    clonedChipSets.forEach((clonedSet, setIndex) => {
      const sourceSet = sourceChipSets[setIndex];
      if (!sourceSet) return;

      const sourceChips = Array.from(sourceSet.querySelectorAll('mat-chip')) as HTMLElement[];
      const replacementSet = document.createElement('div');
      replacementSet.className = 'pdf-chip-set';

      sourceChips.forEach(sourceChip => {
        const label = this.extractChipLabel(sourceChip);
        if (!label) return;

        const chip = document.createElement('span');
        chip.className = 'pdf-chip';

        const icon = document.createElement('span');
        icon.className = 'pdf-chip__icon';
        icon.innerHTML = this.getPsychologyIconSvg();

        const text = document.createElement('span');
        text.className = 'pdf-chip__label';
        text.textContent = label;

        chip.appendChild(icon);
        chip.appendChild(text);
        replacementSet.appendChild(chip);
      });

      clonedSet.parentNode?.replaceChild(replacementSet, clonedSet);
    });
  }

  private extractChipLabel(chip: HTMLElement): string {
    const clone = chip.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('mat-icon, .mat-icon, .mat-mdc-chip-avatar').forEach(el => el.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  private getPsychologyIconSvg(): string {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3a4 4 0 0 0-3.86 3H7.5A3.5 3.5 0 0 0 4 9.5c0 .63.17 1.22.47 1.73A3.5 3.5 0 0 0 6.5 17H8v2a2 2 0 0 0 2 2h2.25v-2H10v-4H6.5a1.5 1.5 0 0 1-.68-2.84l1.06-.54-.59-1.03A1.5 1.5 0 0 1 7.5 8H10V7a2 2 0 0 1 3.62-1.18l.53.73.8-.42A2 2 0 0 1 18 7.9V9h.5a1.5 1.5 0 0 1 0 3H16v2h2.5a3.5 3.5 0 0 0 1.38-6.72A4 4 0 0 0 14.7 4.1 4 4 0 0 0 12 3Z"/>
        <path d="M11 8.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm4 5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm-4.25 4.25 4.75-8 1.75 1-4.75 8-1.75-1Z"/>
      </svg>`;
  }

  private replaceNgxChartsWithSvgImages(source: HTMLElement, clone: HTMLElement): void {
    const chartSelector = 'ngx-charts-bar-horizontal, ngx-charts-pie-chart';
    const sourceCharts = Array.from(source.querySelectorAll(chartSelector)) as HTMLElement[];
    const clonedCharts = Array.from(clone.querySelectorAll(chartSelector)) as HTMLElement[];

    sourceCharts.forEach((sourceChart, index) => {
      const clonedChart = clonedCharts[index];
      if (!clonedChart) return;

      const sourceSvg = sourceChart.querySelector('svg') as SVGSVGElement | null;
      if (!sourceSvg) return;

      const svgDataUrl = this.buildSvgDataUrl(sourceSvg);
      if (!svgDataUrl) return;

      const svgRect = sourceSvg.getBoundingClientRect();
      const chartRect = sourceChart.getBoundingClientRect();
      const width = Math.max(1, Math.round(svgRect.width || chartRect.width || 800));
      const height = Math.max(1, Math.round(svgRect.height || chartRect.height || 300));

      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-svg-chart';
      wrapper.style.width = `${Math.round(chartRect.width || width)}px`;

      const img = document.createElement('img');
      img.className = 'pdf-svg-chart__image';
      img.alt = 'Grafico do relatorio';
      img.src = svgDataUrl;
      img.style.width = `${width}px`;
      img.style.height = `${height}px`;

      wrapper.appendChild(img);

      const legend = clonedChart.querySelector('.chart-legend, ngx-charts-legend');
      if (legend) {
        const legendClone = legend.cloneNode(true) as HTMLElement;
        legendClone.classList.add('pdf-svg-chart__legend');
        wrapper.appendChild(legendClone);
      }

      clonedChart.parentNode?.replaceChild(wrapper, clonedChart);
    });
  }

  private buildSvgDataUrl(sourceSvg: SVGSVGElement): string | null {
    try {
      const svgClone = sourceSvg.cloneNode(true) as SVGSVGElement;
      this.inlineSvgStyles(sourceSvg, svgClone);

      const rect = sourceSvg.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || Number(sourceSvg.getAttribute('width')) || 800));
      const height = Math.max(1, Math.round(rect.height || Number(sourceSvg.getAttribute('height')) || 300));

      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svgClone.setAttribute('width', `${width}`);
      svgClone.setAttribute('height', `${height}`);

      if (!svgClone.getAttribute('viewBox')) {
        svgClone.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }

      const serialized = new XMLSerializer().serializeToString(svgClone);
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
    } catch (error) {
      console.warn('Nao foi possivel serializar SVG do grafico para PDF.', error);
      return null;
    }
  }

  private inlineSvgStyles(sourceSvg: SVGSVGElement, svgClone: SVGSVGElement): void {
    const propertiesToCopy = [
      'fill',
      'stroke',
      'stroke-width',
      'opacity',
      'fill-opacity',
      'stroke-opacity',
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'color',
      'text-anchor',
      'dominant-baseline',
      'alignment-baseline'
    ];

    const sourceNodes = [sourceSvg, ...Array.from(sourceSvg.querySelectorAll('*'))] as Element[];
    const clonedNodes = [svgClone, ...Array.from(svgClone.querySelectorAll('*'))] as Element[];

    sourceNodes.forEach((sourceNode, nodeIndex) => {
      const clonedNode = clonedNodes[nodeIndex] as HTMLElement | SVGElement | undefined;
      if (!clonedNode) return;

      const computed = window.getComputedStyle(sourceNode);
      propertiesToCopy.forEach(property => {
        const value = computed.getPropertyValue(property);
        if (value) {
          (clonedNode as HTMLElement).style.setProperty(property, value);
        }
      });
    });
  }

  private preserveSvgDimensions(source: HTMLElement, clone: HTMLElement): void {
    const sourceSvgs = Array.from(source.querySelectorAll('svg')) as SVGSVGElement[];
    const clonedSvgs = Array.from(clone.querySelectorAll('svg')) as SVGSVGElement[];

    clonedSvgs.forEach((clonedSvg, index) => {
      const sourceSvg = sourceSvgs[index];
      if (!sourceSvg) return;

      const rect = sourceSvg.getBoundingClientRect();
      if (rect.width > 0) {
        const width = `${Math.round(rect.width)}`;
        clonedSvg.setAttribute('width', width);
        clonedSvg.style.width = `${width}px`;
      }

      if (rect.height > 0) {
        const height = `${Math.round(rect.height)}`;
        clonedSvg.setAttribute('height', height);
        clonedSvg.style.height = `${height}px`;
      }

      clonedSvg.style.overflow = 'visible';
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private async waitForPreviewAssets(previewEl?: HTMLElement, chartsTimeoutMs = 6000): Promise<void> {
    if ((document as any).fonts?.ready) {
      try {
        await (document as any).fonts.ready;
      } catch {
        // Continua mesmo se o browser nao expuser status de fontes.
      }
    }

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => setTimeout(resolve, 300));

    if (previewEl) {
      this.refreshEchartsInPreview(previewEl);
      await this.waitForReportCharts(previewEl, chartsTimeoutMs);
      await this.waitForEchartsCharts(previewEl, chartsTimeoutMs);
    }
  }

  private async waitForReportCharts(previewEl: HTMLElement, timeoutMs = 6000): Promise<void> {
    const chartHosts = Array.from(
      previewEl.querySelectorAll('ngx-charts-bar-horizontal, ngx-charts-pie-chart')
    ) as HTMLElement[];

    if (chartHosts.length === 0) return;

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const allChartsReady = chartHosts.every(chart => {
        const svg = chart.querySelector('svg') as SVGSVGElement | null;
        const rect = svg?.getBoundingClientRect();
        return Boolean(svg && rect && rect.width > 1 && rect.height > 1);
      });

      if (allChartsReady) return;

      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  }

  private async waitForEchartsCharts(previewEl: HTMLElement, timeoutMs = 6000): Promise<void> {
    const chartHosts = Array.from(
      previewEl.querySelectorAll('.rp-radar-chart, [echarts]')
    ) as HTMLElement[];

    if (chartHosts.length === 0) return;

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      this.refreshEchartsInPreview(previewEl);

      const allChartsReady = chartHosts.every(host => {
        const canvas = host.querySelector('canvas') as HTMLCanvasElement | null;
        if (!canvas) return false;
        const rect = canvas.getBoundingClientRect();
        return rect.width > 10 && rect.height > 10 && this.canvasHasVisibleContent(canvas);
      });

      if (allChartsReady) return;

      await new Promise(resolve => requestAnimationFrame(resolve));
    }

    console.warn('[Relatório] Timeout aguardando graficos ECharts na preview antes do PDF.');
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

  onDocumentoConfigChange(config: DocumentoConfig): void {
    this.documentoConfig = config;
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
      case 'janela_johari': return '#607D8B';
      case 'tabela': return '#EF5350';
      case 'tabela_detalhada': return '#00897B';
      case 'competencia_detalhada': return '#EF5350';
      case 'destaques': return '#FFCA28';
      case 'custom': return '#8D6E63';
      case 'texto': return '#78909C';
      case 'perguntas_abertas': return '#5C6BC0';
      default: return '#BDBDBD';
    }
  }

  getTipoSecaoLabel(tipo: string, tipoGrafico?: string): string {
    if (tipo === 'graficos') {
      return this.getTipoGraficoLabel(tipoGrafico);
    }

    switch (tipo) {
      case 'capa': return 'Capa';
      case 'introducao': return 'Introdução';
      case 'resumo': return 'Resumo de Competências';
      case 'grafico_defasagem': return 'Gráfico de Defasagem (Gap)';
      case 'janela_johari': return 'Janela de Johari';
      case 'tabela': return 'Tabela de Consolidação';
      case 'tabela_detalhada': return 'Tabela de Distribuição';
      case 'competencia_detalhada': return 'Tabela por Competência';
      case 'destaques': return 'Pontos de Destaque';
      case 'custom': return 'Customizado';
      case 'texto': return 'Bloco de Texto';
      case 'perguntas_abertas': return 'Perguntas Abertas';
      default: return 'Desconhecido';
    }
  }

  getTipoGraficoLabel(tipoGrafico?: string): string {
    switch (tipoGrafico) {
      case 'radar': return 'Radar Comparativo';
      case 'pizza-comparativa': return 'Pizza Comparativa';
      case 'pizza-individual': return 'Pizza Individual';
      case 'barras-individuais': return 'Barras Individuais';
      case 'janela_johari': return 'Janela de Johari';
      case 'barra':
      default: return 'Barras Comparativas';
    }
  }

  // Resetar relatório para configuração padrão
  async resetarRelatorio() {
    const confirmado = await this.confirmDialog.confirm({
      type: 'warning',
      title: 'Limpar configuração',
      message: 'Todas as seções serão restauradas para a estrutura padrão. Esta ação não pode ser desfeita.',
      confirmText: 'Sim, limpar',
      cancelText: 'Cancelar',
    });
    if (!confirmado) return;

    this.appliedTemplateId = null;
    this.selectedTemplateId.setValue('', { emitEvent: false });
    this.relatorioConfiguracao = [
      {
        id: 'capa',
        tipo: 'capa',
        titulo: 'Relatório Feedback 360°',
        texto: DEFAULT_CAPA_HTML,
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
    this.builderHasUnsavedChanges = false;
    this.snackBar.open(this.t('Relatório resetado para configuração padrão!'), this.t('Fechar'), { duration: 2500 });
    this.cdr.markForCheck();
  }

  // Salvar template no Firestore
  async salvarTemplateNoFirebase(nomeOverride?: string): Promise<boolean> {
    const nome = (nomeOverride ?? this.nomeTemplateControl.value ?? '').trim();
    if (!nome) {
      this.snackBar.open(this.t('Por favor, dê um nome ao template.'), this.t('Fechar'), { duration: 3000 });
      return false;
    }
    const clientId = this.getReportClientId();
    if (!clientId) {
      this.snackBar.open(this.t('Selecione um cliente antes de salvar o template.'), this.t('Fechar'), { duration: 3000 });
      return false;
    }
    const sanitize = (val: any) => JSON.parse(JSON.stringify(val ?? []));
    // Salvar configuração de seções com competenciasIds zerados — templates são reutilizáveis
    // entre avaliações, então não devem fixar competências de uma avaliação específica.
    const configuracaoSemCompetencias = sanitize(this.relatorioConfiguracao).map((sec: any) => ({
      ...sec,
      competenciasIds: []
    }));
    const templateData = {
      nome,
      clientId,
      configuracao: configuracaoSemCompetencias,
      documentoConfig: sanitize(this.documentoConfig),
      criadoEm: new Date()
    };
    try {
      await addDoc(collection(this.firestore, 'reportTemplates'), templateData);
      this.snackBar.open(this.t('Template salvo com sucesso!'), this.t('Fechar'), { duration: 3000 });
      this.nomeTemplateControl.reset();
      await this.carregarTemplatesSalvos();
      return true;
    } catch (e) {
      console.error('Erro ao salvar template: ', e);
      this.snackBar.open(this.t('Ocorreu um erro ao salvar o template.'), this.t('Fechar'), { duration: 3000 });
      return false;
    }
  }

  // Carregar lista de templates salvos
  async carregarTemplatesSalvos() {
    const clientId = this.getReportClientId();
    if (!clientId) {
      this.savedTemplates = [];
      return;
    }
    const byClientSnap = await getDocs(
      query(collection(this.firestore, 'reportTemplates'), where('clientId', '==', clientId))
    );
    const byClient = byClientSnap.docs.map(doc => ({
      id: doc.id,
      name: doc.data()['nome'] || doc.id
    }));

    // Legado: templates criados antes do escopo por cliente (sem clientId)
    const allSnap = await getDocs(collection(this.firestore, 'reportTemplates'));
    const legacy = allSnap.docs
      .filter(d => !d.data()['clientId'])
      .map(doc => ({ id: doc.id, name: doc.data()['nome'] || doc.id }));

    const merged = new Map<string, { id: string; name: string }>();
    [...legacy, ...byClient].forEach(t => merged.set(t.id, t));
    this.savedTemplates = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async excluirRelatorio() {
    const id = this.selectedReportId.value;
    if (!id) {
      this.snackBar.open(this.t('Selecione um relatório para excluir.'), this.t('Fechar'), { duration: 3000 });
      return;
    }
    const nome = this.savedReports.find(r => r.id === id)?.name || id;
    const confirmado = await this.confirmDialog.confirmDelete(nome);
    if (!confirmado) return;
    try {
      await deleteDoc(doc(this.firestore, 'reports', id));
      this.snackBar.open(this.t('Relatório excluído com sucesso!'), this.t('Fechar'), { duration: 3000 });
      this.selectedReportId.setValue('');
      await this.carregarRelatoriosSalvos();
    } catch {
      this.snackBar.open(this.t('Erro ao excluir relatório.'), this.t('Fechar'), { duration: 3000 });
    }
  }

  async excluirTemplate(): Promise<boolean> {
    const id = this.selectedTemplateId.value;
    if (!id) {
      this.snackBar.open(this.t('Selecione um template para excluir.'), this.t('Fechar'), { duration: 3000 });
      return false;
    }
    const nome = this.savedTemplates.find(t => t.id === id)?.name || id;
    const confirmado = await this.confirmDialog.confirmDelete(nome);
    if (!confirmado) return false;
    return this.excluirTemplatePorId(id);
  }

  private async excluirTemplatePorId(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(this.firestore, 'reportTemplates', id));
      this.snackBar.open(this.t('Template excluído com sucesso!'), this.t('Fechar'), { duration: 3000 });
      if (this.appliedTemplateId === id) {
        this.appliedTemplateId = null;
      }
      if (this.selectedTemplateId.value === id) {
        this.selectedTemplateId.setValue('');
      }
      await this.carregarTemplatesSalvos();
      this.cdr.markForCheck();
      return true;
    } catch {
      this.snackBar.open(this.t('Erro ao excluir template.'), this.t('Fechar'), { duration: 3000 });
      return false;
    }
  }

  async salvarAlteracoesNoTemplate(): Promise<void> {
    if (!this.appliedTemplateId) {
      this.snackBar.open(
        this.t('Aplique um template antes de salvar alterações.'),
        this.t('Fechar'),
        { duration: 3500 }
      );
      return;
    }
    this.selectedTemplateId.setValue(this.appliedTemplateId, { emitEvent: false });
    const ok = await this.atualizarTemplateNoFirebase();
    if (ok) {
      this.builderHasUnsavedChanges = false;
      this.cdr.markForCheck();
    }
  }

  async abrirGerenciarTemplatesDialog(): Promise<void> {
    const dialogData: ReportTemplateManageDialogData = {
      templates: [...this.savedTemplates],
      onCreate: (nome: string) => this.salvarTemplateNoFirebase(nome),
      onUpdate: (id: string) => {
        this.selectedTemplateId.setValue(id, { emitEvent: false });
        return this.atualizarTemplateNoFirebase();
      },
      onDelete: (id: string) => this.excluirTemplatePorId(id),
    };

    const ref = this.dialog.open(ReportTemplateManageDialogComponent, {
      width: '520px',
      panelClass: 'report-template-manage-dialog-panel',
      data: dialogData,
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (result?.refresh) {
      await this.carregarTemplatesSalvos();
    }
    if (result?.selectedTemplateId) {
      this.selectedTemplateId.setValue(result.selectedTemplateId);
    }
    this.cdr.markForCheck();
  }

  private async onTemplateDropdownChanged(): Promise<void> {
    if (!this.templateAutoApplyReady) return;

    const id = this.selectedTemplateId.value;
    if (!id || id === this.appliedTemplateId) return;

    const applied = await this.aplicarTemplateSelecionado();
    if (!applied) {
      this.selectedTemplateId.setValue(this.appliedTemplateId || '', { emitEvent: false });
      this.cdr.markForCheck();
    }
  }

  // Aplicar template selecionado ao relatório atual
  async aplicarTemplateSelecionado(): Promise<boolean> {
    if (!this.selectedTemplateId.value || this.applyingTemplate) return false;

    this.applyingTemplate = true;
    try {
      if (this.builderHasUnsavedChanges) {
        const confirmado = await this.confirmDialog.confirm({
          type: 'warning',
          title: 'Aplicar template',
          message: 'Isso substituirá as alterações não salvas na estrutura atual.',
          itemName: this.nomeTemplateSelecionado,
          confirmText: 'Sim, aplicar',
          cancelText: 'Cancelar',
        });
        if (!confirmado) {
          return false;
        }
      }

      const templateRef = doc(this.firestore, 'reportTemplates', this.selectedTemplateId.value);
      const templateSnap = await getDoc(templateRef);
      if (!templateSnap.exists()) {
        this.snackBar.open(this.t('Template não encontrado.'), this.t('Fechar'), { duration: 3000 });
        return false;
      }
      const templateData = templateSnap.data();
      const secoesRaw = templateData['configuracao'] || [];
      if (!Array.isArray(secoesRaw) || secoesRaw.length === 0) {
        this.snackBar.open(
          this.t('Este template não possui seções salvas. Atualize o template ou crie um novo.'),
          this.t('Fechar'),
          { duration: 4000 }
        );
        return false;
      }
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

      // Restaurar configuração de cabeçalho/rodapé do template, se existir
      if (templateData['documentoConfig']) {
        this.documentoConfig = {
          cabecalho: { ...DOCUMENTO_CONFIG_PADRAO.cabecalho, ...templateData['documentoConfig'].cabecalho } as DocumentoConfig['cabecalho'],
          rodape: { ...DOCUMENTO_CONFIG_PADRAO.rodape, ...templateData['documentoConfig'].rodape, ativo: true }
        };
      }

      this.atualizarFormArrayComConfiguracao();
      this.atualizarPerguntasBloqueadas();
      this.invalidateCache();
      this.appliedTemplateId = this.selectedTemplateId.value;
      this.builderHasUnsavedChanges = false;
      this.snackBar.open(this.t('Template aplicado!'), this.t('Fechar'), { duration: 2500 });
      this.cdr.markForCheck();
      return true;
    } finally {
      this.applyingTemplate = false;
    }
  }
  // Exportar relatório individual fiel à pré-visualização da tela.
  async exportarRelatorioPDF(): Promise<boolean> {
    if (this.isExporting) return false;

    if (!this.isDataReady()) {
      this.snackBar.open('Selecione uma avaliação antes de exportar.', this.t('Fechar'), { duration: 4000 });
      return false;
    }

    this.isExporting = true;
    this.exportingLabel = 'Gerando PDF...';
    this.cdr.markForCheck();

    try {
      const fileName = `${this.getExportBaseName()}.pdf`;
      await this.exportReportPreviewAsPdf(fileName);
      return true;
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err);
      this.snackBar.open(`Erro ao gerar PDF: ${err?.message || 'erro desconhecido'}`, this.t('Fechar'), { duration: 6000 });
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
    await this.exportarRelatorioPDF();
  }

  // Exportar relat�rio como DOCX (gera��o nativa a partir dos dados - sem html2canvas)
  async exportarRelatorioDOCX(): Promise<boolean> {
    if (this.isExporting) return false;
    this.isExporting = true;
    this.exportingLabel = 'Gerando DOCX...';
    this.cdr.markForCheck();

    try {
      const docxMod = await import('docx');
      const {
        Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        WidthType, HeadingLevel, AlignmentType, BorderStyle, PageBreak
      } = docxMod;

      const nomePart = this.individualParticipantName || this.selectedAvaliado || 'Participante';
      const grupos = this.getGrupos();
      const secoesVisiveis = [...this.relatorioConfiguracao]
        .filter((s: any) => s.visivel)
        .sort((a: any, b: any) => a.ordem - b.ordem);

      // �"?�"? helpers �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
      const hd = (text: string, level: any) => new Paragraph({ text, heading: level, spacing: { before: 300, after: 160 } });
      const p = (text: string) => new Paragraph({ children: [new TextRun({ text })], spacing: { after: 120 } });
      const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
      const hr = () => new Paragraph({
        border: { bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 } },
        spacing: { after: 200 }
      });

      const cell = (text: string, bold = false, bg = 'FFFFFF') => new TableCell({
        shading: { fill: bg, type: 'clear' as any },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, bold, size: 18 })]
        })]
      });

      const buildTable = (headers: string[], rows: string[][]): any => new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: headers.map(h => cell(h, true, '1B84FF'
            ))
          }),
          ...rows.map((row, ri) => new TableRow({
            children: row.map(v => cell(v, false, ri % 2 === 0 ? 'FFFFFF' : 'F5F8FF'))
          }))
        ]
      });

      const stripHtml = (html: string) => html ? html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : '';

      // �"?�"? CAPA �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
      const children: any[] = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 1200, after: 400 },
          children: [new TextRun({ text: 'RELATÓRIO DE AVALIAÇÃO 360°', bold: true, size: 52, color: '1B84FF' })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: nomePart, bold: true, size: 36 })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 1200 },
          children: [new TextRun({ text: `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, size: 22, color: '666666' })]
        }),
        pageBreak()
      ];

      // �"?�"? SE�?�.ES �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
      for (const secao of secoesVisiveis as any[]) {
        if (secao.titulo) {
          children.push(hd(secao.titulo, HeadingLevel.HEADING_2));
          children.push(hr());
        }

        switch (secao.tipo) {
          case 'capa':
            // já foi tratado na capa acima
            break;

          case 'texto':
          case 'introducao': {
            const texto = stripHtml(secao.texto || '');
            if (texto) children.push(p(texto));
            break;
          }

          case 'resumo':
          case 'tabela':
          case 'tabela_detalhada': {
            const comps = this.getCompetenciasSelecionadasParaSecao(secao);
            if (comps.length === 0) { children.push(p('Sem competências configuradas.')); break; }
            const headers = ['Competência', ...grupos];
            const rows = comps.map((comp: any) => [
              comp.nome,
              ...grupos.map((g: string) => {
                const v = this.getMediaPorPerguntaEGrupo(comp, g);
                return v !== null ? v.toFixed(2) : '-';
              })
            ]);
            children.push(buildTable(headers, rows));
            children.push(new Paragraph({ spacing: { after: 240 } }));
            break;
          }

          case 'graficos': {
            const comps = this.getCompetenciasSelecionadasParaSecao(secao);
            children.push(p(`Tipo de gráfico: ${secao.tipoGrafico || 'barra'}`));
            if (comps.length === 0) { children.push(p('Sem competências configuradas.')); break; }
            const headers = ['Competência', ...grupos];
            const rows = comps.map((comp: any) => [
              comp.nome,
              ...grupos.map((g: string) => {
                const v = this.getMediaPorPerguntaEGrupo(comp, g);
                return v !== null ? v.toFixed(2) : '-';
              })
            ]);
            children.push(buildTable(headers, rows));
            children.push(new Paragraph({ spacing: { after: 240 } }));
            break;
          }

          case 'competencia_detalhada': {
            const comps = this.getCompetenciasSelecionadasParaSecao(secao);
            for (const comp of comps as any[]) {
              children.push(hd(comp.nome, HeadingLevel.HEADING_3));
              if (comp.descricao) children.push(p(comp.descricao));
              const rows = grupos.map((g: string) => {
                const v = this.getMediaPorPerguntaEGrupo(comp, g);
                return [g, v !== null ? v.toFixed(2) : '-'];
              });
              children.push(buildTable(['Grupo Avaliador', 'Média'], rows));
              children.push(new Paragraph({ spacing: { after: 200 } }));
            }
            break;
          }

          case 'destaques': {
            const comps = this.getCompetenciasSelecionadasParaSecao(secao);
            const medias = comps.map((c: any) => {
              const vals = grupos.map((g: string) => this.getMediaPorPerguntaEGrupo(c, g)).filter(v => v !== null) as number[];
              const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
              return { nome: c.nome, avg };
            }).filter(x => x.avg !== null).sort((a: any, b: any) => b.avg - a.avg);
            if (medias.length) {
              children.push(hd('Pontos Fortes', HeadingLevel.HEADING_3));
              medias.slice(0, 3).forEach((m: any) => children.push(p(`• ${m.nome} — Média: ${m.avg.toFixed(2)}`)));
              children.push(hd('Oportunidades de Melhoria', HeadingLevel.HEADING_3));
              [...medias].reverse().slice(0, 3).forEach((m: any) => children.push(p(`• ${m.nome} — Média: ${m.avg.toFixed(2)}`)));
            }
            break;
          }

          case 'grafico_defasagem': {
            const perguntas = secao.perguntasIds || [];
            if (!perguntas.length) { children.push(p('Sem perguntas configuradas.')); break; }
            const rows = perguntas.map((pId: string) => {
              const titulo = this.substituirVariaveisRelatorio(this.questionMap[pId] || pId);
              const dados = this.getDadosPerguntaDefasagem(pId);
              return [
                titulo,
                dados?.selfScore !== null && dados?.selfScore !== undefined ? dados.selfScore.toFixed(2) : '-',
                dados?.othersScore !== null && dados?.othersScore !== undefined ? dados.othersScore.toFixed(2) : '-',
                dados?.gap !== null && dados?.gap !== undefined ? dados.gap.toFixed(2) : '-'
              ];
            });
            children.push(buildTable(['Pergunta', 'Auto-avaliação', 'Outros', 'Gap'], rows));
            break;
          }

          case 'perguntas_abertas': {
            const dadosAbertas = this.getPerguntasAbertasData();
            for (const item of dadosAbertas) {
              children.push(hd(item.perguntaTitulo, HeadingLevel.HEADING_3));
              const cats = this.getCategoriasOrdenadas(item.respostasPorCategoria);
              for (const cat of cats) {
                children.push(p(`${cat}:`));
                (item.respostasPorCategoria[cat] || []).forEach((r: string) => children.push(p(`  • ${r}`)));
              }
              children.push(new Paragraph({ spacing: { after: 200 } }));
            }
            break;
          }

          default:
            children.push(p(`[Seção "${secao.tipo}" não suportada no formato DOCX]`));
        }
      }

      // �"?�"? Gerar arquivo �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
      const doc = new Document({ sections: [{ properties: {}, children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.getExportFileName('docx');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.snackBar.open(this.t('DOCX exportado com sucesso!'), this.t('Fechar'), { duration: 3000 });
      return true;
    } catch (err) {
      console.error('Erro ao exportar DOCX:', err);
      this.snackBar.open(this.t('Erro ao gerar o DOCX.'), this.t('Fechar'), { duration: 3000 });
      return false;
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
    // Busca dados para uma competencia especifica
    const grupos = this.getGrupos();
    const dadosGrafico: { name: string, value: number }[] = [];

    grupos.forEach(grupo => {
      const media = this.getMediaPorPerguntaEGrupo(competencia, grupo);
      // Garantir que apenas valores validos sejam adicionados
      const valor = (media !== null && !isNaN(media)) ? media : 0;
      dadosGrafico.push({
        name: grupo,
        value: valor
      });
    });

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
    if (!this.selectedAssessmentId || !this.getRowsForReportCalculations().length) {
      return {
        competencia,
        linhas: [],
        mediasGerais: []
      };
    }

    const grupos = this.getGrupos();
    const linhas: LinhaTabela[] = [];

    competencia.perguntasIds.forEach(perguntaId => {
      const perguntaTexto = this.getQuestionTitle(perguntaId, competencia.id);
      const categorias: DadosCategoria[] = [];

      grupos.forEach(grupo => {
        const respostasGrupo = this.selectedAvaliado
          ? this.getRespostasParaPerguntaEGrupoEAvaliado(perguntaId, grupo, this.selectedAvaliado)
          : this.getRespostasParaPerguntaEGrupo(perguntaId, grupo);

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

    const mediasGerais: DadosCategoria[] = grupos.map(grupo => {
      const todasRespostasGrupo: number[] = [];

      competencia.perguntasIds.forEach(perguntaId => {
        const respostas = this.selectedAvaliado
          ? this.getRespostasParaPerguntaEGrupoEAvaliado(perguntaId, grupo, this.selectedAvaliado)
          : this.getRespostasParaPerguntaEGrupo(perguntaId, grupo);
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
    const rows = this.getRowsForReportCalculations();

    this.debugLog(`�Y"� getRespostasParaPerguntaEGrupo:`, {
      perguntaId,
      grupo,
      totalDataSource: rows.length
    });

    // Se o grupo for 'Todos', processar todos os dados
    if (grupo === 'Todos') {
      this.debugLog(`  �YO� Processando grupo 'Todos'`);
      rows.forEach((participant, index) => {
        this.debugLog(`  �Y"< Participante ${index}:`, {
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
              // Formato: "Column 1" �?' 1
              const match = valor.match(/Column (\d+)/);
              if (match) {
                valor = parseInt(match[1]);
                this.debugLog(`    �Y"" String "Column" convertida para: ${valor}`);
              }
            } else {
              // Tentar converter string diretamente para número
              valor = parseFloat(valor);
              this.debugLog(`    �Y"" String convertida para: ${valor}`);
            }
          }

          const valorNumerico = Number(valor);
          if (!isNaN(valorNumerico) && valorNumerico >= 1 && valorNumerico <= 5) {
            respostas.push(valorNumerico);
            this.debugLog(`    �z. Valor válido adicionado: ${valorNumerico}`);
          } else {
            this.debugLog(`    �O Valor inválido: ${valorNumerico} (original: "${participant[perguntaId]}")`);
          }
        } else {
          this.debugLog(`    �O Participante ${index}: sem pergunta ou participante inválido`);
        }
      });
    } else {
      // Processar grupo específico
      this.debugLog(`  �YZ� Processando grupo específico: "${grupo}"`);
      rows.forEach((participant, index) => {
        // Verificar se o participante pertence ao grupo especificado
        const categoriaParticipante = this.mapCategoriaToGrupo(participant.categoria);
        this.debugLog(`  �Y"< Participante ${index}:`, {
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
              // Formato: "Column 1" �?' 1
              const match = valor.match(/Column (\d+)/);
              if (match) {
                valor = parseInt(match[1]);
                this.debugLog(`    �Y"" String "Column" convertida para: ${valor}`);
              }
            } else {
              // Tentar converter string diretamente para número
              valor = parseFloat(valor);
              this.debugLog(`    �Y"" String convertida para: ${valor}`);
            }
          }

          const valorNumerico = Number(valor);
          if (!isNaN(valorNumerico) && valorNumerico >= 1 && valorNumerico <= 5) {
            respostas.push(valorNumerico);
            this.debugLog(`    �z. Valor válido adicionado: ${valorNumerico}`);
          } else {
            this.debugLog(`    �O Valor inválido: ${valorNumerico} (original: "${participant[perguntaId]}")`);
          }
        } else {
          if (categoriaParticipante !== grupo) {
            this.debugLog(`    �O Participante ${index}: não pertence ao grupo "${grupo}" (é "${categoriaParticipante}")`);
          } else {
            this.debugLog(`    �O Participante ${index}: sem pergunta "${perguntaId}"`);
          }
        }
      });
    }

    this.debugLog(`�Y"S Total de respostas encontradas para "${perguntaId}" no grupo "${grupo}": ${respostas.length} - [${respostas.join(', ')}]`);
    return respostas;
  }

  // Método auxiliar para obter respostas de uma pergunta específica para um grupo e avaliado específico
  private getRespostasParaPerguntaEGrupoEAvaliado(perguntaId: string, grupo: string, avaliadoSelecionado: string): number[] {
    const respostas: number[] = [];
    const rows = this.getRowsForReportCalculations();

    for (const participant of rows) {
      if (!participant) continue;

      if (grupo !== 'Todos') {
        const categoriaParticipante = this.mapCategoriaToGrupo(participant.categoria);
        if (categoriaParticipante !== grupo) continue;
      }

      if (!this.matchesSelectedAvaliado(participant, avaliadoSelecionado)) continue;
      if (participant[perguntaId] === undefined) continue;

      const valorNumerico = this.parseLikertAnswer(participant[perguntaId]);
      if (valorNumerico !== null) {
        respostas.push(valorNumerico);
      }
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
    console.group('�Y"� DEBUG AVALIA�?�.ES MAIS ALTAS');

    console.log('�Y"S Dados básicos:');
    console.log('- Total de registros:', this.dataSource.length);
    console.log('- Competências:', this.competencias.length);

    if (this.competencias.length > 0) {
      const primeiraComp = this.competencias[0];
      console.log('�Y�� Testando primeira competência:', primeiraComp.nome);
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
    console.log('�Y"< Resultado da tabela de avaliações altas:');
    console.log('- Total de items:', tabelaAltas.totalItems);
    console.log('- Items retornados:', tabelaAltas.items.length);
    console.log('- Primeiros 3 items:', tabelaAltas.items.slice(0, 3));

    console.groupEnd();
  }

  // Debug method for detailed table
  debugTabelaDetalhada(): void {
    console.group('�Y"� DEBUG TABELA DETALHADA');

    // Informações básicas
    console.log('�Y"S Dados básicos:');
    console.log('- Total de registros no dataSource:', this.dataSource.length);
    console.log('- Assessment selecionado:', this.selectedAssessmentId);
    console.log('- Competências cadastradas:', this.competencias.length);

    // Amostra dos dados
    if (this.dataSource.length > 0) {
      console.log('�Y"< Amostra dos dados (primeiro registro):');
      const sample = this.dataSource[0];
      console.log('- Estrutura do primeiro registro:', Object.keys(sample));
      console.log('- Categoria:', sample.categoria);
      console.log('- Avaliado:', sample.avaliado);
      console.log('- Exemplo de valores:', sample);
    }

    // Categorias encontradas
    const categoriasOriginais = [...new Set(this.dataSource.map(row => row.categoria))];
    const categoriasMapeadas = [...new Set(this.dataSource.map(row => this.mapCategoriaToGrupo(row.categoria)))];
    console.log('�Y��️ Categorias:');
    console.log('- Categorias originais:', categoriasOriginais);
    console.log('- Categorias mapeadas:', categoriasMapeadas);

    // Grupos retornados
    const grupos = this.getGrupos();
    console.log('Grupos retornados por getGrupos():', grupos);

    // Índices criados
    console.log('Índices criados:');
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
      console.log('�Y�� Teste com primeira competência:', comp.nome);
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
      console.log('�Y"S Tabela gerada:', tabela);
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
      const perguntaTitulo = this.substituirVariaveisRelatorio(
        this.questionMap[perguntaId] || q.title || perguntaId
      );
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
    console.group('�Y�� TESTE SIMPLES DE DADOS');

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
    const avaliado = avaliadoSelecionado || this.selectedAvaliado;

    this.competencias.forEach(competencia => {
      competencia.perguntasIds.forEach(perguntaId => {
        const medias = this.calcularMediasComportamentoDestaque(perguntaId, avaliado);
        if (!medias) return;

        items.push({
          classificacao: 0,
          comportamento: this.substituirVariaveisRelatorio(this.questionMap[perguntaId] || `Pergunta ${perguntaId}`),
          pontuacaoMediaAvaliado: medias.mediaGeral,
          pontuacaoMediaSemAutoavaliacao: medias.mediaPorCategoria,
          perguntaId,
          competenciaId: competencia.id,
        });
      });
    });

    items.sort((a, b) => b.pontuacaoMediaAvaliado - a.pontuacaoMediaAvaliado);
    items.forEach((item, index) => {
      item.classificacao = index + 1;
    });

    const limite = Math.max(1, numeroItems || this.competencias.length || 5);
    return {
      items: items.slice(0, limite),
      totalItems: items.length,
    };
  }

  // Método para gerar tabela de avaliações mais baixas
  gerarTabelaAvaliacoesBaixas(numeroItems: number = 5, avaliadoSelecionado?: string): TabelaAvaliacoesAltas {
    const items: ItemAvaliacao[] = [];
    const avaliado = avaliadoSelecionado || this.selectedAvaliado;

    this.competencias.forEach(competencia => {
      competencia.perguntasIds.forEach(perguntaId => {
        const medias = this.calcularMediasComportamentoDestaque(perguntaId, avaliado);
        if (!medias) return;

        items.push({
          classificacao: 0,
          comportamento: this.substituirVariaveisRelatorio(this.questionMap[perguntaId] || `Pergunta ${perguntaId}`),
          pontuacaoMediaAvaliado: medias.mediaGeral,
          pontuacaoMediaSemAutoavaliacao: medias.mediaPorCategoria,
          perguntaId,
          competenciaId: competencia.id,
        });
      });
    });

    items.sort((a, b) => a.pontuacaoMediaAvaliado - b.pontuacaoMediaAvaliado);
    items.forEach((item, index) => {
      item.classificacao = index + 1;
    });

    const limite = Math.max(1, numeroItems || this.competencias.length || 5);
    return {
      items: items.slice(0, limite),
      totalItems: items.length,
    };
  }

  /** Médias por pergunta/comportamento para a seção Destaques. */
  private calcularMediasComportamentoDestaque(
    perguntaId: string,
    avaliadoSelecionado?: string | null
  ): { mediaGeral: number; mediaPorCategoria: number } | null {
    const avaliado = avaliadoSelecionado || this.selectedAvaliado;

    const respostasGerais = avaliado
      ? this.getRespostasParaPerguntaEGrupoEAvaliado(perguntaId, 'Todos', avaliado)
      : this.getRespostasParaPerguntaEGrupo(perguntaId, 'Todos');

    if (respostasGerais.length === 0) return null;

    const mediaGeral =
      respostasGerais.reduce((sum, val) => sum + val, 0) / respostasGerais.length;

    const grupos = this.getGrupos();
    let somaPorCategoria = 0;
    let contadorCategorias = 0;

    grupos.forEach(grupo => {
      const respostasGrupo = avaliado
        ? this.getRespostasParaPerguntaEGrupoEAvaliado(perguntaId, grupo, avaliado)
        : this.getRespostasParaPerguntaEGrupo(perguntaId, grupo);
      if (respostasGrupo.length > 0) {
        somaPorCategoria += respostasGrupo.reduce((sum, val) => sum + val, 0) / respostasGrupo.length;
        contadorCategorias++;
      }
    });

    const mediaPorCategoria =
      contadorCategorias > 0 ? somaPorCategoria / contadorCategorias : mediaGeral;

    if (isNaN(mediaGeral) || mediaGeral <= 0) return null;

    return { mediaGeral, mediaPorCategoria };
  }

  // Método para obter média por pergunta e avaliado específico
  private getMediaPorPerguntaEAvaliadoEspecifico(competencia: Competencia, grupo: string, avaliadoSelecionado: string): number | null {
    const perguntasIds = competencia.perguntasIds;
    let soma = 0;
    let count = 0;

    perguntasIds.forEach(perguntaId => {
      const respostasGrupo = this.getRowsForReportCalculations().filter(row => {
        const grupoMapeado = this.mapCategoriaToGrupo(row['categoria']);
        return grupoMapeado === grupo && this.matchesSelectedAvaliado(row, avaliadoSelecionado);
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
    const selectedProjectId = this.filterProjectControl.value;

    this.dataSource.forEach(row => {
      const tipo = (row['tipo'] || '').toLowerCase();
      const avaliado = row['avaliado'];
      if (tipo !== 'avaliado' || !avaliado || !avaliado.trim()) return;
      // Quando projeto está selecionado, restringir ao avaliado daquele projeto
      if (selectedProjectId && row['projectId'] && row['projectId'] !== selectedProjectId) return;
      avaliados.add(avaliado.trim());
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
  async atualizarTemplateNoFirebase(): Promise<boolean> {
    if (!this.selectedTemplateId.value) {
      this.snackBar.open(this.t('Selecione um template para editar.'), this.t('Fechar'), { duration: 3000 });
      return false;
    }
    // Usa o nome do campo ou, se vazio, o nome do template já salvo
    const nomeTemplate = this.nomeTemplateControl.value
      || this.savedTemplates.find(t => t.id === this.selectedTemplateId.value)?.name
      || '';
    if (!nomeTemplate) {
      this.snackBar.open(this.t('Por favor, dê um nome ao template.'), this.t('Fechar'), { duration: 3000 });
      return false;
    }
    const clientId = this.getReportClientId();
    if (!clientId) {
      this.snackBar.open(this.t('Selecione um cliente antes de atualizar o template.'), this.t('Fechar'), { duration: 3000 });
      return false;
    }
    const templateRef = doc(this.firestore, 'reportTemplates', this.selectedTemplateId.value);
    // Sanitizar undefined antes de salvar no Firestore (JSON.parse/stringify remove undefined)
    const sanitize = (val: any) => JSON.parse(JSON.stringify(val ?? []));
    const templateData = {
      nome: nomeTemplate,
      clientId,
      configuracao: sanitize(this.relatorioConfiguracao),
      competencias: sanitize(this.competencias),
      documentoConfig: sanitize(this.documentoConfig),
      atualizadoEm: new Date()
    };
    try {
      await setDoc(templateRef, templateData, { merge: true });
      this.snackBar.open(this.t('Template atualizado com sucesso!'), this.t('Fechar'), { duration: 3000 });
      await this.carregarTemplatesSalvos();
      return true;
    } catch (e) {
      console.error('Erro ao atualizar template: ', e);
      this.snackBar.open(this.t('Ocorreu um erro ao atualizar o template.'), this.t('Fechar'), { duration: 3000 });
      return false;
    }
  }

  voltarParaLista() {
    // Voltar para a página anterior ou para a lista de participantes
    this.router.navigate(['/assessments/participants']);
  }

  // Método de debug para testar extração de questões
  debugPerguntas() {
    console.group('�Y"� DEBUG QUEST�.ES');
    console.log('DynamicColumns:', this.dynamicColumns);
    console.log('QuestionMap:', this.questionMap);
    console.log('SelectedAssessmentId:', this.selectedAssessmentId);
    console.log('Assessments:', this.assessments);

    // Debug detalhado do questionMap
    console.log('�Y"� QuestionMap detalhado:');
    Object.keys(this.questionMap).forEach(key => {
      console.log(`  ${key}: "${this.questionMap[key]}" (tipo: ${typeof this.questionMap[key]})`);
    });

    // Debug das opções do dropdown
    console.log('�Y"� Opções do dropdown:');
    this.dynamicColumns.forEach(q => {
      const title = this.questionMap[q];
      console.log(`  ${q}: "${title}" (tipo: ${typeof title})`);
    });

    console.groupEnd();
  }

  // =============================================
  // M�?TODOS PARA GERENCIAMENTO DE CLIENTES E GRUPOS DE COMPET�SNCIAS
  // =============================================

  private initClientSearch(): void {
    this.clientsFiltered = [...this.clients];
    this.clientSearchCtrl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(s => {
        const q = (s || '').toLowerCase();
        this.clientsFiltered = this.clients.filter(c => c.name.toLowerCase().includes(q));
      });
  }

  resetClientSearch(): void {
    this.clientSearchCtrl.setValue('', { emitEvent: false });
    this.clientsFiltered = [...this.clients];
  }

  async loadClients(): Promise<void> {
    try {
      const userRole = this.currentUserRole || (await this.authService.getCurrentUserRole()) || '';
      const clientsCollection = collection(this.firestore, 'clients');

      if (userRole === 'admin_client' || userRole === 'viewer') {
        const clientIds = await this.authService.getCurrentUserClientIds();
        if (clientIds.length === 0) {
          this.clients = [];
          return;
        }
        const docs = await Promise.all(
          clientIds.map(id => getDoc(doc(this.firestore, 'clients', id)))
        );
        this.clients = docs
          .filter(d => d.exists())
          .map(d => ({ id: d.id, name: d.data()!['companyName'] || 'Cliente sem nome' }));

        // Auto-seleciona o primeiro cliente vinculado
        const firstId = this.clients[0]?.id;
        if (firstId) {
          this.selectedClientId = firstId;
          this.clientControl.setValue(firstId);
          if (!this.filterClientControl.value) {
            this.filterClientControl.setValue(firstId, { emitEvent: false });
            await this.onFilterClientChange();
          } else {
            await this.loadCompetencyGroups(firstId);
          }
        }
      } else if (userRole === 'admin_master') {
        const clientsSnapshot = await getDocs(clientsCollection);
        this.clients = clientsSnapshot.docs.map((d) => ({
          id: d.id,
          name: d.data()['companyName'] || 'Cliente sem nome',
        }));
      } else {
        this.clients = [];
      }
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

  // ── Geração em Lote ─────────────────────────────────────────────

  toggleBatchPanel(): void {
    this.batchPanelOpen = !this.batchPanelOpen;
    if (this.batchPanelOpen) {
      this.batchSelectedParticipants = new Set(this.avaliadosDisponiveis);
      this.buildAvailableCategoriesForBatch();
    }
  }

  toggleBatchParticipant(name: string): void {
    if (this.batchSelectedParticipants.has(name)) {
      this.batchSelectedParticipants.delete(name);
    } else {
      this.batchSelectedParticipants.add(name);
    }
    this.buildAvailableCategoriesForBatch();
    this.cdr.detectChanges();
  }

  get batchSelectedCount(): number {
    return this.batchSelectedParticipants.size;
  }

  get allBatchSelected(): boolean {
    return this.avaliadosDisponiveis.length > 0 &&
      this.avaliadosDisponiveis.every(a => this.batchSelectedParticipants.has(a));
  }

  toggleAllBatchParticipants(): void {
    if (this.allBatchSelected) {
      this.batchSelectedParticipants.clear();
    } else {
      this.batchSelectedParticipants = new Set(this.avaliadosDisponiveis);
    }
    this.buildAvailableCategoriesForBatch();
    this.cdr.detectChanges();
  }

  buildAvailableCategoriesForBatch(): void {
    const countMap = new Map<string, number>();
    for (const avaliado of this.batchSelectedParticipants) {
      for (const row of this.dataSource) {
        if (row['avaliado'] !== avaliado) continue;
        const grupo = this.mapCategoriaToGrupo(row['categoria']);
        if (grupo === 'Avaliado(a)') continue;
        countMap.set(grupo, (countMap.get(grupo) || 0) + 1);
      }
    }
    this.availableCategoriesForBatch = Array.from(countMap.entries())
      .map(([grupo, totalCount]) => ({ grupo, totalCount }))
      .sort((a, b) => a.grupo.localeCompare(b.grupo, 'pt-BR'));
  }

  toggleBatchCategoryExclusion(grupo: string): void {
    if (this.batchExcludedCategories.has(grupo)) {
      this.batchExcludedCategories.delete(grupo);
    } else {
      this.batchExcludedCategories.add(grupo);
    }
    this.cdr.detectChanges();
  }

  isCategoryExcluded(grupo: string): boolean {
    return this.batchExcludedCategories.has(grupo);
  }

  getAnonymityWarnings(): { avaliado: string; grupo: string; count: number }[] {
    const warnings: { avaliado: string; grupo: string; count: number }[] = [];
    for (const avaliado of this.batchSelectedParticipants) {
      const countMap = new Map<string, number>();
      for (const row of this.dataSource) {
        if (row['avaliado'] !== avaliado) continue;
        const grupo = this.mapCategoriaToGrupo(row['categoria']);
        if (grupo === 'Avaliado(a)') continue;
        if (!this.batchExcludedCategories.has(grupo)) {
          countMap.set(grupo, (countMap.get(grupo) || 0) + 1);
        }
      }
      for (const [grupo, count] of countMap.entries()) {
        if (count > 0 && count < this.ANONYMITY_THRESHOLD) {
          warnings.push({ avaliado, grupo, count });
        }
      }
    }
    return warnings;
  }

  async generateBatchReports(): Promise<void> {
    if (this.isBatchGenerating || this.batchSelectedParticipants.size === 0) return;
    if (!this.selectedAssessmentId || this.competencias.length === 0) {
      this.snackBar.open(
        this.t('Configure as competências antes de gerar relatórios em lote.'),
        this.t('Fechar'),
        { duration: 4000 }
      );
      return;
    }

    this.isBatchGenerating = true;
    this.batchErrors = [];
    const participants = Array.from(this.batchSelectedParticipants);
    this.batchTotal = participants.length;
    this.batchProgress = 0;
    this.cdr.detectChanges();

    const originalDataSource = this.dataSource;
    const originalSelectedAvaliado = this.selectedAvaliado;

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (let i = 0; i < participants.length; i++) {
        const avaliado = participants[i];
        this.batchProgress = i;
        this.batchCurrentName = avaliado;
        this.cdr.detectChanges();
        await new Promise(r => setTimeout(r, 0)); // yield to UI

        try {
          this.selectedAvaliado = avaliado;

          if (this.batchExcludedCategories.size > 0) {
            this.dataSource = originalDataSource.filter(row => {
              if (row['avaliado'] !== avaliado) return true;
              const grupo = this.mapCategoriaToGrupo(row['categoria']);
              return !this.batchExcludedCategories.has(grupo);
            });
          } else {
            this.dataSource = originalDataSource;
          }

          this.updateSelectedAvaliadoParticipantId();
          this.createDataIndexes();
          this.invalidateCache();

          const filename = `${this.getExportBaseName()}.pdf`;
          const blob = await this.exportReportPreviewAsPdfBlob(filename);
          zip.file(filename, blob);
        } catch (err: any) {
          this.batchErrors.push({ name: avaliado, error: err?.message || 'Erro desconhecido' });
        }
      }

      this.batchProgress = participants.length;
      this.cdr.detectChanges();

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const assessmentName = (this.assessments.find(a => a.id === this.selectedAssessmentId)?.name || 'relatorios')
        .replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const zipFilename = `relatorios-${assessmentName}.zip`;
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      const successCount = participants.length - this.batchErrors.length;
      this.snackBar.open(
        this.batchErrors.length > 0
          ? `${successCount} relatório(s) gerado(s). ${this.batchErrors.length} erro(s).`
          : `${successCount} relatório(s) empacotados em ${zipFilename}!`,
        this.t('Fechar'),
        { duration: 6000 }
      );
    } catch (err: any) {
      console.error('Erro na geração em lote:', err);
      this.snackBar.open(
        `Erro na geração em lote: ${err?.message || 'Erro desconhecido'}`,
        this.t('Fechar'),
        { duration: 5000 }
      );
    } finally {
      this.dataSource = originalDataSource;
      this.selectedAvaliado = originalSelectedAvaliado;
      this.invalidateCache();
      this.isBatchGenerating = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Geração em lote usando html2canvas + jsPDF (PDF de imagem).
   * Não usa PDFMake nem abre diálogos de impressão — renderiza o DOM
   * de cada avaliado, captura como imagem e monta o PDF página a página.
   */
  async generateBatchReportsPDF(): Promise<void> {
    if (this.isBatchGenerating || this.batchSelectedParticipants.size === 0) return;
    if (!this.selectedAssessmentId || this.competencias.length === 0) {
      this.snackBar.open(this.t('Configure as competências antes de gerar relatórios em lote.'), this.t('Fechar'), { duration: 4000 });
      return;
    }

    this.isBatchGenerating = true;
    this.batchErrors = [];
    const participants = Array.from(this.batchSelectedParticipants);
    this.batchTotal = participants.length;
    this.batchProgress = 0;
    this.cdr.detectChanges();

    const originalAvaliado = this.selectedAvaliado;
    const originalDataSource = this.dataSource;
    let iframe: HTMLIFrameElement | null = null;

    try {
      // ── Fase 1: capturar o HTML de cada participante ────────────────────────
      // Usa o mesmo processo do exportarRelatorioPDF: clona o #report-preview,
      // converte <canvas> em <img> e remove elementos de UI.
      const htmlBlocks: string[] = [];

      for (let i = 0; i < participants.length; i++) {
        const avaliado = participants[i];
        this.batchProgress = i;
        this.batchCurrentName = avaliado;

        // Aplica filtro de categorias se houver exclusões
        this.selectedAvaliado = avaliado;
        if (this.batchExcludedCategories.size > 0) {
          this.dataSource = originalDataSource.filter(row => {
            if (row['avaliado'] !== avaliado) return true;
            return !this.batchExcludedCategories.has(this.mapCategoriaToGrupo(row['categoria']));
          });
        } else {
          this.dataSource = originalDataSource;
        }
        this.invalidateCache();
        this.cdr.detectChanges();
        // Aguarda DOM + gráficos renderizarem
        await new Promise(r => setTimeout(r, 800));

        try {
          const previewEl = document.getElementById('report-preview');
          if (!previewEl) throw new Error('Elemento #report-preview não encontrado');

          // Converter <canvas> → <img> (canvas não é clonável via cloneNode)
          const canvases = Array.from(previewEl.querySelectorAll('canvas')) as HTMLCanvasElement[];
          const canvasDataUrls = canvases.map(c => {
            try { return c.toDataURL('image/jpeg', 0.92); } catch { return ''; }
          });

          const clone = previewEl.cloneNode(true) as HTMLElement;
          Array.from(clone.querySelectorAll('canvas')).forEach((clonedCanvas, j) => {
            const dataUrl = canvasDataUrls[j];
            if (!dataUrl) return;
            const img = document.createElement('img');
            img.src = dataUrl;
            img.style.width  = canvases[j].style.width  || `${canvases[j].offsetWidth}px`;
            img.style.height = canvases[j].style.height || `${canvases[j].offsetHeight}px`;
            img.style.maxWidth = '100%';
            img.style.display = 'block';
            clonedCanvas.parentNode?.replaceChild(img, clonedCanvas);
          });

          clone.querySelectorAll('.ui-only').forEach(el => el.remove());
          this.normalizePdfPageBreaks(clone);

          htmlBlocks.push(clone.innerHTML);
        } catch (err: any) {
          this.batchErrors.push({ name: avaliado, error: err?.message || 'Erro desconhecido' });
        }
      }

      if (htmlBlocks.length === 0) {
        this.snackBar.open('Nenhum relatório pôde ser capturado.', this.t('Fechar'), { duration: 4000 });
        return;
      }

      this.batchProgress = participants.length;
      this.cdr.detectChanges();

      // ── Fase 2: montar único iframe com todos os relatórios ────────────────
      // Idêntico ao exportarRelatorioPDF — mesmos estilos, mesma estrutura.
      // Cada participante é separado por page-break-after para o browser
      // paginar corretamente ao imprimir/salvar como PDF.
      const angularStyles = Array.from(document.head.querySelectorAll('style'))
        .map(s => s.innerHTML).join('\n');
      const linkTags = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'))
        .map(l => l.outerHTML).join('\n');

      const combinedBody = htmlBlocks.map((html, idx) => {
        const isLast = idx === htmlBlocks.length - 1;
        return `<div class="rp-batch-report"${isLast ? '' : ' style="page-break-after:always;"'}>${html}</div>`;
      }).join('\n');

      iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:0;left:0;width:210mm;height:1px;border:none;opacity:0;pointer-events:none;';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument!;
      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base href="${window.location.origin}/">
  ${linkTags}
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
    body { margin: 0; padding: 0; font-family: Roboto, "Helvetica Neue", sans-serif; background: #fff; width: 186mm; }
    .rp-batch-report {
      width: 100%;
      box-shadow: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      zoom: 0.82;
    }
    .report-section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 4mm; }
    h1 { font-size: 1.5em !important; margin: 3mm 0 2mm !important; }
    h2 { font-size: 1.2em !important; margin: 2mm 0 1.5mm !important; }
    h3 { font-size: 1.05em !important; margin: 2mm 0 1mm !important; }
    p  { margin: 1.5mm 0 !important; }
    td, th { padding: 4px 8px !important; }
    table { border-collapse: collapse; }
    img, svg { max-width: 100% !important; height: auto; }
    ${angularStyles}
  </style>
</head>
<body>
  ${combinedBody}
  <script>
    (function scaleOverflowingTables() {
      var bodyWidth = document.body.offsetWidth;
      document.querySelectorAll('table').forEach(function(table) {
        var natural = table.scrollWidth;
        if (natural <= bodyWidth + 2) return;
        var scale    = bodyWidth / natural;
        var origH    = table.offsetHeight;
        var wrap = document.createElement('div');
        wrap.style.cssText = 'width:100%;overflow:hidden;display:block;';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
        table.style.transformOrigin = 'top left';
        table.style.transform       = 'scale(' + scale + ')';
        table.style.marginBottom    = (origH * (scale - 1)) + 'px';
      });
    })();
  <\/script>
</body>
</html>`);
      iframeDoc.close();

      // ── Fase 3: imprimir ────────────────────────────────────────────────────
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            window.removeEventListener('afterprint', finish);
            try { iframe!.contentWindow?.removeEventListener('afterprint', finish); } catch {}
            clearTimeout(safetyTimer);
            resolve();
          };
          window.addEventListener('afterprint', finish);
          try { iframe!.contentWindow?.addEventListener('afterprint', finish); } catch {}
          const safetyTimer = setTimeout(finish, 5 * 60 * 1000);
          iframe!.contentWindow?.focus();
          iframe!.contentWindow?.print();
        }, 600);
      });

      const ok = htmlBlocks.length;
      this.snackBar.open(
        this.batchErrors.length > 0
          ? `${ok} relatório(s) impressos. ${this.batchErrors.length} erro(s).`
          : `${ok} relatório(s) prontos — salve como PDF na janela de impressão!`,
        this.t('Fechar'),
        { duration: 6000 }
      );
    } catch (err: any) {
      console.error('Erro na geração em lote:', err);
      this.snackBar.open(`Erro: ${err?.message || 'desconhecido'}`, this.t('Fechar'), { duration: 5000 });
    } finally {
      if (iframe && document.body.contains(iframe)) document.body.removeChild(iframe);
      this.selectedAvaliado = originalAvaliado;
      this.dataSource = originalDataSource;
      this.invalidateCache();
      this.isBatchGenerating = false;
      this.cdr.detectChanges();
    }
  }

  // ── Filtros de Cliente/Projeto no topo ─────────────────────────

  private registerAssessmentProjectLink(assessmentId: string, projectId: string): void {
    if (!assessmentId || !projectId) return;
    const existing = this.assessmentProjectsMap.get(assessmentId) || [];
    if (!existing.includes(projectId)) {
      existing.push(projectId);
      this.assessmentProjectsMap.set(assessmentId, existing);
    }
  }

  private async loadClientAssessmentsAndProjectMap(clientId: string): Promise<void> {
    this.assessmentProjectsMap.clear();
    this.filterProjects.forEach(p => {
      if (p.assessmentId) {
        this.registerAssessmentProjectLink(p.assessmentId, p.id);
      }
    });

    const assessmentsSnap = await getDocs(
      query(collection(this.firestore, 'assessments'), where('clientId', '==', clientId))
    );
    this.clientAssessments = assessmentsSnap.docs
      .map(d => ({
        id: d.id,
        name: d.data()['name'] || d.data()['surveyJSON']?.['title'] || d.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    assessmentsSnap.docs.forEach(d => {
      const projectId = d.data()['projectId'] as string | undefined;
      if (projectId && this.filterProjects.some(p => p.id === projectId)) {
        this.registerAssessmentProjectLink(d.id, projectId);
      }
      const entry = { id: d.id, name: d.data()['name'] || d.data()['surveyJSON']?.['title'] || d.id };
      if (!this.assessments.find(a => a.id === entry.id)) {
        this.assessments.push(entry);
      }
    });

    this.filteredAssessments = [...this.clientAssessments];
  }

  private getProjectsForAssessment(assessmentId: string): { id: string; name: string }[] {
    const ids = new Set<string>(this.assessmentProjectsMap.get(assessmentId) || []);
    this.filterProjects.forEach(p => {
      if (p.assessmentId === assessmentId) {
        ids.add(p.id);
      }
    });
    return this.filterProjects.filter(p => ids.has(p.id));
  }

  /** Deduz o projeto a partir da avaliação selecionada. */
  private async resolveProjectForAssessment(assessmentId: string): Promise<boolean> {
    const candidates = this.getProjectsForAssessment(assessmentId);
    this.projectsForAssessment = candidates;

    if (candidates.length === 0) {
      this.projectSelectionRequired = false;
      this.projectAutoDeduced = false;
      this.filterProjectControl.setValue('', { emitEvent: false });
      this.snackBar.open(
        this.t('Nenhum projeto ativo utiliza esta avaliação.'),
        this.t('Fechar'),
        { duration: 4000 }
      );
      return false;
    }

    if (candidates.length === 1) {
      this.projectSelectionRequired = false;
      this.projectAutoDeduced = true;
      this.filterProjectControl.setValue(candidates[0].id, { emitEvent: false });
      return true;
    }

    this.projectAutoDeduced = false;
    const current = this.filterProjectControl.value;
    if (current && candidates.some(c => c.id === current)) {
      this.projectSelectionRequired = false;
      return true;
    }

    this.projectSelectionRequired = true;
    this.filterProjectControl.setValue('', { emitEvent: false });
    if (!this.isBatchGenerating) {
      this.snackBar.open(
        this.t('Esta avaliação existe em mais de um projeto — selecione o ciclo desejado.'),
        this.t('Fechar'),
        { duration: 4500 }
      );
    }
    return false;
  }

  async onFilterClientChange(): Promise<void> {
    const loadGeneration = this.filterContextGeneration;
    const clientId = this.filterClientControl.value;
    this.filterProjectControl.setValue('');
    this.filterProjects = [];
    this.selectedClientId = clientId || null;
    this.selectedReportId.setValue('', { emitEvent: false });
    this.selectedTemplateId.setValue('', { emitEvent: false });
    this.projectSelectionRequired = false;
    this.projectAutoDeduced = false;
    this.projectsForAssessment = [];
    this.clientAssessments = [];

    // Limpa avaliação ao mudar de cliente
    this.assessmentControl.setValue('', { emitEvent: false });
    this.assessmentSearchControl.setValue('', { emitEvent: false });
    this.filteredAssessments = [];

    if (!clientId) {
      this.savedReports = [];
      this.savedTemplates = [];
      this.competencyGroups = [];
      return;
    }

    try {
      await Promise.all([
        this.carregarRelatoriosSalvos(),
        this.carregarTemplatesSalvos(),
        this.loadCompetencyGroups(clientId),
      ]);

      const projectsSnap = await getDocs(
        query(collection(this.firestore, 'projects'), where('clientId', '==', clientId))
      );
      this.filterProjects = projectsSnap.docs
        .filter(d => !['Cancelado', 'Inativo'].includes(d.data()['status'] || ''))
        .map(d => ({
          id: d.id,
          name: d.data()['name'] || '—',
          assessmentId: d.data()['assessmentId'] || undefined,
          reportTemplateId: d.data()['reportTemplateId'] || undefined,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      if (this.currentUserRole === 'viewer' && this.viewerProjectIds.size > 0) {
        this.filterProjects = this.filterProjects.filter((project) =>
          this.viewerProjectIds.has(project.id)
        );
      }

      // Monta mapa projectId → assessmentId
      this.allAssessmentsByProject.clear();
      this.filterProjects.forEach(p => {
        if (p.assessmentId) this.allAssessmentsByProject.set(p.id, p.assessmentId);
      });

      await this.loadClientAssessmentsAndProjectMap(clientId);

      if (
        this.clientAssessments.length === 1 &&
        !this.pendingQueryProjectId &&
        !this.isBatchGenerating
      ) {
        const only = this.clientAssessments[0];
        this.assessmentSearchControl.setValue(only.name, { emitEvent: false });
        if (loadGeneration === this.filterContextGeneration) {
          this.assessmentControl.setValue(only.id);
        }
      }

      if (loadGeneration !== this.filterContextGeneration) return;
      this.cdr.markForCheck();
    } catch (e) {
      console.error('Erro ao carregar projetos para filtro:', e);
    }
  }

  getFilterClientLabel(): string {
    return this.clients.find(c => c.id === this.filterClientControl.value)?.name || '';
  }

  getFilterProjectLabel(): string {
    return this.filterProjects.find(p => p.id === this.filterProjectControl.value)?.name || '';
  }

  /** Fecha painéis mat-select cujo overlay pode ficar preso após *ngIf destruir o componente. */
  private dismissOpenSelectOverlays(): void {
    document.querySelectorAll('.cdk-overlay-backdrop').forEach(node => {
      (node as HTMLElement).click();
    });
  }

  clearFilterContext(): void {
    this.filterContextGeneration++;
    this.dismissOpenSelectOverlays();
    this.loadingService.reset();
    this.isLoading = false;

    this.filterClientControl.setValue('', { emitEvent: false });
    this.filterProjectControl.setValue('', { emitEvent: false });
    this.filterProjects = [];
    this.filteredAssessments = [];
    this.clientAssessments = [];
    this.projectsForAssessment = [];
    this.projectSelectionRequired = false;
    this.projectAutoDeduced = false;
    this.assessmentProjectsMap.clear();
    this.selectedAssessmentId = '';
    this.selectedClientId = null;
    this.dataSource = [];
    this.displayedColumns = [];
    this.dynamicColumns = [];
    this.avaliadosDisponiveis = [];
    this.selectedAvaliado = null;
    this.competencias = [];
    this.mediasPorCompetencia = [];
    this.savedReports = [];
    this.savedTemplates = [];
    this.competencyGroups = [];
    this.assessmentControl.setValue('', { emitEvent: false });
    this.assessmentSearchControl.setValue('', { emitEvent: false });
    this.avaliadoControl.setValue('', { emitEvent: false });
    this.invalidateCache();

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });

    this.cdr.markForCheck();
  }

  /** Usuário escolheu o projeto quando há ambiguidade (vários ciclos). */
  async onFilterProjectChange(): Promise<void> {
    const projectId = this.filterProjectControl.value;
    if (!projectId) {
      this.cdr.markForCheck();
      return;
    }

    this.projectAutoDeduced = false;

    const assessmentId = this.assessmentControl.value;
    if (assessmentId) {
      const candidates = this.getProjectsForAssessment(assessmentId);
      if (candidates.length > 0 && !candidates.some(c => c.id === projectId)) {
        this.snackBar.open(
          this.t('Este projeto não utiliza a avaliação selecionada.'),
          this.t('Fechar'),
          { duration: 3500 }
        );
        this.filterProjectControl.setValue('', { emitEvent: false });
        this.cdr.markForCheck();
        return;
      }
      this.projectSelectionRequired = false;
      this.selectedAssessmentId = assessmentId;
      await this.onAssessmentChange();
      await this.calcularMediasPorCompetencia();
    }

    await this.applyProjectReportTemplate(projectId);

    this.cdr.markForCheck();
  }

  /** Pré-seleciona o template de relatório vinculado ao projeto (campo opcional). */
  private async applyProjectReportTemplate(projectId: string): Promise<void> {
    if (!projectId) return;

    let reportTemplateId = this.filterProjects.find(p => p.id === projectId)?.reportTemplateId;
    if (!reportTemplateId) {
      try {
        const projectDoc = await getDoc(doc(this.firestore, 'projects', projectId));
        if (projectDoc.exists()) {
          reportTemplateId = projectDoc.data()['reportTemplateId'] || undefined;
        }
      } catch (e) {
        console.error('[Relatório] Erro ao carregar template do projeto:', e);
        return;
      }
    }

    if (!reportTemplateId) return;

    this.selectedTemplateId.setValue(reportTemplateId, { emitEvent: false });
    try {
      await this.aplicarTemplateSelecionado();
    } catch (e) {
      console.error('[Relatório] Erro ao aplicar template do projeto:', e);
    }
  }

  /** Inicializa filtros e dados a partir do projeto (ex.: botão Gerar Relatório na lista). */
  private async initializeReportFromProject(projectId: string, templateIdParam?: string): Promise<void> {
    const project = this.filterProjects.find(p => p.id === projectId);
    if (!project?.assessmentId) {
      this.filterProjectControl.setValue(projectId, { emitEvent: false });
      return;
    }

    this.filterProjectControl.setValue(projectId, { emitEvent: false });
    this.projectAutoDeduced = true;
    this.projectSelectionRequired = false;
    this.projectsForAssessment = this.getProjectsForAssessment(project.assessmentId);

    this.selectedAssessmentId = project.assessmentId;
    this.assessmentControl.setValue(project.assessmentId, { emitEvent: false });

    const assessmentName = await this.resolveAssessmentName(project.assessmentId);
    this.assessmentSearchControl.setValue(assessmentName, { emitEvent: false });

    if (!this.filteredAssessments.find(a => a.id === project.assessmentId)) {
      this.filteredAssessments = [
        ...this.filteredAssessments,
        { id: project.assessmentId, name: assessmentName },
      ];
    }

    try {
      await this.onAssessmentChange();
      await this.calcularMediasPorCompetencia();
    } catch (e) {
      console.error('[Relatório] Erro ao carregar dados do projeto:', e);
    }

    if (templateIdParam) {
      this.selectedTemplateId.setValue(templateIdParam, { emitEvent: false });
      try {
        await this.aplicarTemplateSelecionado();
      } catch (e) {
        console.error('[Relatório] Erro ao aplicar template informado:', e);
      }
    } else {
      await this.applyProjectReportTemplate(projectId);
    }

    this.fillCompetenciasInReportSections();
  }

  /** Preenche competências nas seções do relatório a partir das competências carregadas. */
  private fillCompetenciasInReportSections(): void {
    if (!this.competencias.length) return;
    const compIds = this.competencias.map(c => c.id);
    this.relatorioConfiguracao.forEach(sec => {
      if (['resumo', 'graficos', 'tabela', 'tabela_detalhada', 'grafico_defasagem', 'competencia_detalhada'].includes(sec.tipo)) {
        sec.competenciasIds = [...compIds];
      }
    });
    this.atualizarFormArrayComConfiguracao();
    this.invalidateCache();
  }

  /** Executa exportação solicitada pelo modal de projetos (query param exportAction). */
  private async executeProjectExportAction(action: string): Promise<void> {
    this.fillCompetenciasInReportSections();
    this.selectedTabIndex = 2;
    this.cdr.markForCheck();

    if (action === 'excelBase') {
      if (!this.dataSource.length) {
        this.snackBar.open(this.t('Sem dados para exportar.'), this.t('Fechar'), { duration: 3500 });
        return;
      }
      this.exportarBaseExcel();
      this.returnToProjectsIfRequested();
      return;
    }

    if (!this.avaliadosDisponiveis.length) {
      this.snackBar.open(
        this.t('Nenhum avaliado com respostas para exportar neste projeto.'),
        this.t('Fechar'),
        { duration: 4000 }
      );
      return;
    }

    if (this.competencias.length === 0) {
      this.snackBar.open(
        this.t('Configure as competências antes de gerar relatórios.'),
        this.t('Fechar'),
        { duration: 4000 }
      );
      return;
    }

    await this.waitForReportReady(8000);

    const avaliado = this.avaliadosDisponiveis[0];
    this.selectedAvaliado = avaliado;
    this.avaliadoControl.setValue(avaliado, { emitEvent: false });
    this.invalidateCache();

    if (action === 'individualPdf') {
      const ok = await this.exportarRelatorioPDF();
      if (ok) this.returnToProjectsIfRequested();
      return;
    }

    if (action === 'batchPdf') {
      // Geração em lote PDF desabilitada nesta versão.
      this.snackBar.open(
        'Exportação em lote de PDF temporariamente indisponível.',
        this.t('Fechar'),
        { duration: 4000 }
      );
      return;
      /*
      this.batchSelectedParticipants = new Set(this.avaliadosDisponiveis);
      await this.generateBatchReports();
      return;
      */
    }

    if (action === 'docx') {
      const ok = await this.exportarRelatorioDOCX();
      if (ok) this.returnToProjectsIfRequested();
    }
  }

  /** Volta à lista de projetos após exportação iniciada em Projetos → Gerar Relatório. */
  private returnToProjectsIfRequested(): void {
    if (this.projectExportReturnTo !== 'projects') return;
    this.projectExportReturnTo = null;
    setTimeout(() => {
      void this.router.navigate(['/projects']);
    }, 1500);
  }

  /** Exporta PDFs de vários projetos do mesmo cliente em um único ZIP. */
  private parseProjectTemplateMap(param: string | undefined): Map<string, string> {
    const map = new Map<string, string>();
    if (!param) return map;

    param.split('|').forEach(pair => {
      const separatorIndex = pair.indexOf(':');
      if (separatorIndex <= 0) return;
      const projectId = pair.slice(0, separatorIndex);
      const templateId = pair.slice(separatorIndex + 1);
      if (projectId && templateId) {
        map.set(projectId, templateId);
      }
    });

    return map;
  }

  private clearClientBatchQueryParams(): void {
    this.suppressQueryParamsHandler = true;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        exportAction: null,
        projectIds: null,
        projectTemplates: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    }).finally(() => {
      queueMicrotask(() => {
        this.suppressQueryParamsHandler = false;
      });
    });
  }

  private async executeClientBatchPdfExport(
    projectIds: string[],
    templateByProject: Map<string, string>
  ): Promise<void> {
    if (this.isBatchGenerating) return;

    this.isBatchGenerating = true;
    this.batchErrors = [];
    this.batchTotal = projectIds.length;
    this.batchProgress = 0;
    this.batchCurrentName = '';
    this.selectedTabIndex = 2;
    this.loadingService.show('Gerando relatórios em ZIP...');
    this.cdr.markForCheck();

    const originalDataSource = this.dataSource;
    const originalSelectedAvaliado = this.selectedAvaliado;
    let generatedCount = 0;

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (let p = 0; p < projectIds.length; p++) {
        const projectId = projectIds[p];
        const project = this.filterProjects.find(item => item.id === projectId);
        const projectLabel = project?.name || projectId;
        this.batchProgress = p;
        this.batchCurrentName = projectLabel;
        this.cdr.markForCheck();
        await new Promise(r => setTimeout(r, 0));

        try {
          const templateId = templateByProject.get(projectId);
          if (!templateId) {
            this.batchErrors.push({
              name: projectLabel,
              error: this.t('Template não selecionado para o projeto.'),
            });
            continue;
          }

          await this.initializeReportFromProject(projectId, templateId);
          this.fillCompetenciasInReportSections();

          if (!this.avaliadosDisponiveis.length || this.competencias.length === 0) {
            this.batchErrors.push({
              name: projectLabel,
              error: this.t('Sem avaliados ou competências configuradas.'),
            });
            continue;
          }

          const projectDataSource = [...this.dataSource];
          const folderName = this.sanitizeFileNamePart(projectLabel, 'Projeto');

          for (const avaliado of this.avaliadosDisponiveis) {
            this.selectedAvaliado = avaliado;
            this.avaliadoControl.setValue(avaliado, { emitEvent: false });
            this.dataSource = projectDataSource;
            this.updateSelectedAvaliadoParticipantId();
            this.createDataIndexes();
            this.invalidateCache();

            const filename = `${this.getExportBaseName()}.pdf`;
            const blob = await this.exportReportPreviewAsPdfBlob(filename);
            zip.file(`${folderName}/${filename}`, blob);
            generatedCount++;
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : this.t('Erro desconhecido');
          this.batchErrors.push({ name: projectLabel, error: message });
        }
      }

      if (generatedCount === 0) {
        this.snackBar.open(
          this.t('Nenhum relatório gerado para os projetos selecionados.'),
          this.t('Fechar'),
          { duration: 5000 }
        );
        return;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const clientName = this.sanitizeFileNamePart(this.getClientName(), 'Cliente');
      const zipFilename = `${clientName}-relatorios-${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipFilename;
      a.click();
      URL.revokeObjectURL(url);

      this.snackBar.open(
        this.batchErrors.length
          ? this.t('{{count}} PDF(s) gerados. {{errors}} projeto(s) com falha.')
              .replace('{{count}}', String(generatedCount))
              .replace('{{errors}}', String(this.batchErrors.length))
          : this.t('{{count}} relatório(s) empacotados em {{file}}!')
              .replace('{{count}}', String(generatedCount))
              .replace('{{file}}', zipFilename),
        this.t('Fechar'),
        { duration: 6000 }
      );
    } finally {
      this.dataSource = originalDataSource;
      this.selectedAvaliado = originalSelectedAvaliado;
      this.updateSelectedAvaliadoParticipantId();
      this.createDataIndexes();
      this.invalidateCache();
      this.isBatchGenerating = false;
      this.batchProgress = this.batchTotal;
      this.loadingService.hide();
      this.clearClientBatchQueryParams();
      this.cdr.markForCheck();
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

  private async loadViewerProjectIds(): Promise<void> {
    this.viewerProjectIds.clear();
    const email = await this.authService.getCurrentUserEmail();
    if (!email) return;

    const usersSnap = await getDocs(
      query(collection(this.firestore, 'users'), where('email', '==', email))
    );
    if (usersSnap.empty) return;

    const userDocId = usersSnap.docs[0].id;
    const userData = usersSnap.docs[0].data() || {};
    const isOnNewStructure = 'groups' in userData;

    // Fonte principal: grupos onde o viewer aparece em userIds
    const groupsSnap = await getDocs(
      query(collection(this.firestore, 'userGroups'), where('userIds', 'array-contains', userDocId))
    );

    const allProjectsClientIds = new Set<string>();
    groupsSnap.forEach(snap => {
      const data = snap.data();
      if (data['allProjects'] === true && data['clientId']) {
        allProjectsClientIds.add(data['clientId']);
      } else {
        const projectIds: string[] = data['projectIds'] || [];
        projectIds.forEach(id => this.viewerProjectIds.add(id));
      }
    });

    // Para grupos com allProjects: buscar todos os projetos do cliente
    if (allProjectsClientIds.size > 0) {
      const allClientsArr = [...allProjectsClientIds];
      const projSnap = await getDocs(
        query(collection(this.firestore, 'projects'), where('clientId', 'in', allClientsArr))
      );
      projSnap.forEach(d => this.viewerProjectIds.add(d.id));
    }

    // Fallback legado: APENAS se o usuário nunca foi migrado para grupos
    if (!isOnNewStructure && this.viewerProjectIds.size === 0) {
      const fromArray = Array.isArray(userData['projects']) ? userData['projects'] : [];
      const fromSingle = typeof userData['project'] === 'string' && userData['project'].trim()
        ? [userData['project']] : [];
      [...fromArray, ...fromSingle].forEach(id => this.viewerProjectIds.add(id));
    }
  }

  // Sistema de liberação de relatórios
  getParticipantIdByName(participantName: string): string | null {
    const participant = this.dataSource.find(row => row.avaliado === participantName);
    return participant?.participanteId || null;
  }

  async releaseReport(avaliadoName: string): Promise<void> {
    if (!this.canReleaseReport) {
      this.snackBar.open(this.t('Apenas administradores podem liberar relatórios.'), this.t('Fechar'), { duration: 3000 });
      return;
    }
    if (!avaliadoName) {
      this.snackBar.open(this.t('Avaliado inválido para liberação do relatório.'), this.t('Fechar'), { duration: 3000 });
      return;
    }
    const clientId = this.getReportClientId();
    if (!clientId) {
      this.snackBar.open(this.t('Selecione um cliente antes de publicar o relatório.'), this.t('Fechar'), { duration: 3000 });
      return;
    }
    if (!this.selectedAssessmentId) {
      this.snackBar.open(this.t('Selecione uma avaliação antes de publicar o relatório.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    try {
      // Marcar participantes do avaliado (deste projeto) como released
      const selectedProjectId = this.filterProjectControl.value;
      const rows = this.dataSource.filter(r =>
        r.avaliado === avaliadoName &&
        (!selectedProjectId || !r['projectId'] || r['projectId'] === selectedProjectId)
      );
      await Promise.all(rows.map(r =>
        updateDoc(doc(this.firestore, 'participants', r.participanteId), { reportStatus: 'released' })
      ));

      // Snapshot vinculado ao cliente (reutilizável entre projetos do mesmo cliente)
      const sanitize = (val: any) => JSON.parse(JSON.stringify(val ?? []));
      const snapshotId = this.buildReleasedSnapshotId(clientId, this.selectedAssessmentId, avaliadoName);
      await setDoc(doc(this.firestore, `releasedReports/${snapshotId}`), {
        clientId,
        assessmentId: this.selectedAssessmentId,
        avaliadoName,
        releasedAt: new Date(),
        revoked: false,
        competencias: sanitize(this.competencias),
        configuracao: sanitize(this.relatorioConfiguracao),
        documentoConfig: sanitize(this.documentoConfig),
      });

      // Registrar a assinatura publicada (base para detectar futuras alterações)
      this.publishedSignature = this.computeReportSignature();
      this.hasActiveSnapshot = true;

      // Atualizar o dataSource localmente
      this.dataSource = this.dataSource.map(row =>
        row.avaliado === avaliadoName ? { ...row, reportStatus: 'released' } : row
      );

      this.snackBar.open(this.t('Relatório publicado com sucesso.'), this.t('Fechar'), { duration: 3000 });
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Erro ao publicar relatório:', error);
      this.snackBar.open(this.t('Erro ao publicar relatório.'), this.t('Fechar'), { duration: 3000 });
    }
  }

  /** Para viewer/admin_client: busca snapshot por cliente + assessmentId. */
  private async loadSnapshotForViewer(): Promise<boolean> {
    if (!this.selectedAssessmentId) return false;
    const clientId = this.getReportClientId();
    const preferredNames = this.avaliadosDisponiveis.length > 0
      ? this.avaliadosDisponiveis
      : (this.selectedAvaliado ? [this.selectedAvaliado] : []);

    const applySnapshotData = (data: any) => {
      this.competencias = data['competencias'] || [];
      this.relatorioConfiguracao = data['configuracao'] || [];
      this.documentoConfig = data['documentoConfig']
        ? { ...DOCUMENTO_CONFIG_PADRAO, ...data['documentoConfig'] }
        : { ...DOCUMENTO_CONFIG_PADRAO };
      if (data['avaliadoName']) {
        this.selectedAvaliado = data['avaliadoName'];
        this.avaliadoControl.setValue(data['avaliadoName'], { emitEvent: false });
      }
      this.atualizarFormArrayComConfiguracao();
      this.cdr.markForCheck();
    };

    try {
      const qSnap = await getDocs(query(
        collection(this.firestore, 'releasedReports'),
        where('assessmentId', '==', this.selectedAssessmentId)
      ));

      const candidates = qSnap.docs
        .map(d => d.data())
        .filter(data => {
          if (!data || data['revoked'] === true) return false;
          if (clientId && data['clientId'] && data['clientId'] !== clientId) return false;
          if (!data['clientId'] && !this.snapshotMatchesScope(data)) return false;
          if (preferredNames.length > 0 && data['avaliadoName'] && !preferredNames.includes(data['avaliadoName'])) {
            return false;
          }
          return true;
        });

      if (candidates.length === 0) return false;

      const candidate = preferredNames.length === 1
        ? candidates.find(c => c['avaliadoName'] === preferredNames[0]) || candidates[0]
        : candidates[0];

      applySnapshotData(candidate);
      return true;
    } catch {
      return false;
    }
  }

  /** Marca/desmarca como revogado TODOS os snapshots de um avaliado (corta acesso do viewer). */
  private async markSnapshotRevoked(avaliadoName: string, revoked: boolean): Promise<void> {
    if (!this.selectedAssessmentId || !avaliadoName) return;
    const clientId = this.getReportClientId();
    const projectId = this.filterProjectControl.value;
    const refsToUpdate = new Map<string, any>();

    try {
      const qSnap = await getDocs(query(
        collection(this.firestore, 'releasedReports'),
        where('assessmentId', '==', this.selectedAssessmentId),
        where('avaliadoName', '==', avaliadoName)
      ));
      qSnap.docs.forEach(d => {
        if (this.snapshotMatchesScope(d.data())) {
          refsToUpdate.set(d.id, d.ref);
        }
      });
    } catch { /* ignora */ }

    const safeKey = avaliadoName.replace(/[^a-zA-Z0-9À-ÿ]/g, '_');
    const candidateIds = [
      clientId ? `${clientId}_${this.selectedAssessmentId}_${safeKey}` : null,
      projectId ? `${this.selectedAssessmentId}_${projectId}_${safeKey}` : null,
      `${this.selectedAssessmentId}_${safeKey}`,
    ].filter(Boolean) as string[];
    for (const id of candidateIds) {
      if (!refsToUpdate.has(id)) {
        try {
          const ref = doc(this.firestore, `releasedReports/${id}`);
          const snap = await getDoc(ref);
          if (snap.exists()) refsToUpdate.set(id, ref);
        } catch { /* ignora */ }
      }
    }

    await Promise.all([...refsToUpdate.values()].map(ref => updateDoc(ref, { revoked })));
  }

  private async loadReleasedReportSnapshot(avaliadoName: string): Promise<boolean> {
    if (!this.selectedAssessmentId || !avaliadoName) return false;
    const safeKey = avaliadoName.replace(/[^a-zA-Z0-9À-ÿ]/g, '_');
    const clientId = this.getReportClientId();
    const projectId = this.filterProjectControl.value;
    const projectPart = projectId ? `_${projectId}` : '';

    const applySnapshotData = (data: any) => {
      this.competencias = data['competencias'] || [];
      this.relatorioConfiguracao = data['configuracao'] || [];
      this.documentoConfig = data['documentoConfig']
        ? { ...DOCUMENTO_CONFIG_PADRAO, ...data['documentoConfig'] }
        : { ...DOCUMENTO_CONFIG_PADRAO };
      this.atualizarFormArrayComConfiguracao();
      this.cdr.markForCheck();
    };

    try {
      // Formato atual: cliente + formulário + avaliado
      if (clientId) {
        const clientSnap = await getDoc(
          doc(this.firestore, `releasedReports/${clientId}_${this.selectedAssessmentId}_${safeKey}`)
        );
        if (clientSnap.exists() && clientSnap.data()?.['revoked'] !== true) {
          applySnapshotData(clientSnap.data());
          return true;
        }
      }

      // Legado: chave com projeto
      let snap = await getDoc(doc(this.firestore, `releasedReports/${this.selectedAssessmentId}${projectPart}_${safeKey}`));

      // Legado: chave sem projeto
      if (!snap.exists() && projectId) {
        snap = await getDoc(doc(this.firestore, `releasedReports/${this.selectedAssessmentId}_${safeKey}`));
      }

      if (!snap.exists()) {
        const q = query(
          collection(this.firestore, 'releasedReports'),
          where('assessmentId', '==', this.selectedAssessmentId),
          where('avaliadoName', '==', avaliadoName)
        );
        const qSnap = await getDocs(q);
        const match = qSnap.docs.find(d => this.snapshotMatchesScope(d.data()));
        if (match) {
          applySnapshotData(match.data());
          return true;
        }
        return false;
      }

      applySnapshotData(snap.data() as any);
      return true;
    } catch {
      return false;
    }
  }

  async revokeReportRelease(avaliadoName: string): Promise<void> {
    if (!this.canReleaseReport) {
      this.snackBar.open(this.t('Apenas administradores podem revogar liberação.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    try {
      // Revogar TODOS os participantes do avaliado (deste projeto)
      const selectedProjectId = this.filterProjectControl.value;
      const rows = this.dataSource.filter(r =>
        r.avaliado === avaliadoName &&
        (!selectedProjectId || !r['projectId'] || r['projectId'] === selectedProjectId)
      );
      await Promise.all(rows.map(r =>
        updateDoc(doc(this.firestore, 'participants', r.participanteId), { reportStatus: 'pending' })
      ));

      // Marcar o snapshot como revogado para cortar o acesso do viewer
      await this.markSnapshotRevoked(avaliadoName, true);
      this.hasActiveSnapshot = false;

      // Atualizar o dataSource localmente
      this.dataSource = this.dataSource.map(row =>
        row.avaliado === avaliadoName ? { ...row, reportStatus: 'pending' } : row
      );

      this.snackBar.open(this.t('Liberação de relatório revogada.'), this.t('Fechar'), { duration: 3000 });
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Erro ao revogar liberação:', error);
      this.snackBar.open(this.t('Erro ao revogar liberação.'), this.t('Fechar'), { duration: 3000 });
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

        // Carregar perguntas custom por competência (inclui formatos legados)
        this.customQuestionsByCompetency = this.competencyQuestionsService.normalizeCustomQuestionsByCompetency(groupData);
        this.competencyQuestionsService.populateQuestionMapFromCustom(this.customQuestionsByCompetency, this.questionMap);

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
    if (this.currentUserRole === 'viewer' && index < 2) return;
    this.selectedTabIndex = index;
    if (index === 2) {
      void this.applyBlockedParticipantsFilter().then(() => {
        this.prewarmPreviewCache();
        this.cdr.markForCheck();
      });
      return;
    }
    this.cdr.markForCheck();
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
      // Monta mapa de assessmentId �?' nome para exibição
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

  isSecaoHtmlBruto(index: number): boolean {
    const secao = this.relatorioConfiguracao[index];
    return !!secao && secaoSuportaHtmlBruto(secao.tipo) && secao['htmlBruto'] === true;
  }

  secaoSuportaModoHtml(tipo: string | undefined): boolean {
    return secaoSuportaHtmlBruto(tipo);
  }

  setSecaoHtmlBruto(index: number, htmlBruto: boolean): void {
    const secao = this.relatorioConfiguracao[index];
    if (!secao || !secaoSuportaHtmlBruto(secao.tipo)) return;
    secao['htmlBruto'] = htmlBruto;
    if (htmlBruto && secao.tipo === 'capa') {
      secao['ocultarInfoDinamicaCapa'] = true;
    }
    this.atualizarSecaoConfiguracao(index);
  }

  shouldShowCapaInfoBlock(secao: RelatorioSecao): boolean {
    if (secao['ocultarInfoDinamicaCapa'] === true || secao['htmlBruto'] === true) {
      return false;
    }
    return !!(this.selectedAvaliado || this.getContagemRespondentesCached().length > 0);
  }

  // Método para aplicar template rico à seção
  // Método para obter contagem de respondentes por categoria
  getContagemRespondentesPorCategoria(): { categoria: string; quantidade: number }[] {
    const contagem: { [key: string]: number } = {};

    // Apenas avaliadores (não inclui o avaliado — ele já aparece pelo nome acima)
    const avaliadorCategorias: { [key: string]: string } = {
      'Gestor(es)': 'Gestor(es)',
      'Pares': 'Pares',
      'Subordinados': 'Subordinados',
      'Outros': 'Outros',
      // variações de nome vindas do Firestore
      'Gestor': 'Gestor(es)',
      'Par': 'Pares',
      'Subordinado': 'Subordinados',
      'Outro': 'Outros',
    };

    if (!this.dataSource || this.dataSource.length === 0 || !this.dataIndexes.participantsByCategory) {
      return [];
    }

    this.dataIndexes.participantsByCategory.forEach((indices, grupo) => {
      // Ignora a categoria do avaliado (autoavaliação)
      const grupoNorm = grupo.trim();
      if (grupoNorm === 'Avaliado(a)' || grupoNorm === 'Avaliado' || grupoNorm === 'Autoavaliação') {
        return;
      }

      let quantidade = 0;
      indices.forEach(index => {
        const participant = this.dataSource[index];
        if (!participant || this.isRowFromBlockedParticipant(participant)) return;

        let temResposta = false;
        if (this.dynamicColumns && this.dynamicColumns.length > 0) {
          temResposta = this.dynamicColumns.some(col => {
            const valor = participant[col];
            return valor !== undefined && valor !== null && valor !== '' && !isNaN(Number(valor));
          });
        } else {
          temResposta = Object.keys(participant).some(key => {
            if (['categoria', 'avaliado', 'data', 'dataAvaliacao', 'participante', 'id'].includes(key)) return false;
            const valor = participant[key];
            return valor !== undefined && valor !== null && valor !== '' && !isNaN(Number(valor));
          });
        }
        if (temResposta) quantidade++;
      });

      if (quantidade > 0) {
        const nome = avaliadorCategorias[grupoNorm] || grupoNorm;
        contagem[nome] = (contagem[nome] || 0) + quantidade;
      }
    });

    const ordem: { [key: string]: number } = { 'Gestor(es)': 1, 'Pares': 2, 'Subordinados': 3, 'Outros': 4 };
    return Object.keys(contagem)
      .map(categoria => ({ categoria, quantidade: contagem[categoria] }))
      .sort((a, b) => (ordem[a.categoria] || 99) - (ordem[b.categoria] || 99));
  }

  safeHtml(html: string | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html || '');
  }

  /** HTML de seção com placeholders dinâmicos já resolvidos (capa, intro, textos). */
  getSecaoHtmlComVariaveis(texto: string | undefined): SafeHtml {
    return this.safeHtml(this.substituirVariaveisRelatorio(texto));
  }

  getCapaComDadosDinamicos(textoOriginal: string | undefined): string {
    return this.substituirVariaveisRelatorio(textoOriginal);
  }

  _getCapaComDadosDinamicos_UNUSED(textoOriginal: string | undefined): string {
    if (!textoOriginal) {
      return '';
    }

    // Logar o conteúdo recebido com mais detalhes
    console.log('�Y"" PROCESSANDO - Conteúdo recebido (primeiros 1000 chars):', textoOriginal.substring(0, 1000));
    console.log('�Y"" PROCESSANDO - Tipo do conteúdo:', typeof textoOriginal);
    console.log('�Y"" PROCESSANDO - Tamanho total:', textoOriginal.length);
    console.log('�Y"" PROCESSANDO - Contém HTML:', textoOriginal.includes('<div') || textoOriginal.includes('<h3'));
    console.log('�Y"" PROCESSANDO - Contém Markdown:', textoOriginal.includes('##') || textoOriginal.includes('**'));
    console.log('�Y"" PROCESSANDO - Contém HTML entities:', textoOriginal.includes('&nbsp;') || textoOriginal.includes('&amp;') || textoOriginal.includes('&lt;') || textoOriginal.includes('&gt;'));

    // Verificar se o texto contém a seção de categorias de forma mais robusta
    const textoLower = textoOriginal.toLowerCase();
    const temRespondentes = textoLower.includes('respondentes');
    const temPorCategoria = textoLower.includes('por categoria');
    const temRespondentesPorCategoria = textoLower.includes('respondentes por categoria');
    console.log('�Y"" PROCESSANDO - Contém "respondentes":', temRespondentes);
    console.log('�Y"" PROCESSANDO - Contém "por categoria":', temPorCategoria);
    console.log('�Y"" PROCESSANDO - Contém "respondentes por categoria":', temRespondentesPorCategoria);

    // Verificar estrutura HTML específica
    const temH3Respondentes = /<h3[^>]*>[\s\S]*?[Rr]espondentes[\s\S]*?por[\s\S]*?[Cc]ategoria[\s\S]*?<\/h3>/i.test(textoOriginal);
    const temDivRespondentes = /<div[^>]*>[\s\S]*?[Rr]espondentes[\s\S]*?por[\s\S]*?[Cc]ategoria[\s\S]*?<\/div>/i.test(textoOriginal);
    console.log('�Y"" PROCESSANDO - Tem H3 com "Respondentes por Categoria":', temH3Respondentes);
    console.log('�Y"" PROCESSANDO - Tem DIV com "Respondentes por Categoria":', temDivRespondentes);

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

    console.log('�Y"� Análise da seção "Respondentes por Categoria":');
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
      console.log('  - �Y"< Trecho HTML encontrado:', trechoCategoria);
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
        console.log('  - �Y"" Substituindo seção existente...');

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
          console.log('    �o. Padrão 1 (seção completa)');
          textoProcessado = textoProcessado.replace(regexSecaoCompleta, estruturaNova);
          substituido = true;
        } else if (regexSecaoHorizontal.test(textoProcessado)) {
          console.log('    �o. Padrão 2 (seção horizontal)');
          textoProcessado = textoProcessado.replace(regexSecaoHorizontal, estruturaNova);
          substituido = true;
        } else if (regexSecaoGenerica.test(textoProcessado)) {
          console.log('    �o. Padrão 3 (seção genérica)');
          textoProcessado = textoProcessado.replace(regexSecaoGenerica, estruturaNova);
          substituido = true;
        }

        if (!substituido) {
          console.log('    �s�️ Nenhum regex fez match, tentando abordagem alternativa...');

          // Abordagem alternativa: encontrar o índice da seção e substituir manualmente
          const regexTitulo = /<h3[^>]*>[\s\S]*?Respondentes\s+por\s+Categoria[\s\S]*?<\/h3>/gi;
          const matchTitulo = regexTitulo.exec(textoProcessado);

          if (matchTitulo) {
            console.log('    �Y"� Título encontrado na posição:', matchTitulo.index);
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
              console.log('    �o. Div completo encontrado e substituído');
              textoProcessado = textoProcessado.substring(0, inicioDiv) + estruturaNova + textoProcessado.substring(fimDiv);
              substituido = true;
            }
          }

          // Se ainda não foi substituído, tentar substituir apenas os estilos inline-block
          if (!substituido) {
            console.log('    �s�️ Substituindo estilos inline-block...');
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
        console.log('  - �s�️ Seção não encontrada, adicionando nova seção...');
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
        console.log('  - �Y"< Trecho final:', trechoCategoriaFinal);
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
      secao.texto = DEFAULT_CAPA_HTML.replace(
        '$%NOME_AVALIADO$%',
        this.selectedAvaliadoName || 'Nome do avaliado'
      ).replace(
        '$%DATA_RELATORIO$%',
        this.today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      );
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
              <span style="background: #9c27b0; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 16px;">★</span>
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
  // M�?TODOS PARA FILTRAGEM DE TIPOS DE PERGUNTAS
  // =============================================

  applyQuestionFilter(): void {
    if (!this.allQuestions.length) {
      this.filteredQuestions = [];
      return;
    }

    const includeOpen = !!this.includeOpenQuestions.value;
    this.filteredQuestions = filterQuestionsByType(this.allQuestions as any, includeOpen) as any;

    console.log(`�Y"� Filtro aplicado - Incluir abertas: ${includeOpen}`);
    console.log(`�Y"S Perguntas totais: ${this.allQuestions.length}`);
    console.log(`�Y"S Perguntas filtradas: ${this.filteredQuestions.length}`);
    console.log('�Y"S Perguntas por tipo:', this.getQuestionTypeStats());
  }

  getQuestionTypeStats(): any { return getQuestionTypeStats(this.allQuestions as any); }

  onQuestionFilterChange(): void {
    this.applyQuestionFilter();

    // Atualizar dynamicColumns com as perguntas filtradas
    this.dynamicColumns = this.filteredQuestions.map(q => q.id);

    // Forçar detecção de mudanças
    this.cdr.detectChanges();

    console.log('�Y"S Filtro alterado - Perguntas disponíveis:', this.dynamicColumns.length);
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
    console.group('�Y"� DEBUG: Tipos de Perguntas');

    console.log('�Y"S Total de perguntas:', this.allQuestions.length);
    console.log('�Y"S Perguntas filtradas:', this.filteredQuestions.length);
    console.log('�Y"S Incluir abertas:', this.includeOpenQuestions.value);

    console.log('\n�Y"^ Estatísticas por tipo:');
    const stats = this.getQuestionTypeStats();
    Object.entries(stats).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} perguntas - ${this.getQuestionTypeLabel(type)}`);
    });

    console.log('\n�Y"� Perguntas por tipo:');
    const grouped = this.allQuestions.reduce((acc: any, q) => {
      if (!acc[q.type]) acc[q.type] = [];
      acc[q.type].push(q);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([type, questions]: [string, any]) => {
      console.log(`\n${type} (${questions.length}):`);
      questions.forEach((q: any) => {
        const isFiltered = this.filteredQuestions.some(fq => fq.id === q.id);
        console.log(`  ${isFiltered ? '�o.' : '�O'} ${q.id}: ${q.title}`);
      });
    });

    console.groupEnd();

    this.snackBar.open(this.t('Debug executado! Veja o console.'), this.t('Fechar'), { duration: 5000 });
  }

  getQuestionTitle(perguntaId: string, competenciaId: string): string {
    const title = this.competencyQuestionsService.resolveQuestionTitle(
      perguntaId,
      competenciaId,
      this.questionMap,
      this.customQuestionsByCompetency
    );
    const resolved = title === perguntaId ? `Pergunta ${perguntaId}` : title;
    return this.substituirVariaveisRelatorio(resolved);
  }

  getQuestionLabel(perguntaId: string): string {
    return this.substituirVariaveisRelatorio(this.questionMap[perguntaId] || perguntaId);
  }

  async loadAllCompetencies(): Promise<void> {
    try {
      const seen = new Set<string>();
      const result: Competencia[] = [];

      // �"?�"?�"? competencyGroups filtrado pelo assessmentId atual �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
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
          this.competencyQuestionsService.mergeCustomQuestionsFromGroup(groupData, this.customQuestionsByCompetency);
          this.competencyQuestionsService.populateQuestionMapFromCustom(this.customQuestionsByCompetency, this.questionMap);

          const competencias: any[] = Array.isArray(groupData['competencias']) ? groupData['competencias'] : [];
          competencias.forEach((c: any) => {
            const compId = c.id || `${groupDoc.id}_${c.nome || c.name}`;
            if (!seen.has(compId)) {
              seen.add(compId);
              result.push({
                id: compId,
                nome: c.nome || c.name || 'Competência sem nome',
                descricao: c.descricao || c.description || '',
                perguntasIds: c.perguntasIds || c.questionIds || [],
                groupId: groupDoc.id  // rastreia o grupo pai para matching com pendingCompetencyIds
              } as any);
            }
          });
        });
        console.log('Grupos para esta avaliação:', groupsSnap.size, '->', result.length, 'competências');
      }

      // �"?�"?�"? Fallback: competencies collection (formato competency-dialog) �"?�"?�"?�"?
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
        console.log('�YZ� Fallback competencies collection:', result.length, 'competências');
      }

      this.allCompetencies = result;
      console.log('�YZ� Total competências disponíveis:', this.allCompetencies.length);

      // Aplicar competências pendentes se houver
      if (this.pendingCompetencyIds.length > 0) {
        console.log('�YZ� Aplicando competências pendentes:', this.pendingCompetencyIds);
        // O modal envia IDs de documentos de competencyGroups (group IDs).
        // loadAllCompetencies() cria sub-competências com comp.id = sub-competency ID e comp.groupId = group doc ID.
        // Por isso buscamos match em ambos os campos.
        this.competencias = (this.allCompetencies as any[]).filter((comp: any) =>
          this.pendingCompetencyIds.includes(comp.id) ||
          this.pendingCompetencyIds.includes(comp.groupId)
        );
        // Se ainda não encontrou nada, usar todas as competências da avaliação como fallback
        if (this.competencias.length === 0) {
          console.warn('�YZ� pendingCompetencyIds não bateram com nenhuma sub-competência �?" usando todas:', this.allCompetencies.length);
          this.competencias = [...this.allCompetencies];
        }
        console.log('�YZ� Competências aplicadas:', this.competencias.length);
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
  async onAvaliadoChange(): Promise<void> {
    this.selectedAvaliado = this.avaliadoControl.value;
    this.updateSelectedAvaliadoParticipantId();
    console.log('Avaliado selecionado:', this.selectedAvaliado);

    await this.applyBlockedParticipantsFilter();

    // Invalidar cache relacionado a cálculos de competências
    this.invalidateCache('media-competencia');
    this.invalidateCache('tabela-competencia');

    // Viewer e admin_client carregam snapshot publicado pelo admin_master
    if (['viewer', 'admin_client'].includes(this.currentUserRole)) {
      this.viewerSnapshotLoaded = false;
      this.viewerSnapshotLoaded = await this.loadSnapshotForViewer();
      this.selectedTabIndex = 2;
    } else if (this.canReleaseReport && this.selectedAvaliado) {
      // Admin: carregar baseline de assinatura + detectar snapshot ativo (mesmo se status pending)
      await this.loadPublishedSignature(this.selectedAvaliado);
      await this.checkActiveSnapshot(this.selectedAvaliado);
    }

    // Forçar atualização da view para refletir mudanças
    this.cdr.detectChanges();
  }

  /**
   * Admin: ao abrir um relatório já publicado, captura o estado atual ao vivo como
   * baseline. O indicador "alterações pendentes" só aparece após uma edição real
   * nesta sessão. (Evita falsos positivos por diferenças estruturais do snapshot.)
   */
  private async loadPublishedSignature(_avaliadoName: string): Promise<void> {
    this.publishedSignature = this.selectedAvaliadoReleaseStatus === 'released'
      ? this.computeReportSignature()
      : null;
  }

  // Método para limpar a seleção de avaliado
  limparSelecaoAvaliado(): void {
    this.selectedAvaliado = null;
    this.avaliadoControl.setValue('');
    console.log('Seleção de avaliado limpa');

    // Forçar atualização da view
    this.cdr.detectChanges();

    this.snackBar.open(this.t('Seleção de avaliado limpa.'), this.t('Fechar'), { duration: 3000 });
  }

  // Método de debug específico para investigar dados da tabela de competência
  debugTabelaCompetencia(competencia: Competencia): void {
    console.group(`�Y"� DEBUG TABELA COMPET�SNCIA: ${competencia.nome}`);

    console.log('�Y"S Dados básicos:', {
      competencia: competencia.nome,
      perguntasIds: competencia.perguntasIds,
      selectedAssessmentId: this.selectedAssessmentId,
      selectedAvaliado: this.selectedAvaliado,
      dataSourceLength: this.dataSource.length
    });

    if (!this.dataSource.length) {
      console.log('�O DataSource vazio!');
      console.groupEnd();
      return;
    }

    // Mostrar estrutura dos primeiros participantes
    console.log('�Y"< Estrutura dos primeiros 3 participantes:');
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
    console.log('�Y��️ Grupos disponíveis:', grupos);

    competencia.perguntasIds.forEach(perguntaId => {
      console.group(`�Y"� Pergunta: ${perguntaId}`);

      // Verificar dados para cada grupo
      grupos.forEach(grupo => {
        if (this.selectedAvaliado) {
          const respostas = this.getRespostasParaPerguntaEGrupoEAvaliado(perguntaId, grupo, this.selectedAvaliado);
          console.log(`  �YZ� Grupo "${grupo}" + Avaliado "${this.selectedAvaliado}": ${respostas.length} respostas - [${respostas.join(', ')}]`);
        } else {
          const respostas = this.getRespostasParaPerguntaEGrupo(perguntaId, grupo);
          console.log(`  �YO� Grupo "${grupo}" (todos): ${respostas.length} respostas - [${respostas.join(', ')}]`);
        }
      });

      console.groupEnd();
    });

    // Verificar se há dados para o avaliado selecionado
    if (this.selectedAvaliado) {
      console.group(`�YZ� VERIFICA�?�fO ESPECÍFICA PARA AVALIADO: ${this.selectedAvaliado}`);

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
    const cacheKey = `tabela-competencia-${competencia.id}-${this.selectedAssessmentId}-${this.selectedAvaliado || 'todos'}-${this.selectedAvaliadoParticipantId || 'na'}-${this.dataSource.length}-${this.getBlockedCacheSuffix()}`;

    return this.getCachedCalculation(cacheKey, () => this.gerarTabelaCompetencia(competencia));
  }

  // Método de debug para verificar estrutura dos dados
  debugEstruturaDados(): void {
    console.log('�Y"� DEBUG ESTRUTURA DOS DADOS');
    console.log('�Y"S Total de registros:', this.dataSource.length);

    if (this.dataSource.length > 0) {
      const primeiroRegistro = this.dataSource[0];
      console.log('�Y"< Primeiro registro completo:', primeiroRegistro);

      // Listar todas as chaves disponíveis
      const todasChaves = Object.keys(primeiroRegistro);
      console.log('Todas as chaves disponíveis:', todasChaves);

      // Filtrar chaves que parecem ser perguntas
      const chavesPerguntas = todasChaves.filter(chave =>
        chave.startsWith('pergunta') || chave.includes('Row') || chave.includes('Column')
      );
      console.log('Chaves que parecem ser perguntas:', chavesPerguntas);

      // Verificar valores das primeiras perguntas
      chavesPerguntas.slice(0, 5).forEach(chave => {
        const valor = primeiroRegistro[chave];
        console.log(`  ${chave}: "${valor}" (tipo: ${typeof valor})`);
      });

      // Verificar se as perguntas da competência existem
      if (this.competencias.length > 0) {
        const primeiraComp = this.competencias[0];
        console.log('�Y�? Primeira competência:', primeiraComp);
        console.log('�Y"� IDs das perguntas:', primeiraComp.perguntasIds);

        // Verificar se cada pergunta existe nos dados
        primeiraComp.perguntasIds.forEach(perguntaId => {
          const existe = this.dataSource.some(registro =>
            registro[perguntaId] !== undefined
          );
          console.log(`  ${perguntaId}: ${existe ? '�o. EXISTE' : '�O N�fO EXISTE'}`);

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
    const threshold = JOHARI_THRESHOLD;
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

      const avg = (arr: number[]): number | null =>
        arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
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
        const perguntaTexto = this.substituirVariaveisRelatorio(this.questionMap[perguntaId] || perguntaId);

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
    if (!this.dataSource || this.dataSource.length === 0) {
      console.warn(`[PDF] getDadosPerguntaDefasagem sem dataSource (perguntaId=${perguntaId})`);
      return null;
    }

    // Coletar todas as respostas para esta pergunta especifica
    const respostasSelf: number[] = [];
    const respostasOutros: number[] = [];

    this.dataSource.forEach((row) => {
      if (this.isRowFromBlockedParticipant(row)) return;
      if (row[perguntaId] !== undefined) {
        const valor = this.parseLikertAnswer(row[perguntaId]);

        if (valor !== null) {
          if (this.mapCategoriaToGrupo(row.categoria) === 'Avaliado(a)') {
            respostasSelf.push(valor);
          } else {
            respostasOutros.push(valor);
          }
        }
      }
    });

    // Calcular medias
    const selfScore = respostasSelf.length > 0 ? respostasSelf.reduce((a, b) => a + b, 0) / respostasSelf.length : null;
    const othersScore = respostasOutros.length > 0 ? respostasOutros.reduce((a, b) => a + b, 0) / respostasOutros.length : null;

    const gap = (selfScore !== null && othersScore !== null) ? (selfScore - othersScore) : null;
    if (selfScore === null && othersScore === null) {
      console.warn(`[PDF] Sem respostas validas para pergunta ${perguntaId}`);
    }

    return { selfScore, othersScore, gap };
  }

  public getGapChartDataForCompetency(competencyId: string): GapChartDataItem[] {
    const competencia = this.competencias.find(c => c.id === competencyId);
    if (!competencia || !competencia.perguntasIds) {
      console.warn(`[PDF] Competencia nao encontrada ou sem perguntas (id=${competencyId})`);
      return [];
    }

    const dadosPorPergunta: GapChartDataItem[] = [];

    competencia.perguntasIds.forEach((perguntaId) => {
      const perguntaTexto = this.substituirVariaveisRelatorio(this.questionMap[perguntaId] || perguntaId);
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

    return dadosPorPergunta.sort((a, b) => a.competencyName.localeCompare(b.competencyName));
  }

  ngAfterViewInit(): void { }
}
