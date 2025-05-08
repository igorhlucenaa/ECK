import { Injectable } from '@angular/core';
import { MetricConfig, MetricResult, MetricsService } from './metrics.service';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import * as XLSX from 'xlsx';
import { TDocumentDefinitions, StyleDictionary } from 'pdfmake/interfaces';

export interface ExportConfig {
  assessmentId: string;
  metrics: MetricConfig[];
  format: 'pdf' | 'excel';
}

@Injectable({
  providedIn: 'root'
})
export class ReportExportService {
  constructor(private metricsService: MetricsService) {}

  async exportReport(config: ExportConfig) {
    const metricsData: { name: string; data: MetricResult[] }[] = [];

    // Calcular todas as métricas
    for (const metric of config.metrics) {
      const data = await this.metricsService.calculateMetric(config.assessmentId, metric);
      metricsData.push({ name: metric.name, data });
    }

    // Exportar no formato selecionado
    if (config.format === 'pdf') {
      await this.exportToPdf(metricsData);
    } else {
      await this.exportToExcel(metricsData);
    }
  }

  private async exportToPdf(metricsData: { name: string; data: MetricResult[] }[]) {
    const styles: StyleDictionary = {
      header: {
        fontSize: 22,
        bold: true,
        margin: [0, 0, 0, 10] as [number, number, number, number]
      },
      metricTitle: {
        fontSize: 16,
        bold: true,
        margin: [0, 20, 0, 10] as [number, number, number, number]
      },
      table: {
        margin: [0, 5, 0, 15] as [number, number, number, number]
      }
    };

    const docDefinition: TDocumentDefinitions = {
      content: [
        { text: 'Relatório de Métricas', style: 'header' },
        { text: new Date().toLocaleDateString('pt-BR'), alignment: 'right', margin: [0, 0, 0, 20] as [number, number, number, number] },
        ...this.createPdfContent(metricsData)
      ],
      styles
    };

    pdfMake.createPdf(docDefinition).download('relatorio-metricas.pdf');
  }

  private createPdfContent(metricsData: { name: string; data: MetricResult[] }[]) {
    const content: any[] = [];

    metricsData.forEach(metric => {
      content.push(
        { text: metric.name, style: 'metricTitle' },
        {
          style: 'table',
          table: {
            headerRows: 1,
            widths: ['*', '*'] as any,
            body: [
              ['Categoria', 'Valor'],
              ...metric.data.map(item => [
                item.x,
                item.y.toFixed(2)
              ])
            ]
          }
        }
      );
    });

    return content;
  }

  private async exportToExcel(metricsData: { name: string; data: MetricResult[] }[]) {
    const workbook = XLSX.utils.book_new();

    metricsData.forEach(metric => {
      const worksheet = XLSX.utils.json_to_sheet(
        metric.data.map(item => ({
          Categoria: item.x,
          Valor: item.y
        }))
      );

      XLSX.utils.book_append_sheet(workbook, worksheet, metric.name);
    });

    XLSX.writeFile(workbook, 'relatorio-metricas.xlsx');
  }
}
