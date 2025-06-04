/**
 * Definições de tipos para o dashboard
 */

/**
 * Tipos de widgets disponíveis
 */
export enum WidgetType {
  BAR_CHART = 'bar_chart',
  PIE_CHART = 'pie_chart',
  LINE_CHART = 'line_chart',
  TABLE = 'table',
  NUMBER = 'number',
  RADAR_CHART = 'radar_chart'
}

/**
 * Representação de uma posição no grid
 */
export interface GridPosition {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

/**
 * Definição de uma consulta ao Cube.js
 */
export interface CubeQuery {
  measures: string[];
  dimensions: string[];
  filters: {
    member: string;
    operator: string;
    values: string[];
  }[];
  timeDimensions?: {
    dimension: string;
    dateRange?: string[] | string;
    granularity?: string;
  }[];
  segments?: string[];
  limit?: number;
  offset?: number;
  order?: {
    [key: string]: 'asc' | 'desc';
  };
}

/**
 * Configuração de visualização do widget
 */
export interface VisualOptions {
  title: string;
  showLegend?: boolean;
  showLabels?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showXAxisLabel?: boolean;
  showYAxisLabel?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  gradient?: boolean;
}

/**
 * Definição completa de um widget
 */
export interface Widget {
  id: string;
  name: string;
  type: WidgetType;
  position: GridPosition;
  visualOptions: VisualOptions;
  assessmentId?: string;
}

/**
 * Definição de um dashboard completo
 */
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  layout?: {
    columns: number;
    rowHeight: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string; // ID do usuário que criou o dashboard
}

/**
 * Definição de um tema de cores
 */
export interface ColorScheme {
  name: string;
  selectable: boolean;
  group: string;
  domain: string[];
}

/**
 * Widgets predefinidos que podem ser adicionados ao dashboard
 */
export const WIDGET_TEMPLATES: Partial<Widget>[] = [
  {
    name: 'Média Geral',
    type: WidgetType.NUMBER,
    visualOptions: {
      title: 'Média Geral',
      showLegend: false
    }
  },
  {
    name: 'Gráfico de Barras',
    type: WidgetType.BAR_CHART,
    visualOptions: {
      title: 'Gráfico de Barras',
      showLegend: true,
      showXAxisLabel: true,
      showYAxisLabel: true,
      xAxisLabel: 'Categorias',
      yAxisLabel: 'Valores'
    }
  },
  {
    name: 'Gráfico de Pizza',
    type: WidgetType.PIE_CHART,
    visualOptions: {
      title: 'Gráfico de Pizza',
      showLegend: true,
      showLabels: true
    }
  },
  {
    name: 'Gráfico de Linha',
    type: WidgetType.LINE_CHART,
    visualOptions: {
      title: 'Gráfico de Linha',
      showLegend: true,
      showXAxisLabel: true,
      showYAxisLabel: true,
      xAxisLabel: 'Tempo',
      yAxisLabel: 'Valores'
    }
  },
  {
    name: 'Gráfico Radar',
    type: WidgetType.RADAR_CHART,
    visualOptions: {
      title: 'Gráfico Radar',
      showLegend: true
    }
  },
  {
    name: 'Tabela',
    type: WidgetType.TABLE,
    visualOptions: {
      title: 'Tabela de Dados'
    }
  }
];

/**
 * Esquemas de cores disponíveis
 */
export const COLOR_SCHEMES: { [key: string]: ColorScheme } = {
  vivid: {
    name: 'vivid',
    selectable: true,
    group: 'Ordinal',
    domain: [
      '#2196F3', '#4CAF50', '#FFC107', '#FF5722', '#9C27B0',
      '#3F51B5', '#F44336', '#009688', '#673AB7', '#FFEB3B'
    ]
  },
  cool: {
    name: 'cool',
    selectable: true,
    group: 'Ordinal',
    domain: [
      '#00A5B5', '#2575CF', '#459AF7', '#6A45D8', '#9339B5',
      '#C72E82', '#F44336', '#FF7043', '#FFA726', '#FFCA28'
    ]
  },
  natural: {
    name: 'natural',
    selectable: true,
    group: 'Ordinal',
    domain: [
      '#8BC34A', '#009688', '#4CAF50', '#CDDC39', '#FFC107',
      '#4DB6AC', '#7CB342', '#AED581', '#DCE775', '#FFD54F'
    ]
  }
};
