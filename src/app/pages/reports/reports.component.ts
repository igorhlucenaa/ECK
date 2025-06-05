import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { Firestore, collection, getDocs, doc, getDoc } from '@angular/fire/firestore';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
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

interface AssessmentOption {
  id: string;
  name: string;
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
    NgxEchartsModule
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

  get selectedAssessmentName(): string {
    const a = this.assessments.find(ax => ax.id === this.selectedAssessmentId);
    return a ? a.name : '';
  }

  constructor(private firestore: Firestore) { }

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
      if (val.startsWith('Column ')) {
        const num = parseInt(val.replace('Column ', ''), 10);
        return isNaN(num) ? null : num;
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
          type: 'radar',
          data: [
            {
              value: radarValues,
              name: 'Média por competência'
            }
          ]
        }
      ]
    };
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
}
