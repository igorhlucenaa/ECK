import { Component, Input, OnInit, OnChanges, SimpleChanges, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { AssessmentDataService } from '../services/assessment-data.service';
import { MetricConfig } from './report-editor.component';

export interface MetricResult {
  name: string;
  value: number;
}

@Component({
  selector: 'app-metric-preview',
  standalone: true,
  imports: [CommonModule, NgxChartsModule, MatCardModule, MatTableModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="metric-container">
      <div *ngIf="loading" class="loading-message">
        Carregando dados...
      </div>

      <div *ngIf="!loading && error" class="error-message">
        {{ error }}
      </div>

      <div *ngIf="!loading && !error">
        <div [ngSwitch]="config.type">
          <!-- Gráfico de Barras -->
          <ngx-charts-bar-vertical
            *ngSwitchCase="'bar'"
            [view]="[400, 300]"
            [scheme]="colorScheme"
            [results]="results"
            [gradient]="false"
            [xAxis]="true"
            [yAxis]="true"
            [legend]="false"
            [showXAxisLabel]="true"
            [showYAxisLabel]="true"
            [xAxisLabel]="'Categoria'"
            [yAxisLabel]="'Valor'">
          </ngx-charts-bar-vertical>

          <!-- Gráfico de Pizza -->
          <ngx-charts-pie-chart
            *ngSwitchCase="'pie'"
            [view]="[400, 300]"
            [scheme]="colorScheme"
            [results]="results"
            [gradient]="false"
            [legend]="true"
            [labels]="true"
            [doughnut]="false">
          </ngx-charts-pie-chart>

          <!-- Gráfico de Linha -->
          <ngx-charts-line-chart
            *ngSwitchCase="'line'"
            [view]="[400, 300]"
            [scheme]="colorScheme"
            [results]="lineChartData"
            [gradient]="false"
            [xAxis]="true"
            [yAxis]="true"
            [legend]="false"
            [showXAxisLabel]="true"
            [showYAxisLabel]="true"
            [xAxisLabel]="'Categoria'"
            [yAxisLabel]="'Valor'">
          </ngx-charts-line-chart>

          <!-- Gráfico de Radar -->
          <ngx-charts-radar-chart
            *ngSwitchCase="'radar'"
            [view]="[400, 300]"
            [scheme]="colorScheme"
            [results]="results"
            [xAxis]="true"
            [yAxis]="true"
            [legend]="true"
            [showXAxisLabel]="false"
            [showYAxisLabel]="false">
          </ngx-charts-radar-chart>

          <!-- Tabela de Dados -->
          <div *ngSwitchCase="'table'" class="table-container">
            <table mat-table [dataSource]="tableData" class="mat-elevation-z2 w-100">
              <ng-container *ngFor="let column of displayedColumns" [matColumnDef]="column">
                <th mat-header-cell *matHeaderCellDef>{{column}}</th>
                <td mat-cell *matCellDef="let element">{{element[column]}}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>

          <!-- Texto -->
          <div *ngSwitchCase="'text'" class="text-container">
            <mat-card>
              <mat-card-header>
                <mat-card-title>{{config.fieldMapping?.title || 'Resumo'}}</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <p *ngIf="textSummary">{{textSummary}}</p>
                <p *ngIf="!textSummary">Não há dados suficientes para gerar um resumo.</p>
              </mat-card-content>
            </mat-card>
          </div>

          <!-- Comparativo 360° -->
          <div *ngSwitchCase="'compare360'" class="chart-container">
            <h3 class="chart-title">{{config.fieldMapping?.title || 'Comparativo 360°'}}</h3>
            <ngx-charts-bar-horizontal
              [view]="[500, 300]"
              [scheme]="colorScheme"
              [results]="results"
              [gradient]="false"
              [xAxis]="true"
              [yAxis]="true"
              [legend]="true"
              [showXAxisLabel]="true"
              [showYAxisLabel]="true"
              [xAxisLabel]="'Valor'"
              [yAxisLabel]="'Fonte'">
            </ngx-charts-bar-horizontal>
          </div>

          <!-- Radar 360° -->
          <div *ngSwitchCase="'radar360'" class="chart-container">
            <h3 class="chart-title">{{config.fieldMapping?.title || 'Radar 360°'}}</h3>
            <ngx-charts-polar-chart
              [view]="[500, 400]"
              [scheme]="colorScheme"
              [results]="radarChartData"
              [gradient]="false"
              [xAxis]="true"
              [yAxis]="true"
              [legend]="true"
              [showXAxisLabel]="false"
              [showYAxisLabel]="false">
            </ngx-charts-polar-chart>
          </div>

          <!-- Resumo da Avaliação -->
          <div *ngSwitchCase="'summary'" class="summary-container">
            <h3 class="chart-title">{{config.fieldMapping?.title || 'Resumo da Avaliação'}}</h3>
            <table class="summary-table">
              <thead>
                <tr>
                  <th>Competência</th>
                  <th>Autoavaliação</th>
                  <th>Gestor</th>
                  <th>Pares</th>
                  <th>Liderados</th>
                  <th>Resultado final</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of summaryData">
                  <td>{{row.competencia}}</td>
                  <td>{{row.autoavaliacao}}</td>
                  <td>{{row.gestor}}</td>
                  <td>{{row.pares}}</td>
                  <td>{{row.liderados}}</td>
                  <td [ngClass]="{'highlight': true}">{{row.resultado}}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Resultado da seção</strong></td>
                  <td>{{sectionAverages.autoavaliacao}}</td>
                  <td>{{sectionAverages.gestor}}</td>
                  <td>{{sectionAverages.pares}}</td>
                  <td>{{sectionAverages.liderados}}</td>
                  <td [ngClass]="{'highlight': true}">{{sectionAverages.resultado}}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Mensagem para tipo não suportado -->
          <div *ngSwitchDefault class="empty-message">
            <p>Métrica do tipo {{config.type}} não implementada ou sem dados.</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .metric-container {
      width: 100%;
      height: 100%;
      min-height: 200px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .loading-message, .error-message, .empty-message {
      color: #666;
      text-align: center;
      padding: 20px;
    }

    .error-message {
      color: #f44336;
    }

    .table-container {
      width: 100%;
      max-height: 300px;
      overflow: auto;
    }

    .text-container {
      width: 100%;
    }

    .chart-container {
      width: 100%;
      padding: 15px;
    }

    .chart-title {
      text-align: center;
      margin-bottom: 15px;
      font-size: 18px;
      color: #333;
    }

    .summary-container {
      width: 100%;
      padding: 15px;
      overflow-x: auto;
    }

    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }

    .summary-table th,
    .summary-table td {
      border: 1px solid #e0e0e0;
      padding: 8px 12px;
      text-align: center;
    }

    .summary-table th {
      background-color: #f5f5f5;
      font-weight: bold;
    }

    .summary-table td:first-child {
      text-align: left;
      font-weight: 500;
    }

    .summary-table tfoot td {
      font-weight: bold;
      background-color: #f9f9f9;
    }

    .highlight {
      background-color: #e8f0fe;
    }
  `]
})
export class MetricPreviewComponent implements OnInit, OnChanges {
  @Input() config!: MetricConfig;
  @Input() assessmentId!: string;

  results: MetricResult[] = [];
  lineChartData: { name: string; series: { name: string; value: number }[] }[] = [];
  tableData: any[] = [];
  displayedColumns: string[] = [];
  textSummary: string = '';
  colorScheme = 'vivid';
  loading = false;
  error: string | null = null;
  radarChartData: any[] = [];
  summaryData: any[] = [];
  sectionAverages = {
    autoavaliacao: 0,
    gestor: 0,
    pares: 0,
    liderados: 0,
    resultado: 0
  };

  constructor(private assessmentDataService: AssessmentDataService) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['assessmentId'] || changes['config']) {
      this.loadData();
    }
  }

  private loadData(): void {
    if (!this.assessmentId || !this.config) {
      this.error = 'Configuração incompleta';
      return;
    }

    this.loading = true;
    this.error = null;

    this.assessmentDataService.getAssessmentData(this.assessmentId)
      .subscribe({
        next: (data) => {
          this.processData(data);
          this.loading = false;
        },
        error: (err) => {
          console.error('Erro ao carregar dados da métrica:', err);
          this.error = 'Erro ao carregar dados';
          this.loading = false;
        }
      });
  }

  private processData(data: any[]): void {
    if (!data || data.length === 0) {
      this.error = 'Sem dados disponíveis';
      return;
    }

    try {
      switch (this.config.type) {
        case 'bar':
        case 'pie':
        case 'radar':
          this.createChartData(data);
          break;
        case 'line':
          this.createLineChartData(data);
          break;
        case 'table':
          this.createTableData(data);
          break;
        case 'text':
          this.createTextSummary(data);
          break;
        case 'compare360':
          this.createCompare360Data(data);
          break;
        case 'radar360':
          this.createRadar360Data(data);
          break;
        case 'summary':
          this.createSummaryData(data);
          break;
        default:
          // Para tipos não implementados
          this.results = [];
      }
    } catch (error) {
      console.error('Erro ao processar dados:', error);
      this.error = 'Erro ao processar dados';
    }
  }

  private createChartData(data: any[]): void {
    const fieldMapping = this.config.fieldMapping || {};
    const labelField = fieldMapping.labels || '';
    const valueField = fieldMapping.values || '';

    if (!labelField || !valueField) {
      this.error = 'Mapeamento de campos incompleto';
      return;
    }

    // Agrupa os dados pelo campo de label
    const grouped = new Map<string, number>();

    data.forEach(item => {
      const surveyData = item.surveyData || {};
      const label = surveyData[labelField] || 'Sem resposta';
      const value = parseFloat(surveyData[valueField]) || 1;

      if (grouped.has(label)) {
        grouped.set(label, grouped.get(label)! + value);
      } else {
        grouped.set(label, value);
      }
    });

    // Converte para o formato esperado pelo ngx-charts
    this.results = Array.from(grouped.entries()).map(([name, value]) => ({
      name,
      value
    }));
  }

  private createLineChartData(data: any[]): void {
    const fieldMapping = this.config.fieldMapping || {};
    const labelField = fieldMapping.labels || '';
    const valueField = fieldMapping.values || '';

    if (!labelField || !valueField) {
      this.error = 'Mapeamento de campos incompleto';
      return;
    }

    // Agrupa os dados pelo campo de label
    const grouped = new Map<string, number[]>();

    data.forEach(item => {
      const surveyData = item.surveyData || {};
      const label = surveyData[labelField] || 'Sem resposta';
      const value = parseFloat(surveyData[valueField]) || 0;

      if (!grouped.has(label)) {
        grouped.set(label, []);
      }

      grouped.get(label)!.push(value);
    });

    // Calcula a média para cada grupo
    const averages = new Map<string, number>();
    grouped.forEach((values, key) => {
      const sum = values.reduce((acc, val) => acc + val, 0);
      averages.set(key, sum / values.length);
    });

    // Converte para o formato esperado pelo ngx-charts
    const series = Array.from(averages.entries())
      .map(([name, value]) => ({
        name,
        value
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    this.lineChartData = [{
      name: fieldMapping.title || 'Dados',
      series
    }];
  }

  private createTableData(data: any[]): void {
    const tableData = this.assessmentDataService.processDataForTable(data);
    this.tableData = tableData.slice(0, 5); // Limitando a 5 registros para a preview
    this.displayedColumns = this.assessmentDataService.getTableColumns(tableData);
  }

  private createTextSummary(data: any[]): void {
    const fieldMapping = this.config.fieldMapping || {};
    const valueField = fieldMapping.values || '';

    if (!valueField) {
      this.error = 'Mapeamento de campos incompleto';
      return;
    }

    // Extrai os valores do campo selecionado
    const values: number[] = [];
    data.forEach(item => {
      const surveyData = item.surveyData || {};
      const value = parseFloat(surveyData[valueField]);
      if (!isNaN(value)) {
        values.push(value);
      }
    });

    if (values.length === 0) {
      this.textSummary = 'Não há dados numéricos para análise.';
      return;
    }

    // Calcula estatísticas básicas
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Cria o texto de resumo
    this.textSummary = `
      Total de respostas: ${values.length}
      Média: ${avg.toFixed(2)}
      Valor mínimo: ${min}
      Valor máximo: ${max}
    `;
  }

  private createCompare360Data(data: any[]): void {
    // Exemplo de dados para comparação 360°
    this.results = [
      { name: 'Autoavaliação', value: 3.0 },
      { name: 'Gestor', value: 2.8 },
      { name: 'Pares', value: 3.1 },
      { name: 'Liderados', value: 3.0 },
      { name: 'Resultado final', value: 3.0 }
    ];
  }

  private createRadar360Data(data: any[]): void {
    // Exemplo de dados para o radar 360°
    this.radarChartData = [
      {
        name: 'Autoavaliação',
        series: [
          { name: 'Comunicação', value: 3.8 },
          { name: 'Organização', value: 3.0 },
          { name: 'Flexibilidade', value: 3.3 },
          { name: 'Previsibilidade', value: 3.0 },
          { name: 'Orientação aos resultados', value: 4.0 },
          { name: 'Confiança', value: 3.3 }
        ]
      },
      {
        name: 'Gestor',
        series: [
          { name: 'Comunicação', value: 2.3 },
          { name: 'Organização', value: 3.7 },
          { name: 'Flexibilidade', value: 3.3 },
          { name: 'Previsibilidade', value: 3.0 },
          { name: 'Orientação aos resultados', value: 2.3 },
          { name: 'Confiança', value: 2.5 }
        ]
      },
      {
        name: 'Pares',
        series: [
          { name: 'Comunicação', value: 4.8 },
          { name: 'Organização', value: 3.0 },
          { name: 'Flexibilidade', value: 3.3 },
          { name: 'Previsibilidade', value: 3.3 },
          { name: 'Orientação aos resultados', value: 2.7 },
          { name: 'Confiança', value: 3.3 }
        ]
      },
      {
        name: 'Liderados',
        series: [
          { name: 'Comunicação', value: 4.0 },
          { name: 'Organização', value: 4.7 },
          { name: 'Flexibilidade', value: 3.3 },
          { name: 'Previsibilidade', value: 4.0 },
          { name: 'Orientação aos resultados', value: 3.7 },
          { name: 'Confiança', value: 3.3 }
        ]
      }
    ];
  }

  private createSummaryData(data: any[]): void {
    // Exemplo de dados para o resumo da avaliação
    this.summaryData = [
      {
        competencia: 'Comunicação',
        autoavaliacao: 3.8,
        gestor: 2.3,
        pares: 4.8,
        liderados: 4.0,
        resultado: 3.7
      },
      {
        competencia: 'Organização',
        autoavaliacao: 3.0,
        gestor: 3.7,
        pares: 3.0,
        liderados: 4.7,
        resultado: 3.6
      },
      {
        competencia: 'Flexibilidade',
        autoavaliacao: 3.3,
        gestor: 3.3,
        pares: 3.3,
        liderados: 3.3,
        resultado: 3.3
      },
      {
        competencia: 'Previsibilidade',
        autoavaliacao: 3.0,
        gestor: 3.0,
        pares: 3.3,
        liderados: 4.0,
        resultado: 3.3
      },
      {
        competencia: 'Orientação aos resultados',
        autoavaliacao: 4.0,
        gestor: 2.3,
        pares: 2.7,
        liderados: 3.7,
        resultado: 3.2
      },
      {
        competencia: 'Confiança',
        autoavaliacao: 3.3,
        gestor: 2.5,
        pares: 3.3,
        liderados: 3.3,
        resultado: 3.1
      }
    ];

    // Calcular médias para o rodapé da tabela
    this.calculateSectionAverages();
  }

  private calculateSectionAverages(): void {
    if (!this.summaryData || this.summaryData.length === 0) return;

    let autoSum = 0, gestorSum = 0, paresSum = 0, lideradosSum = 0, resultadoSum = 0;

    this.summaryData.forEach(row => {
      autoSum += row.autoavaliacao;
      gestorSum += row.gestor;
      paresSum += row.pares;
      lideradosSum += row.liderados;
      resultadoSum += row.resultado;
    });

    const count = this.summaryData.length;

    this.sectionAverages = {
      autoavaliacao: parseFloat((autoSum / count).toFixed(1)),
      gestor: parseFloat((gestorSum / count).toFixed(1)),
      pares: parseFloat((paresSum / count).toFixed(1)),
      liderados: parseFloat((lideradosSum / count).toFixed(1)),
      resultado: parseFloat((resultadoSum / count).toFixed(1))
    };
  }
}
