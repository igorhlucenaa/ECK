import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Widget, WidgetType, COLOR_SCHEMES } from '../../models/dashboard.model';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { AnalyticsService } from '../../services/analytics.service';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CdkTableModule } from '@angular/cdk/table';
import { CdkHeaderRow, CdkRow } from '@angular/cdk/table';

@Component({
  selector: 'app-widget',
  standalone: true,
  imports: [
    CommonModule,
    NgxChartsModule,
    MatTableModule,
    MatMenuModule,
    MatSelectModule,
    MatOptionModule,
    MatIconModule,
    MatProgressSpinnerModule,
    CdkTableModule,
    CdkHeaderRow,
    CdkRow
  ],
  template: `
    <div class="widget-container" [ngClass]="{'loading': isLoading}">
      <div class="widget-header">
        <h3>{{ widget.visualOptions.title }}</h3>
        <div class="widget-actions">
          <button mat-icon-button [matMenuTriggerFor]="widgetMenu" aria-label="Menu do widget">
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #widgetMenu="matMenu">
            <button mat-menu-item (click)="editWidget()">
              <mat-icon>edit</mat-icon>
              <span>Editar</span>
            </button>
            <button mat-menu-item (click)="deleteWidget()">
              <mat-icon>delete</mat-icon>
              <span>Excluir</span>
            </button>
          </mat-menu>
        </div>
      </div>

      <div class="widget-content" *ngIf="!isLoading">
        <!-- Gráfico de Barras -->
        <ngx-charts-bar-vertical
          *ngIf="widget.type === 'bar_chart' && chartData.length > 0"
          [results]="chartData"
          [scheme]="'cool'"
          [gradient]="widget.visualOptions.gradient || false"
          [xAxis]="widget.visualOptions.showXAxis || true"
          [yAxis]="widget.visualOptions.showYAxis || true"
          [legend]="widget.visualOptions.showLegend || false"
          [showXAxisLabel]="widget.visualOptions.showXAxisLabel || false"
          [showYAxisLabel]="widget.visualOptions.showYAxisLabel || false"
          [xAxisLabel]="widget.visualOptions.xAxisLabel || ''"
          [yAxisLabel]="widget.visualOptions.yAxisLabel || ''"
          [showDataLabel]="widget.visualOptions.showLabels || false"
          (select)="onChartSelect($event)">
        </ngx-charts-bar-vertical>

        <!-- Gráfico de Pizza -->
        <ngx-charts-pie-chart
          *ngIf="widget.type === 'pie_chart' && chartData.length > 0"
          [results]="chartData"
          [scheme]="'cool'"
          [gradient]="widget.visualOptions.gradient || false"
          [legend]="widget.visualOptions.showLegend || true"
          [labels]="widget.visualOptions.showLabels || true"
          [doughnut]="false"
          (select)="onChartSelect($event)">
        </ngx-charts-pie-chart>

        <!-- Gráfico de Linha -->
        <ngx-charts-line-chart
          *ngIf="widget.type === 'line_chart' && chartData.length > 0"
          [results]="multiSeriesData"
          [scheme]="'cool'"
          [gradient]="widget.visualOptions.gradient || false"
          [xAxis]="widget.visualOptions.showXAxis || true"
          [yAxis]="widget.visualOptions.showYAxis || true"
          [legend]="widget.visualOptions.showLegend || true"
          [showXAxisLabel]="widget.visualOptions.showXAxisLabel || false"
          [showYAxisLabel]="widget.visualOptions.showYAxisLabel || false"
          [xAxisLabel]="widget.visualOptions.xAxisLabel || ''"
          [yAxisLabel]="widget.visualOptions.yAxisLabel || ''"
          (select)="onChartSelect($event)">
        </ngx-charts-line-chart>

        <!-- Gráfico Radar -->
        <ngx-charts-polar-chart
          *ngIf="widget.type === 'radar_chart' && chartData.length > 0"
          [results]="chartData"
          [scheme]="'cool'"
          [gradient]="widget.visualOptions.gradient || false"
          [xAxis]="widget.visualOptions.showXAxis || true"
          [yAxis]="widget.visualOptions.showYAxis || true"
          [legend]="widget.visualOptions.showLegend || true"
          [showXAxisLabel]="widget.visualOptions.showXAxisLabel || false"
          [showYAxisLabel]="widget.visualOptions.showYAxisLabel || false"
          [xAxisLabel]="widget.visualOptions.xAxisLabel || ''"
          [yAxisLabel]="widget.visualOptions.yAxisLabel || ''"
          (select)="onChartSelect($event)">
        </ngx-charts-polar-chart>

        <!-- Indicador Numérico -->
        <ngx-charts-number-card
          *ngIf="widget.type === 'number' && chartData.length > 0"
          [results]="chartData"
          [scheme]="'cool'"
          (select)="onChartSelect($event)">
        </ngx-charts-number-card>

        <!-- Tabela de Dados -->
        <div *ngIf="widget.type === 'table' && tableData">
          <cdk-table [dataSource]="tableData" class="mat-elevation-z2 w-100">
            <!-- Colunas Dinâmicas -->
            <ng-container *ngFor="let column of tableColumns" [cdkColumnDef]="column">
              <cdk-header-cell *cdkHeaderCellDef>{{ getColumnName(column) }}</cdk-header-cell>
              <cdk-cell *cdkCellDef="let element">{{ element[column] }}</cdk-cell>
            </ng-container>

            <cdk-header-row *cdkHeaderRowDef="tableColumns"></cdk-header-row>
            <cdk-row *cdkRowDef="let row; columns: tableColumns;"></cdk-row>
          </cdk-table>
        </div>

        <!-- Mensagem se não houver dados -->
        <div class="no-data-message" *ngIf="chartData.length === 0 && !isLoading">
          <mat-icon>info</mat-icon>
          <p>Nenhum dado disponível para exibição</p>
        </div>
      </div>

      <div class="loading-overlay" *ngIf="isLoading">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Carregando dados...</p>
      </div>
    </div>
  `,
  styles: [`
    .widget-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      position: relative;
      background-color: #fff;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    .widget-header {
      padding: 12px 16px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .widget-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
    }

    .widget-content {
      flex: 1;
      padding: 16px;
      overflow: auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255,255,255,0.8);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }

    .no-data-message {
      text-align: center;
      color: #666;
    }

    .no-data-message mat-icon {
      font-size: 48px;
      height: 48px;
      width: 48px;
      margin-bottom: 16px;
    }
  `]
})
export class WidgetComponent implements OnInit, OnChanges {
  @Input() widget!: Widget;
  @Input() editMode: boolean = false;
  @Input() assessmentId?: string;

  // Dados do gráfico
  chartData: any[] = [];
  multiSeriesData: any[] = [];

  // Dados da tabela
  tableData: MatTableDataSource<any> | null = null;
  tableColumns: string[] = [];

  // Estado de carregamento
  isLoading: boolean = true;

  // Esquema de cores para o gráfico
  'cool' = COLOR_SCHEMES['vivid'];

  constructor(private analyticsService: AnalyticsService) {}

  ngOnInit() {
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['widget'] || changes['assessmentId']) {
      this.loadData();
    }
  }

  /**
   * Carrega os dados para o widget
   */
  async loadData() {
    if (!this.assessmentId) {
      console.error('ID da avaliação não fornecido');
      return;
    }

    this.isLoading = true;

    try {
      switch (this.widget.type) {
        case WidgetType.NUMBER:
          this.chartData = await this.analyticsService.getCompetencyPerformance(this.assessmentId);
          break;
        case WidgetType.BAR_CHART:
        case WidgetType.PIE_CHART:
        case WidgetType.RADAR_CHART:
          this.chartData = await this.analyticsService.getCompetencyPerformance(this.assessmentId);
          break;
        case WidgetType.LINE_CHART:
          this.chartData = await this.analyticsService.getTimelineData(this.assessmentId);
          break;
        case WidgetType.TABLE:
          this.processTableData();
          break;
        default:
          console.warn(`Tipo de widget não suportado: ${this.widget.type}`);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do widget:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Processa dados para tabelas
   */
  private processTableData() {
    if (!this.chartData || this.chartData.length === 0) {
      this.tableData = null;
      this.tableColumns = [];
      return;
    }

    try {
      // Extrair colunas da primeira linha
      this.tableColumns = Object.keys(this.chartData[0]);

      // Criar fonte de dados para a tabela
      this.tableData = new MatTableDataSource(this.chartData);
    } catch (error) {
      console.error('Erro ao processar dados da tabela:', error);
      this.tableData = null;
      this.tableColumns = [];
    }
  }

  /**
   * Manipula evento de seleção em gráficos
   */
  onChartSelect(event: any) {
    console.log('Item selecionado:', event);
    // Aqui você pode implementar drill-down ou outras ações
  }

  /**
   * Obtém nome formatado para coluna da tabela
   */
  getColumnName(column: string): string {
    return column
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/\./g, ' ');
  }

  /**
   * Abre diálogo para editar o widget
   */
  editWidget() {
    // Aqui você pode implementar a lógica para abrir o diálogo de edição
    console.log('Editar widget:', this.widget);
  }

  /**
   * Remove o widget do dashboard
   */
  deleteWidget() {
    // Aqui você pode implementar a lógica para remover o widget
    console.log('Excluir widget:', this.widget);
  }
}
