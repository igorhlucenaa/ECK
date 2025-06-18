import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { Firestore, collection, getDocs, doc, getDoc, addDoc } from '@angular/fire/firestore';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { ReactiveFormsModule, FormControl, FormGroup, Validators, FormArray } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
import { MatOptionModule } from '@angular/material/core';
import { ColumnValuePipe } from './column-value.pipe';
import { MatTabsModule } from '@angular/material/tabs';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { AngularEditorModule, AngularEditorConfig } from '@kolkov/angular-editor';
import { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface AssessmentOption {
  id: string;
  name: string;
}

interface Caracteristica {
  id: string;
  nome: string;
  descricao: string;
  perguntasIds: string[];
}

// Modelo de dados para seções dinâmicas do relatório
export interface RelatorioSecao {
  id: string;
  tipo: 'capa' | 'introducao' | 'resumo' | 'graficos' | 'tabela' | 'destaques' | 'custom' | 'texto';
  titulo?: string;
  texto?: string;
  visivel: boolean;
  ordem: number;
  // Campos para dados dinâmicos
  caracteristicasIds?: string[];
  perguntasIds?: string[];
  // Outros campos customizáveis
  [key: string]: any;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
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
    NgxChartsModule,
    AngularEditorModule,
    NgxEchartsModule,
    DragDropModule,
    MatSnackBarModule
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ReportsComponent implements OnInit {
  displayedColumns: string[] = [];
  dataSource: any[] = [];
  isLoading = false;
  assessments: AssessmentOption[] = [];
  selectedAssessmentId: string | null = null;
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
  competenciaControl = new FormControl('');
  competencias: { nome: string; perguntas: string[] }[] = [];
  selectedCompetencia: { nome: string; perguntas: string[] } | null = null;
  questionsControl = new FormControl<string[]>([]);
  stackedData: any[] = [];
  colorScheme = { domain: ['#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575', '#424242'] };
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

  caracteristicas: Caracteristica[] = [];
  caracteristicaEditando: Caracteristica = { id: '', nome: '', descricao: '', perguntasIds: [] };
  caracteristicaForm: FormGroup;

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
      titulo: 'Resumo dos Resultados nas Características',
      texto: '',
      visivel: true,
      ordem: 3,
      caracteristicasIds: [] // pode ser preenchido dinamicamente
    },
    {
      id: 'graficos',
      tipo: 'graficos',
      titulo: 'Gráficos',
      texto: '',
      visivel: true,
      ordem: 4,
      caracteristicasIds: []
    },
    {
      id: 'tabela',
      tipo: 'tabela',
      titulo: 'Tabela de Frequência',
      texto: '',
      visivel: true,
      ordem: 5,
      caracteristicasIds: []
    },
    {
      id: 'destaques',
      tipo: 'destaques',
      titulo: 'Avaliações mais altas',
      texto: '',
      visivel: true,
      ordem: 6
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

  constructor(private firestore: Firestore, private snackBar: MatSnackBar) {
    this.caracteristicaForm = new FormGroup({
      nome: new FormControl('', Validators.required),
      descricao: new FormControl('', Validators.required),
      perguntasIds: new FormControl([])
    });
    this.relatorioFormArray = new FormArray<any>([]);
    this.dummyForm = new FormGroup({
      relatorioFormArray: this.relatorioFormArray
    });
    this.carregarRelatoriosSalvos();
    this.carregarTemplatesSalvos();
  }

  async ngOnInit() {
    this.isLoading = true;
    const assessmentsSnap = await getDocs(collection(this.firestore, 'assessments'));
    this.assessments = assessmentsSnap.docs.map(doc => ({
      id: doc.id,
      name: doc.data()['name'] || doc.id
    }));
    console.log('Avaliações carregadas:', this.assessments);
    this.isLoading = false;

    // Subscribe to selection changes
    this.assessmentControl.valueChanges.subscribe(value => {
      this.selectedAssessmentId = value;
      this.onAssessmentChange();
    });

    // Inicializar o FormArray das seções do relatório
    this.relatorioFormArray.clear();
    this.relatorioConfiguracao.forEach(secao => {
      this.relatorioFormArray.push(new FormGroup({
        visivel: new FormControl(secao.visivel),
        titulo: new FormControl(secao.titulo || ''),
        texto: new FormControl(secao.texto || ''),
        caracteristicasIds: new FormControl(secao.caracteristicasIds || []),
        id: new FormControl(secao.id),
        tipo: new FormControl(secao.tipo),
        ordem: new FormControl(secao.ordem),
        tipoGrafico: new FormControl(secao['tipoGrafico'] || 'barra')
      }));
    });
  }

  async onAssessmentChange() {
    if (!this.selectedAssessmentId) {
      this.dataSource = [];
      this.displayedColumns = [];
      return;
    }
    console.log('Avaliação selecionada:', this.selectedAssessmentId);
    this.isLoading = true;
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
    console.log('assessmentData carregado:', assessmentData);
    const surveyJSON = assessmentData['surveyJSON'];
    let dynamicColumns: string[] = [];
    if (surveyJSON && surveyJSON.pages) {
      surveyJSON.pages.forEach((page: any) => {
        if (page.elements) {
          page.elements.forEach((el: any) => {
            if (el.type === 'matrix' && el.rows) {
              el.rows.forEach((row: any) => {
                const key = `${el.name}_${row.value}`;
                this.questionMap[key] = row.text?.pt || row.text || key;
                if (!dynamicColumns.includes(key)) dynamicColumns.push(key);
              });
            } else {
              this.questionMap[el.name] = el.title?.pt || el.title || el.name;
              if (!dynamicColumns.includes(el.name)) dynamicColumns.push(el.name);
            }
          });
        }
      });
    }
    const resultsSnap = await getDocs(collection(this.firestore, `assessments/${this.selectedAssessmentId}/results`));
    const allRows: any[] = [];
    const fixedColumns = ['data', 'categoria', 'avaliado', 'dataAvaliacao'];
    for (const resultDoc of resultsSnap.docs) {
      const resultData = resultDoc.data();
      let participanteNome = '';
      let categoria = '';
      let dataAvaliacao = '';
      if (resultData['participantId']) {
        const participantRef = doc(this.firestore, 'participants', resultData['participantId']);
        const participantSnap = await getDoc(participantRef);
        if (participantSnap.exists()) {
          const pData = participantSnap.data();
          participanteNome = pData['name'] || '';
          categoria = pData['category'] || '';
        }
      }
      if (resultData['completedAt']) {
        const d = new Date(resultData['completedAt'].seconds ? resultData['completedAt'].seconds * 1000 : resultData['completedAt']);
        dataAvaliacao = d.toLocaleDateString('pt-BR');
      }
      const row: any = { data: '', categoria, avaliado: participanteNome, dataAvaliacao };
      for (const qKey of dynamicColumns) {
        let cellValue: any = '';
        if (qKey.includes('_') && resultData['surveyData'] && resultData['surveyData'][qKey.split('_')[0]]) {
          cellValue = resultData['surveyData'][qKey.split('_')[0]][qKey.split('_')[1]] ?? '';
        } else if (resultData['surveyData']) {
          cellValue = resultData['surveyData'][qKey] ?? '';
        }
        const parsed = this.parseNumeric(cellValue);
        row[qKey] = parsed !== null ? parsed : cellValue;
      }
      allRows.push(row);
    }
    this.dynamicColumns = dynamicColumns;
    this.displayedColumns = [...fixedColumns, ...dynamicColumns];
    this.dataSource = allRows;
    console.log('Dados carregados para a tabela:', this.dataSource);

    // gerar contagem de categorias
    const counts: { [cat: string]: number } = {};
    for (const row of allRows) {
      const cat = row['categoria'] || 'Outros';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    this.summaryCounts = counts;

    this.buildConsolidationData(dynamicColumns, allRows);
    this.updateChart();
    this.isLoading = false;
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
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      // Converter 'Column 1' a 'Column 5' para 1 a 5
      const match = val.match(/^Column (\d)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        // 'Column 6' é considerado 'Sem dados', então retorna null
        if (num >= 1 && num <= 5) return num;
        return null;
      }
      const n = parseFloat(val);
      return isNaN(n) ? null : n;
    }
    return null;
  }

  addCompetencia() {
    const n = (this.competenciaControl.value || '').trim();
    if (!n) return;
    const comp = { nome: n, perguntas: [] };
    this.competencias.push(comp);
    this.competenciaControl.reset();
    this.onSelectCompetencia(comp);
    this.updateChart();
  }

  removeCompetencia(c: any) {
    this.competencias = this.competencias.filter(x => x !== c);
    if (this.selectedCompetencia === c) this.selectedCompetencia = null;
    this.updateChart();
  }

  updateChart() {
    this.stackedData = this.competencias
      .filter(c => c.perguntas.length)
      .map(c => {
        const dist: any = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let soma = 0;
        let count = 0;
        this.dataSource.forEach(row => {
          c.perguntas.forEach(q => {
            const num = this.parseNumeric(row[q]);
            if (num && num >= 1 && num <= 5) {
              dist[num] += 1;
              soma += num;
              count++;
            }
          });
        });
        return {
          name: c.nome,
          series: [
            { name: '1', value: dist[1] },
            { name: '2', value: dist[2] },
            { name: '3', value: dist[3] },
            { name: '4', value: dist[4] },
            { name: '5', value: dist[5] },
          ],
          media: count ? soma / count : 0
        };
      });

    // Gerar dados para o gráfico polar
    this.polarData = this.stackedData.map(c => ({
      name: c.name,
      value: c.media
    }));

    // Gerar dados para o radar chart (ngx-echarts)
    const radarNames = this.stackedData.map(c => c.name);
    const radarValues = this.stackedData.map(c => Number(c.media?.toFixed(2) || 0));
    this.radarOptions = {
      tooltip: {},
      radar: {
        indicator: radarNames.map(name => ({ name, max: 5 })),
        radius: '70%',
      },
      series: [
        {
          type: 'radar' as const,
          data: [
            {
              value: radarValues,
              name: 'Média por competência'
            }
          ]
        }
      ]
    } as EChartsOption;
  }

  onSelectCompetencia(c: { nome: string; perguntas: string[] }) {
    this.selectedCompetencia = c;
    this.questionsControl.setValue([...c.perguntas]);
  }

  questionsControlChanged() {
    if (this.selectedCompetencia) {
      this.selectedCompetencia.perguntas = this.questionsControl.value || [];
      this.updateChart();
    }
  }

  salvarCaracteristica() {
    if (this.caracteristicaForm.invalid) return;
    const formValue = this.caracteristicaForm.value;
    if (this.caracteristicaEditando.id) {
      // Editar existente
      const idx = this.caracteristicas.findIndex(c => c.id === this.caracteristicaEditando.id);
      if (idx > -1) this.caracteristicas[idx] = { ...this.caracteristicaEditando, ...formValue };
    } else {
      // Nova
      const nova: Caracteristica = {
        id: Date.now().toString(),
        ...formValue
      };
      this.caracteristicas.push(nova);
    }
    this.cancelarEdicaoCaracteristica();
  }

  editarCaracteristica(c: Caracteristica) {
    this.caracteristicaEditando = { ...c };
    this.caracteristicaForm.setValue({
      nome: c.nome,
      descricao: c.descricao,
      perguntasIds: c.perguntasIds || []
    });
  }

  removerCaracteristica(c: Caracteristica) {
    this.caracteristicas = this.caracteristicas.filter(x => x.id !== c.id);
    this.cancelarEdicaoCaracteristica();
  }

  cancelarEdicaoCaracteristica() {
    this.caracteristicaEditando = { id: '', nome: '', descricao: '', perguntasIds: [] };
    this.caracteristicaForm.reset({ nome: '', descricao: '', perguntasIds: [] });
  }

  get selectedAssessmentName(): string {
    const a = this.assessments.find(ax => ax.id === this.selectedAssessmentId);
    return a ? a.name : '';
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
      ordem: index + 2
    };
    this.relatorioConfiguracao.splice(index + 1, 0, novaSecao);
    this.relatorioFormArray.insert(index + 1, new FormGroup({
      visivel: new FormControl(novaSecao.visivel),
      titulo: new FormControl(novaSecao.titulo),
      texto: new FormControl(novaSecao.texto),
      caracteristicasIds: new FormControl([]),
      id: new FormControl(novaSecao.id),
      tipo: new FormControl(novaSecao.tipo),
      ordem: new FormControl(novaSecao.ordem),
      tipoGrafico: new FormControl('barra')
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
  }

  get relatorioFormGroups(): FormGroup[] {
    return this.relatorioFormArray.controls as FormGroup[];
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

  // Retorna as médias por característica e grupo de avaliadores para o bloco de Resumo
  getResumoMedias() {
    const grupos = ['Avaliado(a)', 'Gestor(es)', 'Pares', 'Subordinados', 'Outros'];
    const secaoResumo = this.relatorioConfiguracao.find(s => s.tipo === 'resumo');
    if (!secaoResumo || !secaoResumo.caracteristicasIds?.length) {
      console.log('[Resumo] Nenhuma característica selecionada na seção de resumo.');
      return [];
    }
    const caracteristicasSelecionadas = this.caracteristicas.filter(c => secaoResumo.caracteristicasIds!.includes(c.id));
    console.log('[Resumo] Características selecionadas:', caracteristicasSelecionadas.map(c => ({ id: c.id, nome: c.nome, perguntasIds: c.perguntasIds })));
    // Log para depuração: mostrar as chaves do dataSource
    if (this.dataSource.length) {
      console.log('[Resumo] Exemplo de linha do dataSource:', this.dataSource[0]);
    }
    const resultado: any[] = [];
    for (const carac of caracteristicasSelecionadas) {
      const perguntas = carac.perguntasIds;
      console.log(`[Resumo] Processando característica: ${carac.nome} (Perguntas: ${perguntas})`);
      for (const grupo of grupos) {
        let soma = 0;
        let count = 0;
        for (const row of this.dataSource) {
          const grupoLinha = this.mapCategoriaToGrupo(row['categoria']);
          if (grupoLinha === grupo) {
            for (const pid of perguntas) {
              // Log para depuração: mostrar o valor buscado
              console.log(`[Resumo] Buscando valor para pid='${pid}' em row:`, row);
              const val = this.parseNumeric(row[pid]);
              console.log(`[Resumo] Valor encontrado para pid='${pid}':`, val);
              if (val !== null) {
                soma += val;
                count++;
              }
            }
          }
        }
        console.log(`[Resumo] Característica: ${carac.nome}, Grupo: ${grupo}, Soma: ${soma}, Count: ${count}, Média: ${count ? soma / count : null}`);
        resultado.push({
          caracteristica: carac.nome,
          grupo,
          media: count ? soma / count : null
        });
      }
    }
    return resultado;
  }

  // Métodos utilitários para gráficos dinâmicos na visualização do relatório
  getSecaoStackedData(secao: any) {
    // Retorna dados de barra para as características selecionadas na seção
    if (!secao.caracteristicasIds?.length) return [];
    // Buscar as características selecionadas
    const caracs = this.caracteristicas.filter(c => secao.caracteristicasIds.includes(c.id));
    return caracs
      .map(carac => {
        const dist: any = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let soma = 0;
        let count = 0;
        this.dataSource.forEach(row => {
          (carac.perguntasIds || []).forEach(q => {
            const num = this.parseNumeric(row[q]);
            if (num && num >= 1 && num <= 5) {
              dist[num] += 1;
              soma += num;
              count++;
            }
          });
        });
        return {
          name: carac.nome,
          series: [
            { name: '1', value: dist[1] },
            { name: '2', value: dist[2] },
            { name: '3', value: dist[3] },
            { name: '4', value: dist[4] },
            { name: '5', value: dist[5] },
          ],
          media: count ? soma / count : 0
        };
      });
  }

  getSecaoRadarOptions(secao: any) {
    // Retorna opções para gráfico radar das características selecionadas
    const stackedData = this.getSecaoStackedData(secao);
    const radarNames = stackedData.map(c => c.name);
    const radarValues = stackedData.map(c => Number(c.media?.toFixed(2) || 0));
    return {
      tooltip: {},
      radar: {
        indicator: radarNames.map(name => ({ name, max: 5 })),
        radius: '70%',
      },
      series: [
        {
          type: 'radar' as const,
          data: [
            {
              value: radarValues,
              name: 'Média por competência'
            }
          ]
        }
      ]
    } as EChartsOption;
  }

  getSecaoPieData(secao: any) {
    // Retorna dados para gráfico de pizza (distribuição total de respostas por característica)
    if (!secao.caracteristicasIds?.length) return [];
    const caracs = this.caracteristicas.filter(c => secao.caracteristicasIds.includes(c.id));
    return caracs
      .map(carac => {
        let soma = 0;
        let count = 0;
        this.dataSource.forEach(row => {
          (carac.perguntasIds || []).forEach(q => {
            const num = this.parseNumeric(row[q]);
            if (num && num >= 1 && num <= 5) {
              soma += num;
              count++;
            }
          });
        });
        return {
          name: carac.nome,
          value: count ? soma / count : 0
        };
      });
  }

  onTipoGraficoChange(secao: any, i: number) {
    secao['tipoGrafico'] = this.getTipoGraficoControl(i).value;
  }

  getTipoGraficoControl(i: number): FormControl {
    return this.relatorioFormGroups[i].get('tipoGrafico') as FormControl;
  }

  // Grupos padrão
  getGrupos() {
    return ['Avaliado(a)', 'Gestor(es)', 'Pares', 'Subordinados', 'Outros'];
  }

  // Características selecionadas para a seção de tabela
  getCaracteristicasSelecionadasParaTabela() {
    const secaoTabela = this.relatorioConfiguracao.find(s => s.tipo === 'tabela');
    if (!secaoTabela || !Array.isArray(secaoTabela.caracteristicasIds) || !secaoTabela.caracteristicasIds.length) return [];
    return this.caracteristicas.filter(c => secaoTabela.caracteristicasIds!.includes(c.id));
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
          const val = this.parseNumeric(row[pid]);
          if (val !== null) {
            soma += val;
            count++;
          }
        }
      }
    }
    return count ? soma / count : null;
  }

  // Validação antes de salvar relatório
  private validarRelatorio(): string | null {
    for (const secao of this.relatorioConfiguracao) {
      if (!secao.titulo || !secao.tipo) {
        return 'Todas as seções devem ter título e tipo.';
      }
    }
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
      caracteristicas: this.caracteristicas,
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
    const reportRef = doc(this.firestore, 'reports', this.selectedReportId.value);
    const reportSnap = await getDoc(reportRef);
    if (reportSnap.exists()) {
      const reportData = reportSnap.data();
      this.caracteristicas = reportData['caracteristicas'] || [];
      this.relatorioConfiguracao = reportData['configuracao'] || [];
      // Atualizar o form reativo
      this.atualizarFormArrayComConfiguracao();
      alert(`Relatório '${reportData['nome']}' carregado!`);
    }
  }

  atualizarFormArrayComConfiguracao() {
    this.relatorioFormArray.clear();
    this.relatorioConfiguracao.forEach(secao => {
      this.relatorioFormArray.push(new FormGroup({
        visivel: new FormControl(secao.visivel),
        titulo: new FormControl(secao.titulo || ''),
        texto: new FormControl(secao.texto || ''),
        caracteristicasIds: new FormControl(secao.caracteristicasIds || []),
        id: new FormControl(secao.id),
        tipo: new FormControl(secao.tipo),
        ordem: new FormControl(secao.ordem),
        tipoGrafico: new FormControl(secao['tipoGrafico'] || 'barra')
      }));
    });
  }

  // Adiciona uma nova seção customizada ao relatório
  addSecaoCustomizada() {
    // Gera um id único simples
    const id = 'custom_' + Date.now();
    const novaSecao: RelatorioSecao = {
      id,
      tipo: 'custom',
      titulo: 'Nova Seção',
      texto: '',
      visivel: true,
      ordem: this.relatorioConfiguracao.length + 1
    };
    this.relatorioConfiguracao.push(novaSecao);
    this.relatorioFormArray.push(new FormGroup({
      visivel: new FormControl(novaSecao.visivel),
      titulo: new FormControl(novaSecao.titulo),
      texto: new FormControl(novaSecao.texto),
      caracteristicasIds: new FormControl([]),
      id: new FormControl(novaSecao.id),
      tipo: new FormControl(novaSecao.tipo),
      ordem: new FormControl(novaSecao.ordem),
      tipoGrafico: new FormControl('barra')
    }));
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

  // Salvar template no Firestore
  async salvarTemplateNoFirebase() {
    if (!this.nomeTemplateControl.value) {
      this.snackBar.open('Por favor, dê um nome ao template.', 'Fechar', { duration: 3000 });
      return;
    }
    const templateData = {
      nome: this.nomeTemplateControl.value,
      configuracao: this.relatorioConfiguracao,
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
    const templateRef = doc(this.firestore, 'reportTemplates', this.selectedTemplateId.value);
    const templateSnap = await getDoc(templateRef);
    if (templateSnap.exists()) {
      const templateData = templateSnap.data();
      this.relatorioConfiguracao = templateData['configuracao'] || [];
      this.atualizarFormArrayComConfiguracao();
      this.snackBar.open(`Template '${templateData['nome']}' aplicado!`, 'Fechar', { duration: 2500 });
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
    pdf.save('relatorio-360.pdf');
    this.snackBar.open('PDF exportado com sucesso!', 'Fechar', { duration: 3000 });
  }
}
