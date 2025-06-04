import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { GridsterConfig, GridsterItem, GridType, DisplayGrid, GridsterModule } from 'angular-gridster2';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';

import { DashboardService } from '../../services/dashboard.service';
import { CubeService } from '../../services/cube.service';
import { Dashboard, Widget, WidgetType, WIDGET_TEMPLATES } from '../../models/dashboard.model';
import { WidgetComponent } from '../widget/widget.component';

@Component({
  selector: 'app-dashboard-builder',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    GridsterModule,
    WidgetComponent,
    MatMenuModule
  ],
  template: `
    <div class="dashboard-builder-container">
      <!-- Barra de Ferramentas -->
      <div class="dashboard-toolbar mat-elevation-z2">
        <div class="dashboard-info">
          <button mat-icon-button (click)="goBack()">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <h2 *ngIf="dashboard">{{ dashboard.name }}</h2>
        </div>

        <div class="dashboard-actions">
          <button mat-button (click)="openAddWidgetDialog()">
            <mat-icon>add</mat-icon> Adicionar Widget
          </button>
          <button mat-button [matMenuTriggerFor]="templatesMenu">
            <mat-icon>dashboard</mat-icon> Templates
          </button>
          <mat-menu #templatesMenu="matMenu">
            <button mat-menu-item (click)="applyTemplate('performance')">
              <mat-icon>trending_up</mat-icon> Desempenho por Competência
            </button>
            <button mat-menu-item (click)="applyTemplate('comparison')">
              <mat-icon>compare</mat-icon> Comparativo Auto vs. Gestor
            </button>
            <button mat-menu-item (click)="applyTemplate('team')">
              <mat-icon>groups</mat-icon> Visão da Equipe
            </button>
          </mat-menu>

          <button mat-flat-button color="primary" (click)="saveDashboard()">
            <mat-icon>save</mat-icon> Salvar
          </button>
        </div>
      </div>

      <!-- Loading Spinner -->
      <div *ngIf="isLoading" class="loading-container">
        <mat-spinner diameter="50"></mat-spinner>
        <p>Carregando dashboard...</p>
      </div>

      <!-- Área do Dashboard -->
      <div *ngIf="!isLoading && dashboard" class="dashboard-content">
        <!-- Painel Lateral com Widgets Disponíveis -->
        <div class="widgets-panel mat-elevation-z2">
          <h3>Widgets Disponíveis</h3>
          <div class="widget-templates">
            <div
              *ngFor="let template of widgetTemplates"
              class="widget-template mat-elevation-z2"
              (click)="addWidget(template)">
              <mat-icon>{{ getWidgetIcon(template.type) }}</mat-icon>
              <span>{{ template.name }}</span>
            </div>
          </div>
        </div>

        <!-- Grid de Widgets -->
        <div class="grid-container mat-elevation-z1">
          <gridster [options]="gridsterOptions">
            <gridster-item
              *ngFor="let widget of dashboard.widgets"
              [item]="widget.position">
              <app-widget [widget]="widget"></app-widget>
            </gridster-item>
          </gridster>

          <!-- Mensagem para dashboard vazio -->
          <div *ngIf="dashboard.widgets.length === 0" class="empty-dashboard">
            <mat-icon>dashboard</mat-icon>
            <h3>Dashboard Vazio</h3>
            <p>Adicione widgets do painel lateral ou escolha um template para começar.</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-builder-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .dashboard-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background-color: #fff;
      z-index: 10;
    }

    .dashboard-info {
      display: flex;
      align-items: center;
    }

    .dashboard-info h2 {
      margin: 0 0 0 12px;
      font-size: 20px;
      font-weight: 500;
    }

    .dashboard-actions {
      display: flex;
      gap: 8px;
    }

    .dashboard-content {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .widgets-panel {
      width: 250px;
      background-color: #f5f5f5;
      overflow-y: auto;
      padding: 16px;
    }

    .widgets-panel h3 {
      margin-top: 0;
      margin-bottom: 16px;
      font-size: 16px;
      font-weight: 500;
    }

    .widget-templates {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .widget-template {
      display: flex;
      align-items: center;
      padding: 12px;
      background-color: #fff;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .widget-template:hover {
      background-color: #e3f2fd;
    }

    .widget-template mat-icon {
      margin-right: 8px;
    }

    .grid-container {
      flex: 1;
      position: relative;
      background-color: #fff;
      margin: 16px;
      border-radius: 4px;
      overflow: hidden;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100%;
    }

    .empty-dashboard {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: #aaa;
      text-align: center;
      padding: 32px;
    }

    .empty-dashboard mat-icon {
      font-size: 64px;
      height: 64px;
      width: 64px;
      margin-bottom: 16px;
    }
  `]
})
export class DashboardBuilderComponent implements OnInit {
  dashboard: Dashboard | null = null;
  widgetTemplates = WIDGET_TEMPLATES;
  isLoading = true;

  // Configurações do Gridster
  gridsterOptions: GridsterConfig = {
    gridType: GridType.Fit,
    displayGrid: DisplayGrid.Always,
    pushItems: true,
    draggable: {
      enabled: true
    },
    resizable: {
      enabled: true
    },
    minCols: 12,
    maxCols: 12,
    minRows: 12,
    margin: 10,
    outerMargin: true,
    outerMarginTop: null,
    outerMarginRight: null,
    outerMarginBottom: null,
    outerMarginLeft: null,
    mobileBreakpoint: 640,
    itemChangeCallback: this.onItemChange.bind(this),
    itemResizeCallback: this.onItemResize.bind(this),
  };

  constructor(
    private dashboardService: DashboardService,
    private cubeService: CubeService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadDashboard();
  }

  /**
   * Carrega o dashboard atual ou cria um novo
   */
  async loadDashboard() {
    this.isLoading = true;

    try {
      const dashboardId = this.route.snapshot.paramMap.get('id');

      if (dashboardId) {
        // Carregar dashboard existente
        await this.dashboardService.loadDashboard(dashboardId);
        this.dashboardService.getCurrentDashboard().subscribe(dashboard => {
          this.dashboard = dashboard;
          this.isLoading = false;
        });
      } else {
        // Criar um novo dashboard
        const newDashboard = await this.dashboardService.createDashboard('Novo Dashboard');
        this.dashboard = newDashboard;
        this.isLoading = false;
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      this.snackBar.open('Erro ao carregar dashboard', 'Fechar', { duration: 3000 });
      this.isLoading = false;
    }
  }

  /**
   * Obtém ícone apropriado para o tipo de widget
   */
  getWidgetIcon(type?: WidgetType): string {
    if (!type) return 'widgets';

    switch (type) {
      case WidgetType.BAR_CHART:
        return 'bar_chart';
      case WidgetType.PIE_CHART:
        return 'pie_chart';
      case WidgetType.LINE_CHART:
        return 'show_chart';
      case WidgetType.TABLE:
        return 'table_chart';
      case WidgetType.NUMBER:
        return 'pin';
      case WidgetType.RADAR_CHART:
        return 'track_changes';
      default:
        return 'widgets';
    }
  }

  /**
   * Adiciona um novo widget ao dashboard
   */
  async addWidget(template: Partial<Widget>) {
    if (!this.dashboard) return;

    try {
      const newWidget = await this.dashboardService.addWidget(template);
      this.snackBar.open('Widget adicionado com sucesso', 'Fechar', { duration: 2000 });
    } catch (error) {
      console.error('Erro ao adicionar widget:', error);
      this.snackBar.open('Erro ao adicionar widget', 'Fechar', { duration: 3000 });
    }
  }

  /**
   * Salva o dashboard atual
   */
  async saveDashboard() {
    if (!this.dashboard) return;

    try {
      await this.dashboardService.updateDashboard(this.dashboard);
      this.snackBar.open('Dashboard salvo com sucesso', 'Fechar', { duration: 2000 });
    } catch (error) {
      console.error('Erro ao salvar dashboard:', error);
      this.snackBar.open('Erro ao salvar dashboard', 'Fechar', { duration: 3000 });
    }
  }

  /**
   * Aplica um template pré-definido ao dashboard
   */
  async applyTemplate(templateName: string) {
    if (!this.dashboard) return;

    // Limpar widgets existentes
    this.dashboard.widgets = [];

    switch (templateName) {
      case 'performance':
        await this.createPerformanceTemplate();
        break;
      case 'comparison':
        await this.createComparisonTemplate();
        break;
      case 'team':
        await this.createTeamTemplate();
        break;
      default:
        console.warn(`Template "${templateName}" não encontrado`);
    }

    this.saveDashboard();
  }

  /**
   * Cria um template de dashboard de desempenho por competência
   */
  private async createPerformanceTemplate() {
    if (!this.dashboard) return;

    // Widget de média geral
    await this.dashboardService.addWidget({
      name: 'Média Geral',
      type: WidgetType.NUMBER,
      position: { x: 0, y: 0, cols: 3, rows: 2 },
      visualOptions: {
        title: 'Média Geral',
        showLegend: false
      }
    });

    // Widget de radar chart por competência
    await this.dashboardService.addWidget({
      name: 'Desempenho por Competência',
      type: WidgetType.RADAR_CHART,
      position: { x: 3, y: 0, cols: 6, rows: 5 },
      visualOptions: {
        title: 'Desempenho por Competência',
        showLegend: true
      }
    });

    // Widget de tabela detalhada
    await this.dashboardService.addWidget({
      name: 'Detalhes por Competência',
      type: WidgetType.TABLE,
      position: { x: 0, y: 5, cols: 12, rows: 7 },
      visualOptions: {
        title: 'Detalhes por Competência'
      }
    });
  }

  /**
   * Cria um template de dashboard de comparação entre autoavaliação e gestor
   */
  private async createComparisonTemplate() {
    if (!this.dashboard) return;

    // Widget de comparação de barras
    await this.dashboardService.addWidget({
      name: 'Auto vs. Gestor',
      type: WidgetType.BAR_CHART,
      position: { x: 0, y: 0, cols: 12, rows: 6 },
      visualOptions: {
        title: 'Comparação: Autoavaliação vs. Gestor',
        showLegend: true,
        showXAxisLabel: true,
        showYAxisLabel: true,
        xAxisLabel: 'Competência',
        yAxisLabel: 'Média'
      }
    });

    // Widget de diferenças
    await this.dashboardService.addWidget({
      name: 'Maiores Diferenças',
      type: WidgetType.TABLE,
      position: { x: 0, y: 6, cols: 12, rows: 6 },
      visualOptions: {
        title: 'Maiores Diferenças de Percepção'
      }
    });
  }

  /**
   * Cria um template de dashboard com visão geral da equipe
   */
  private async createTeamTemplate() {
    if (!this.dashboard) return;

    // Widget de média da equipe
    await this.dashboardService.addWidget({
      name: 'Média da Equipe',
      type: WidgetType.NUMBER,
      position: { x: 0, y: 0, cols: 3, rows: 2 },
      visualOptions: {
        title: 'Média da Equipe'
      }
    });

    // Widget de distribuição por competência
    await this.dashboardService.addWidget({
      name: 'Competências da Equipe',
      type: WidgetType.PIE_CHART,
      position: { x: 3, y: 0, cols: 9, rows: 5 },
      visualOptions: {
        title: 'Competências da Equipe',
        showLegend: true
      }
    });

    // Widget de evolução ao longo do tempo
    await this.dashboardService.addWidget({
      name: 'Evolução da Equipe',
      type: WidgetType.LINE_CHART,
      position: { x: 0, y: 5, cols: 12, rows: 6 },
      visualOptions: {
        title: 'Evolução da Equipe',
        showLegend: true,
        showXAxisLabel: true,
        showYAxisLabel: true,
        xAxisLabel: 'Período',
        yAxisLabel: 'Média'
      }
    });
  }

  /**
   * Callback para alterações de itens no grid
   */
  onItemChange(item: GridsterItem) {
    if (!this.dashboard) return;

    // Encontrar o widget correspondente à posição alterada
    const widget = this.dashboard.widgets.find(w =>
      w.position.x === item.x &&
      w.position.y === item.y &&
      w.position.cols === item.cols &&
      w.position.rows === item.rows
    );

    if (widget) {
      // Atualizar a posição do widget
      widget.position = {
        x: item.x || 0,
        y: item.y || 0,
        cols: item.cols || 1,
        rows: item.rows || 1
      };
    }
  }

  /**
   * Callback para redimensionamento de itens
   */
  onItemResize(item: GridsterItem) {
    // Mesmo comportamento que onItemChange
    this.onItemChange(item);
  }

  /**
   * Navega de volta para a página anterior
   */
  goBack() {
    this.router.navigate(['/assessments/dashboard']);
  }

  /**
   * Abre diálogo para adicionar widget
   */
  openAddWidgetDialog() {
    // Por simplicidade, apenas adicionamos um widget de barras padrão
    // Em uma implementação completa, você teria um diálogo para o usuário configurar o widget
    this.addWidget({
      name: 'Novo Gráfico',
      type: WidgetType.BAR_CHART,
      visualOptions: {
        title: 'Novo Gráfico',
        showLegend: true
      }
    });
  }
}
