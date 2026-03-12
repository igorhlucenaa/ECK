import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
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
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';
import { AngularEditorModule, AngularEditorConfig } from '@kolkov/angular-editor';

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
  [key: string]: any;
}

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
    DragDropModule,
    AngularEditorModule
  ],
  templateUrl: './report-builder-visual.component.html',
  styleUrls: ['./report-builder-visual.component.scss']
})
export class ReportBuilderVisualComponent implements OnInit, OnDestroy {
  @Input() relatorioConfiguracao: RelatorioSecaoSimplificada[] = [];
  @Input() competencias: any[] = [];
  @Output() configuracaoChange = new EventEmitter<RelatorioSecaoSimplificada[]>();

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
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    // Inicializar com configuração existente ou vazia
    this.canvasSections = [...this.relatorioConfiguracao];
    this.ordenarSecoes();
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
    const novaSecao: RelatorioSecaoSimplificada = {
      id: `${template.tipo}_${Date.now()}`,
      tipo: template.tipo,
      titulo: template.nome,
      texto: '',
      visivel: true,
      ordem: this.canvasSections.length + 1,
      competenciasIds: [],
      tipoGrafico: template.tipo === 'graficos' ? 'barra' : undefined,
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
    this.secaoEditando = { ...secao };
    this.showConfigPanel = true;
  }

  /**
   * Remove uma seção
   */
  removerSecao(secao: RelatorioSecaoSimplificada): void {
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

  /**
   * Obtém cor de uma seção
   */
  getCorSecao(secao: RelatorioSecaoSimplificada): string {
    const template = this.getTemplatePorTipo(secao.tipo);
    return template?.cor || '#757575';
  }

  /**
   * Obtém ícone de uma seção
   */
  getIconeSecao(secao: RelatorioSecaoSimplificada): string {
    const template = this.getTemplatePorTipo(secao.tipo);
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
