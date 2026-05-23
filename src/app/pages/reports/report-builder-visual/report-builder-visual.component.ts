import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';
import { AngularEditorModule, AngularEditorConfig } from '@kolkov/angular-editor';
import { ConfirmDialogService } from 'src/app/shared/confirm-dialog/confirm-dialog.service';
import { DocumentoConfig, DOCUMENTO_CONFIG_PADRAO } from '../../../services/report-pdfmake.service';

// Interface local para evitar dependência circular
type RelatorioSecaoTipo = 'capa' | 'introducao' | 'resumo' | 'graficos' | 'tabela' | 'tabela_detalhada' | 'destaques' | 'custom' | 'texto' | 'competencia_detalhada' | 'grafico_defasagem' | 'janela_johari' | 'perguntas_abertas';

interface SectionTemplate {
  id: string;
  tipo: RelatorioSecaoTipo;
  nome: string;
  descricao: string;
  icone: string;
  cor: string;
  categoria: 'basico' | 'graficos' | 'tabelas' | 'analise';
}

// Interface simplificada para evitar import circular
interface RelatorioSecaoSimplificada {
  id: string;
  tipo: RelatorioSecaoTipo;
  titulo?: string;
  texto?: string;
  visivel: boolean;
  ordem: number;
  competenciasIds?: string[];
  perguntasIds?: string[];
  textosPorCompetencia?: { [key: string]: string };
  tipoGrafico?: 'barra' | 'radar' | 'pizza-comparativa' | 'pizza-individual' | 'barras-individuais' | 'janela_johari';
  paletaCor?: string;
  pageBreakAntes?: boolean;
  pageBreakDepois?: boolean;
  [key: string]: any;
}

type TipoGraficoRelatorio =
  | 'barra'
  | 'radar'
  | 'pizza-comparativa'
  | 'pizza-individual'
  | 'barras-individuais'
  | 'janela_johari';

@Component({
  selector: 'app-report-builder-visual',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    DragDropModule,
    AngularEditorModule
  ],
  templateUrl: './report-builder-visual.component.html',
  styleUrls: ['./report-builder-visual.component.scss']
})
export class ReportBuilderVisualComponent implements OnInit, OnChanges, OnDestroy {
  @Input() relatorioConfiguracao: RelatorioSecaoSimplificada[] = [];
  @Input() competencias: any[] = [];
  @Input() savedLabel: string = '';
  @Input() hasUnsavedChanges: boolean = false;
  @Input() documentoConfig: DocumentoConfig = {
    cabecalho: { ...DOCUMENTO_CONFIG_PADRAO.cabecalho },
    rodape: { ...DOCUMENTO_CONFIG_PADRAO.rodape }
  };
  @Output() configuracaoChange = new EventEmitter<RelatorioSecaoSimplificada[]>();
  @Output() saveRequested = new EventEmitter<void>();
  @Output() documentoConfigChange = new EventEmitter<DocumentoConfig>();

  mostrarPainelDocumento = false;
  readonly currentYear = new Date().getFullYear();

  private destroy$ = new Subject<void>();

  // Templates de seções disponíveis
  sectionTemplates: SectionTemplate[] = [
    {
      id: 'capa',
      tipo: 'capa',
      nome: 'Capa',
      descricao: 'Página inicial do relatório',
      icone: 'description',
      cor: '#2196F3',
      categoria: 'basico'
    },
    {
      id: 'introducao',
      tipo: 'introducao',
      nome: 'Introdução',
      descricao: 'Texto introdutório',
      icone: 'article',
      cor: '#9C27B0',
      categoria: 'basico'
    },
    {
      id: 'resumo',
      tipo: 'resumo',
      nome: 'Resumo Executivo',
      descricao: 'Top competências e áreas de desenvolvimento',
      icone: 'summarize',
      cor: '#4CAF50',
      categoria: 'basico'
    },
    {
      id: 'graficos-barra',
      tipo: 'graficos',
      nome: 'Gráfico de Barras',
      descricao: 'Comparação por categorias',
      icone: 'bar_chart',
      cor: '#FF9800',
      categoria: 'graficos'
    },
    {
      id: 'graficos-radar',
      tipo: 'graficos',
      nome: 'Gráfico Radar',
      descricao: 'Comparação múltipla',
      icone: 'radar',
      cor: '#FF5722',
      categoria: 'graficos'
    },
    {
      id: 'graficos-pizza',
      tipo: 'graficos',
      nome: 'Gráfico Pizza',
      descricao: 'Distribuição percentual',
      icone: 'pie_chart',
      cor: '#E91E63',
      categoria: 'graficos'
    },
    {
      id: 'tabela',
      tipo: 'tabela',
      nome: 'Tabela de Frequência',
      descricao: 'Dados tabulares simples',
      icone: 'table_chart',
      cor: '#00BCD4',
      categoria: 'tabelas'
    },
    {
      id: 'tabela-detalhada',
      tipo: 'tabela_detalhada',
      nome: 'Tabela de Distribuição',
      descricao: 'Distribuição de notas por categoria',
      icone: 'view_list',
      cor: '#009688',
      categoria: 'tabelas'
    },
    {
      id: 'competencia-detalhada',
      tipo: 'competencia_detalhada',
      nome: 'Análise Detalhada',
      descricao: 'Análise por pergunta',
      icone: 'analytics',
      cor: '#3F51B5',
      categoria: 'analise'
    },
    {
      id: 'destaques',
      tipo: 'destaques',
      nome: 'Destaques',
      descricao: 'Pontos fortes e áreas de desenvolvimento',
      icone: 'star',
      cor: '#FFC107',
      categoria: 'basico'
    },
    {
      id: 'defasagem',
      tipo: 'grafico_defasagem',
      nome: 'Gráfico de Defasagem',
      descricao: 'Gap entre autoavaliação e outros',
      icone: 'waterfall_chart',
      cor: '#795548',
      categoria: 'analise'
    },
    {
      id: 'johari',
      tipo: 'janela_johari',
      nome: 'Janela de Johari',
      descricao: 'Análise de percepção',
      icone: 'view_quilt',
      cor: '#607D8B',
      categoria: 'analise'
    },
    {
      id: 'texto',
      tipo: 'texto',
      nome: 'Texto Livre',
      descricao: 'Seção de texto customizado',
      icone: 'text_fields',
      cor: '#9E9E9E',
      categoria: 'basico'
    },
    {
      id: 'perguntas-abertas',
      tipo: 'perguntas_abertas',
      nome: 'Perguntas Abertas',
      descricao: 'Respostas às perguntas: continuar, parar e começar a fazer',
      icone: 'forum',
      cor: '#5C6BC0',
      categoria: 'analise'
    }
  ];

  // Seções no canvas (relatório sendo construído)
  canvasSections: RelatorioSecaoSimplificada[] = [];

  // Categorias para organização
  categorias = [
    { id: 'basico', nome: 'Básico', icone: 'description' },
    { id: 'graficos', nome: 'Gráficos', icone: 'bar_chart' },
    { id: 'tabelas', nome: 'Tabelas', icone: 'table_chart' },
    { id: 'analise', nome: 'Análise', icone: 'analytics' }
  ];

  categoriaSelecionada: string = 'all';
  secaoEditando: RelatorioSecaoSimplificada | null = null;
  showConfigPanel = false;

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
    // ── CORES SÓLIDAS ───────────────────────────────────────────────────────
    'flat_material':    { nome: 'Material Flat',       tipo: 'flat', cores: ['#F44336', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0'] },
    'flat_pastel':      { nome: 'Pastel Suave',        tipo: 'flat', cores: ['#FF9AA2', '#FFB7B2', '#FFDAC1', '#B5EAD7', '#C7CEEA'] },
    'flat_terra':       { nome: 'Tons de Terra',       tipo: 'flat', cores: ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51'] },
    'flat_vibrante':    { nome: 'Ultra Vibrante',      tipo: 'flat', cores: ['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#9B59B6'] },
    'flat_nordico':     { nome: 'Nórdico & Frio',      tipo: 'flat', cores: ['#2C3E50', '#457B9D', '#A8DADC', '#CDB4DB', '#F4ACB7'] },
    'flat_tropico':     { nome: 'Tropical',            tipo: 'flat', cores: ['#D62246', '#F79D65', '#FFE66D', '#4ECDC4', '#1A535C'] },
    'flat_retro':       { nome: 'Retrô',               tipo: 'flat', cores: ['#E07A5F', '#3D405B', '#F2CC8F', '#81B29A', '#F4F1DE'] },
    'flat_neon':        { nome: 'Neon',                tipo: 'flat', cores: ['#FF0080', '#00FFFF', '#00FF41', '#FF6600', '#7B00FF'] },
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

  private readonly tipoGraficoLabels: Record<TipoGraficoRelatorio, string> = {
    barra: 'Barras Comparativas',
    radar: 'Radar',
    'pizza-comparativa': 'Pizza Comparativa',
    'pizza-individual': 'Pizza Individual',
    'barras-individuais': 'Barras Individuais',
    janela_johari: 'Janela de Johari',
  };

  private readonly templateIdPorTipoGrafico: Record<TipoGraficoRelatorio, string> = {
    barra: 'graficos-barra',
    radar: 'graficos-radar',
    'pizza-comparativa': 'graficos-pizza',
    'pizza-individual': 'graficos-pizza',
    'barras-individuais': 'graficos-barra',
    janela_johari: 'johari',
  };

  selecionarPaleta(key: string): void {
    if (!this.secaoEditando) return;
    this.secaoEditando['paletaCor'] = key;
    if (key === 'personalizada' && !this.secaoEditando['coresPersonalizadas']?.length) {
      this.secaoEditando['coresPersonalizadas'] = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'];
    }
  }

  selecionarPaletaBaixas(key: string): void {
    if (!this.secaoEditando) return;
    this.secaoEditando['paletaCorBaixas'] = key;
  }

  getCoresPersonalizadasAtuais(): string[] {
    const cores = this.secaoEditando?.['coresPersonalizadas'];
    if (Array.isArray(cores) && cores.length > 0) return cores;
    return ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'];
  }

  atualizarCorPersonalizada(index: number, event: Event): void {
    if (!this.secaoEditando) return;
    const cores = [...this.getCoresPersonalizadasAtuais()];
    cores[index] = (event.target as HTMLInputElement).value;
    this.secaoEditando['coresPersonalizadas'] = cores;
  }

  adicionarCorPersonalizada(): void {
    if (!this.secaoEditando) return;
    const cores = [...this.getCoresPersonalizadasAtuais()];
    if (cores.length >= 8) return;
    cores.push('#808080');
    this.secaoEditando['coresPersonalizadas'] = cores;
  }

  removerUltimaCorPersonalizada(): void {
    if (!this.secaoEditando) return;
    const cores = [...this.getCoresPersonalizadasAtuais()];
    if (cores.length <= 2) return;
    cores.pop();
    this.secaoEditando['coresPersonalizadas'] = cores;
  }

  // Configuração do editor rich text
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

  constructor(
    private fb: FormBuilder,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.canvasSections = this.normalizarSecoes([...this.relatorioConfiguracao]);
    this.ordenarSecoes();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['relatorioConfiguracao'] && !changes['relatorioConfiguracao'].firstChange) {
      this.canvasSections = this.normalizarSecoes([...this.relatorioConfiguracao]);
      this.ordenarSecoes();
      this.fecharPainelConfig();
    }
  }

  togglePainelDocumento(): void {
    this.mostrarPainelDocumento = !this.mostrarPainelDocumento;
    if (this.mostrarPainelDocumento) {
      this.fecharPainelConfig();
    }
  }

  atualizarCabecalho(campo: keyof DocumentoConfig['cabecalho'], valor: any): void {
    this.documentoConfig = {
      ...this.documentoConfig,
      cabecalho: { ...this.documentoConfig.cabecalho, [campo]: valor }
    };
    this.documentoConfigChange.emit(this.documentoConfig);
  }

  atualizarRodape(campo: keyof DocumentoConfig['rodape'], valor: any): void {
    this.documentoConfig = {
      ...this.documentoConfig,
      rodape: { ...this.documentoConfig.rodape, [campo]: valor }
    };
    this.documentoConfigChange.emit(this.documentoConfig);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Filtra templates por categoria
   */
  getTemplatesFiltrados(): SectionTemplate[] {
    if (this.categoriaSelecionada === 'all') {
      return this.sectionTemplates;
    }
    return this.sectionTemplates.filter(t => t.categoria === this.categoriaSelecionada);
  }

  /**
   * Quando arrasta um template para o canvas
   */
  dropTemplate(event: CdkDragDrop<SectionTemplate[]>) {
    if (event.previousContainer === event.container) {
      // Reordenar dentro do mesmo container
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Adicionar nova seção ao canvas
      const template = event.previousContainer.data[event.previousIndex];
      this.adicionarSecaoDoTemplate(template);
    }
  }

  /**
   * Quando reordena seções no canvas
   */
  dropSecao(event: CdkDragDrop<RelatorioSecaoSimplificada[]>) {
    moveItemInArray(this.canvasSections, event.previousIndex, event.currentIndex);
    this.ordenarSecoes();
    this.emitirMudancas();
  }

  /**
   * Adiciona uma nova seção baseada em um template
   */
  adicionarSecaoDoTemplate(template: SectionTemplate): void {
    const tiposComCompetencias = ['graficos', 'tabela', 'tabela_detalhada', 'competencia_detalhada', 'grafico_defasagem', 'janela_johari'];
    const tipoGraficoPadrao = template.tipo === 'graficos'
      ? this.getTipoGraficoPadraoPorTemplate(template)
      : undefined;

    const novaSecao: RelatorioSecaoSimplificada = {
      id: `${template.tipo}_${Date.now()}`,
      tipo: template.tipo,
      titulo: template.nome,
      texto: '',
      visivel: true,
      ordem: this.canvasSections.length + 1,
      competenciasIds: tiposComCompetencias.includes(template.tipo)
        ? this.competencias.map(c => c.id)
        : [],
      tipoGrafico: tipoGraficoPadrao,
      paletaCor: 'padrao'
    };

    this.canvasSections.push(novaSecao);
    this.ordenarSecoes();
    this.emitirMudancas();

    // Abrir painel de configuração automaticamente
    this.editarSecao(novaSecao);
  }

  /**
   * Adiciona seção clicando no template
   */
  adicionarSecaoClick(template: SectionTemplate): void {
    this.adicionarSecaoDoTemplate(template);
  }

  /**
   * Edita uma seção
   */
  editarSecao(secao: RelatorioSecaoSimplificada): void {
    const secaoNormalizada = { ...secao };
    if (secaoNormalizada.tipo === 'graficos') {
      secaoNormalizada.tipoGrafico = this.resolverTipoGraficoSecao(secaoNormalizada);
    }
    // Default: non-capa sections break before by default; normalize undefined → true
    if (secaoNormalizada.tipo !== 'capa' && secaoNormalizada.pageBreakAntes === undefined) {
      secaoNormalizada.pageBreakAntes = true;
    }
    if (secaoNormalizada.pageBreakDepois === undefined) {
      secaoNormalizada.pageBreakDepois = false;
    }
    this.secaoEditando = secaoNormalizada;
    this.showConfigPanel = true;
    this.mostrarPainelDocumento = false;
  }

  /**
   * Remove uma seção
   */
  async removerSecao(secao: RelatorioSecaoSimplificada): Promise<void> {
    const nome = secao.titulo || this.getNomeTipoSecao(secao) || 'esta seção';
    const confirmado = await this.confirmDialog.confirmDelete(nome);
    if (!confirmado) return;
    const index = this.canvasSections.findIndex(s => s.id === secao.id);
    if (index > -1) {
      this.canvasSections.splice(index, 1);
      this.ordenarSecoes();
      this.emitirMudancas();
    }
  }

  /**
   * Duplica uma seção
   */
  duplicarSecao(secao: RelatorioSecaoSimplificada): void {
    const novaSecao: RelatorioSecaoSimplificada = {
      ...secao,
      id: `${secao.tipo}_${Date.now()}`,
      titulo: `${secao.titulo} (Cópia)`,
      ordem: this.canvasSections.length + 1
    };

    this.canvasSections.push(novaSecao);
    this.ordenarSecoes();
    this.emitirMudancas();
  }

  /**
   * Alterna visibilidade de uma seção
   */
  toggleVisibilidade(secao: RelatorioSecaoSimplificada): void {
    secao.visivel = !secao.visivel;
    this.emitirMudancas();
  }

  /**
   * Salva configuração da seção editada
   */
  salvarConfiguracaoSecao(): void {
    if (!this.secaoEditando) return;

    const index = this.canvasSections.findIndex(s => s.id === this.secaoEditando!.id);
    if (index > -1) {
      this.canvasSections[index] = { ...this.secaoEditando };
      this.ordenarSecoes();
      this.emitirMudancas();
    }

    this.fecharPainelConfig();
  }

  /**
   * Fecha painel de configuração
   */
  fecharPainelConfig(): void {
    this.showConfigPanel = false;
    this.secaoEditando = null;
  }

  /**
   * Ordena seções pela propriedade ordem
   */
  ordenarSecoes(): void {
    this.canvasSections.forEach((s, i) => {
      s.ordem = i + 1;
    });
  }

  /**
   * Emite mudanças para o componente pai
   */
  emitirMudancas(): void {
    this.configuracaoChange.emit([...this.canvasSections]);
  }

  /**
   * Obtém template de uma seção
   */
  getTemplatePorTipo(tipo: string): SectionTemplate | undefined {
    return this.sectionTemplates.find(t => t.tipo === tipo);
  }

  private getTemplatePorId(id: string): SectionTemplate | undefined {
    return this.sectionTemplates.find(t => t.id === id);
  }

  private getTemplatePorSecao(secao: RelatorioSecaoSimplificada): SectionTemplate | undefined {
    if (secao.tipo === 'graficos') {
      const tipoGrafico = this.resolverTipoGraficoSecao(secao);
      const templateId = this.templateIdPorTipoGrafico[tipoGrafico];
      return this.getTemplatePorId(templateId) || this.getTemplatePorTipo(secao.tipo);
    }
    return this.getTemplatePorTipo(secao.tipo);
  }

  private getTipoGraficoPadraoPorTemplate(template: SectionTemplate): TipoGraficoRelatorio {
    switch (template.id) {
      case 'graficos-radar':
        return 'radar';
      case 'graficos-pizza':
        return 'pizza-comparativa';
      case 'johari':
        return 'janela_johari';
      default:
        return 'barra';
    }
  }

  private inferirTipoGraficoPorTitulo(titulo?: string): TipoGraficoRelatorio {
    const nome = (titulo || '').toLowerCase();

    if (nome.includes('johari')) return 'janela_johari';
    if (nome.includes('pizza') && nome.includes('individual')) return 'pizza-individual';
    if (nome.includes('pizza')) return 'pizza-comparativa';
    if (nome.includes('radar')) return 'radar';
    if (nome.includes('barras') && nome.includes('individual')) return 'barras-individuais';

    return 'barra';
  }

  private resolverTipoGraficoSecao(secao: RelatorioSecaoSimplificada): TipoGraficoRelatorio {
    const valorAtual = secao.tipoGrafico as TipoGraficoRelatorio | undefined;
    if (valorAtual && this.tipoGraficoLabels[valorAtual]) {
      return valorAtual;
    }
    return this.inferirTipoGraficoPorTitulo(secao.titulo);
  }

  private normalizarSecoes(secoes: RelatorioSecaoSimplificada[]): RelatorioSecaoSimplificada[] {
    return secoes.map(secao => {
      if (secao.tipo !== 'graficos') {
        return secao;
      }

      return {
        ...secao,
        tipoGrafico: this.resolverTipoGraficoSecao(secao),
      };
    });
  }

  /**
   * Nome exibido do tipo da seção no card.
   * Para seções de gráficos, usa o tipo de gráfico selecionado.
   */
  getNomeTipoSecao(secao: RelatorioSecaoSimplificada): string {
    if (secao.tipo === 'graficos') {
      const tipoGrafico = this.resolverTipoGraficoSecao(secao);
      return this.tipoGraficoLabels[tipoGrafico] || 'Gráficos';
    }
    return this.getTemplatePorTipo(secao.tipo)?.nome || 'Seção';
  }

  /**
   * Obtém cor de uma seção
   */
  getCorSecao(secao: RelatorioSecaoSimplificada): string {
    const template = this.getTemplatePorSecao(secao);
    return template?.cor || '#757575';
  }

  /**
   * Obtém ícone de uma seção
   */
  getIconeSecao(secao: RelatorioSecaoSimplificada): string {
    const template = this.getTemplatePorSecao(secao);
    return template?.icone || 'description';
  }

  /**
   * Conta competências selecionadas
   */
  contarCompetencias(secao: RelatorioSecaoSimplificada): number {
    return secao.competenciasIds?.length || 0;
  }

  /**
   * Limpa todas as seções
   */
  limparTudo(): void {
    if (confirm('Tem certeza que deseja remover todas as seções?')) {
      this.canvasSections = [];
      this.emitirMudancas();
    }
  }
}
