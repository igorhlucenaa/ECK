import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Dashboard, Widget, GridPosition, WidgetType, WIDGET_TEMPLATES } from '../models/dashboard.model';
import { Firestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, updateDoc } from '@angular/fire/firestore';
import { AnalyticsService } from './analytics.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private currentDashboard = new BehaviorSubject<Dashboard | null>(null);
  private dashboards = new BehaviorSubject<Dashboard[]>([]);

  // Configurações padrão para novos dashboards
  private readonly DEFAULT_LAYOUT = {
    columns: 12,
    rowHeight: 100
  };

  constructor(
    private firestore: Firestore,
    private analyticsService: AnalyticsService
  ) {
    this.loadDashboards();
  }

  /**
   * Obtém o dashboard atual
   */
  getCurrentDashboard(): Observable<Dashboard | null> {
    return this.currentDashboard.asObservable();
  }

  /**
   * Obtém a lista de todos os dashboards
   */
  getDashboards(): Observable<Dashboard[]> {
    return this.dashboards.asObservable();
  }

  /**
   * Carrega todos os dashboards do Firestore
   */
  async loadDashboards(): Promise<void> {
    try {
      const dashboardsCollection = collection(this.firestore, 'dashboards');
      const dashboardsSnapshot = await getDocs(dashboardsCollection);

      const dashboardsList: Dashboard[] = [];
      dashboardsSnapshot.forEach(doc => {
        dashboardsList.push({ id: doc.id, ...doc.data() } as Dashboard);
      });

      this.dashboards.next(dashboardsList);
    } catch (error) {
      console.error('Erro ao carregar dashboards:', error);
    }
  }

  /**
   * Carrega um dashboard específico pelo ID
   */
  async loadDashboard(dashboardId: string): Promise<void> {
    try {
      const dashboardRef = doc(this.firestore, `dashboards/${dashboardId}`);
      const dashboardSnap = await getDoc(dashboardRef);

      if (dashboardSnap.exists()) {
        const dashboard = { id: dashboardSnap.id, ...dashboardSnap.data() } as Dashboard;
        this.currentDashboard.next(dashboard);
      } else {
        console.warn(`Dashboard com ID ${dashboardId} não encontrado`);
        this.currentDashboard.next(null);
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      this.currentDashboard.next(null);
    }
  }

  /**
   * Cria um novo dashboard
   */
  async createDashboard(name: string, description: string = ''): Promise<Dashboard> {
    const dashboardId = uuidv4();

    // Criar widgets padrão
    const defaultWidgets: Widget[] = [
      {
        id: uuidv4(),
        name: 'Média Geral',
        type: WidgetType.NUMBER,
        position: { x: 0, y: 0, cols: 3, rows: 2 },
        visualOptions: {
          title: 'Média Geral',
          showLegend: false
        }
      },
      {
        id: uuidv4(),
        name: 'Desempenho por Competência',
        type: WidgetType.RADAR_CHART,
        position: { x: 3, y: 0, cols: 6, rows: 5 },
        visualOptions: {
          title: 'Desempenho por Competência',
          showLegend: true
        }
      },
      {
        id: uuidv4(),
        name: 'Evolução por Período',
        type: WidgetType.LINE_CHART,
        position: { x: 0, y: 5, cols: 12, rows: 6 },
        visualOptions: {
          title: 'Evolução por Período',
          showLegend: true,
          showXAxisLabel: true,
          showYAxisLabel: true,
          xAxisLabel: 'Período',
          yAxisLabel: 'Média'
        }
      }
    ];

    const newDashboard: Dashboard = {
      id: dashboardId,
      name,
      description,
      widgets: defaultWidgets,
      layout: this.DEFAULT_LAYOUT,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      await setDoc(doc(this.firestore, 'dashboards', dashboardId), {
        name: newDashboard.name,
        description: newDashboard.description,
        widgets: newDashboard.widgets,
        layout: newDashboard.layout,
        createdAt: newDashboard.createdAt,
        updatedAt: newDashboard.updatedAt
      });

      await this.loadDashboards();
      this.currentDashboard.next(newDashboard);
      return newDashboard;
    } catch (error) {
      console.error('Erro ao criar dashboard:', error);
      throw error;
    }
  }

  /**
   * Atualiza um dashboard existente
   */
  async updateDashboard(dashboard: Dashboard): Promise<void> {
    try {
      dashboard.updatedAt = new Date();

      await updateDoc(doc(this.firestore, 'dashboards', dashboard.id), {
        name: dashboard.name,
        description: dashboard.description,
        widgets: dashboard.widgets,
        layout: dashboard.layout,
        updatedAt: dashboard.updatedAt
      });

      await this.loadDashboards();
      this.currentDashboard.next(dashboard);
    } catch (error) {
      console.error('Erro ao atualizar dashboard:', error);
      throw error;
    }
  }

  /**
   * Remove um dashboard
   */
  async deleteDashboard(dashboardId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, 'dashboards', dashboardId));
      await this.loadDashboards();

      // Se o dashboard atual foi excluído, limpar a seleção atual
      const current = this.currentDashboard.value;
      if (current && current.id === dashboardId) {
        this.currentDashboard.next(null);
      }
    } catch (error) {
      console.error('Erro ao excluir dashboard:', error);
      throw error;
    }
  }

  /**
   * Adiciona um novo widget ao dashboard atual
   */
  async addWidget(widgetTemplate: Partial<Widget>): Promise<Widget | null> {
    const dashboard = this.currentDashboard.value;
    if (!dashboard) return null;

    // Gerar ID único para o widget
    const widgetId = uuidv4();

    // Encontrar uma posição disponível no grid
    const position = this.findAvailablePosition(dashboard);

    // Criar o widget completo
    const newWidget: Widget = {
      id: widgetId,
      name: widgetTemplate.name || 'Novo Widget',
      type: widgetTemplate.type || WidgetType.BAR_CHART,
      position,
      visualOptions: widgetTemplate.visualOptions || {
        title: 'Novo Widget',
        showLegend: true,
        showLabels: true
      }
    };

    // Adicionar o widget ao dashboard
    dashboard.widgets.push(newWidget);

    // Atualizar o dashboard
    await this.updateDashboard(dashboard);

    return newWidget;
  }

  /**
   * Remove um widget do dashboard atual
   */
  async removeWidget(widgetId: string): Promise<void> {
    const dashboard = this.currentDashboard.value;
    if (!dashboard) return;

    const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
    if (widgetIndex === -1) return;

    dashboard.widgets.splice(widgetIndex, 1);
    await this.updateDashboard(dashboard);
  }

  /**
   * Atualiza um widget no dashboard atual
   */
  async updateWidget(updatedWidget: Widget): Promise<void> {
    const dashboard = this.currentDashboard.value;
    if (!dashboard) return;

    const widgetIndex = dashboard.widgets.findIndex(w => w.id === updatedWidget.id);
    if (widgetIndex === -1) return;

    dashboard.widgets[widgetIndex] = updatedWidget;
    await this.updateDashboard(dashboard);
  }

  /**
   * Atualiza a posição de um widget no dashboard
   */
  async updateWidgetPosition(widgetId: string, position: GridPosition): Promise<void> {
    const dashboard = this.currentDashboard.value;
    if (!dashboard) return;

    const widget = dashboard.widgets.find(w => w.id === widgetId);
    if (!widget) return;

    widget.position = position;
    await this.updateDashboard(dashboard);
  }

  /**
   * Encontra uma posição disponível no grid para um novo widget
   */
  private findAvailablePosition(dashboard: Dashboard): GridPosition {
    // Implementação simples: colocar o widget no final do último widget
    // Em uma implementação mais sofisticada, você pode usar um algoritmo de empacotamento

    if (dashboard.widgets.length === 0) {
      return { x: 0, y: 0, cols: 6, rows: 4 };
    }

    // Encontrar a coordenada Y mais baixa na grid
    const maxY = Math.max(...dashboard.widgets.map(w => w.position.y + w.position.rows));

    return {
      x: 0,
      y: maxY,
      cols: 6,
      rows: 4
    };
  }

  /**
   * Obtém os templates de widgets disponíveis
   */
  getWidgetTemplates(): Partial<Widget>[] {
    return [...WIDGET_TEMPLATES];
  }
}
