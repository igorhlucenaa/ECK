# 🚀 Exemplo Prático: Implementação com PDFMake

## 📦 Instalação

```bash
npm install pdfmake
npm install --save-dev @types/pdfmake
```

## 🔧 Configuração Inicial

```typescript
// src/app/services/report-pdfmake.service.ts
import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Configurar fontes
pdfMake.vfs = pdfFonts.pdfMake.vfs;

// Definir fontes padrão
pdfMake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf'
  }
};

@Injectable({ providedIn: 'root' })
export class ReportPdfMakeService {
  
  /**
   * Gera relatório completo em PDF usando PDFMake
   */
  async generateReport(data: ReportData): Promise<void> {
    const docDefinition = {
      content: [
        ...this.buildCover(data),
        ...this.buildIntroduction(data),
        ...this.buildExecutiveSummary(data),
        ...this.buildCompetencies(data),
        ...this.buildCharts(data),
        ...this.buildTables(data),
        ...this.buildHighlights(data)
      ],
      styles: this.getStyles(),
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
        lineHeight: 1.5
      },
      pageMargins: [40, 60, 40, 60],
      header: this.buildHeader(data),
      footer: this.buildFooter
    };

    pdfMake.createPdf(docDefinition).download(`relatorio-360-${data.participantName}.pdf`);
  }

  /**
   * Constrói capa do relatório
   */
  private buildCover(data: ReportData): any[] {
    return [
      {
        stack: [
          { text: 'RELATÓRIO DE AVALIAÇÃO 360°', style: 'coverTitle' },
          { text: data.participantName, style: 'coverSubtitle' },
          { text: data.participantEmail, style: 'coverEmail' },
          { text: `Projeto: ${data.projectName}`, style: 'coverProject' },
          { text: `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, style: 'coverDate' }
        ],
        alignment: 'center',
        absolutePosition: { x: 0, y: 200 },
        width: 595
      },
      { text: '', pageBreak: 'after' }
    ];
  }

  /**
   * Constrói introdução
   */
  private buildIntroduction(data: ReportData): any[] {
    return [
      { text: 'Introdução', style: 'sectionTitle' },
      {
        text: [
          'Este relatório apresenta os resultados da avaliação 360° realizada para ',
          { text: data.participantName, bold: true },
          '. A avaliação foi conduzida entre ',
          { text: data.startDate, bold: true },
          ' e ',
          { text: data.endDate, bold: true },
          ', contando com a participação de ',
          { text: data.totalRespondents.toString(), bold: true },
          ' avaliadores.'
        ],
        style: 'bodyText',
        margin: [0, 0, 0, 15]
      },
      {
        text: 'O relatório está organizado nas seguintes seções:',
        style: 'bodyText',
        margin: [0, 0, 0, 10]
      },
      {
        ul: [
          'Resumo Executivo',
          'Análise por Competências',
          'Gráficos Comparativos',
          'Tabelas Detalhadas',
          'Destaques e Recomendações'
        ],
        margin: [20, 0, 0, 20]
      }
    ];
  }

  /**
   * Constrói resumo executivo
   */
  private buildExecutiveSummary(data: ReportData): any[] {
    const topCompetencies = data.competencies
      .sort((a, b) => b.media - a.media)
      .slice(0, 5);

    const lowCompetencies = data.competencies
      .sort((a, b) => a.media - b.media)
      .slice(0, 5);

    return [
      { text: 'Resumo Executivo', style: 'sectionTitle', pageBreak: 'before' },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Top 5 Competências', style: 'subsectionTitle' },
              {
                table: {
                  headerRows: 1,
                  widths: ['*', 'auto'],
                  body: [
                    ['Competência', 'Média'],
                    ...topCompetencies.map(c => [
                      c.nome,
                      { text: c.media.toFixed(2), alignment: 'right' }
                    ])
                  ]
                },
                layout: {
                  fillColor: (rowIndex: number) => {
                    return rowIndex === 0 ? '#4A90E2' : null;
                  }
                }
              }
            ]
          },
          {
            width: 20,
            text: ''
          },
          {
            width: '*',
            stack: [
              { text: 'Áreas de Desenvolvimento', style: 'subsectionTitle' },
              {
                table: {
                  headerRows: 1,
                  widths: ['*', 'auto'],
                  body: [
                    ['Competência', 'Média'],
                    ...lowCompetencies.map(c => [
                      c.nome,
                      { text: c.media.toFixed(2), alignment: 'right' }
                    ])
                  ]
                },
                layout: {
                  fillColor: (rowIndex: number) => {
                    return rowIndex === 0 ? '#E24A4A' : null;
                  }
                }
              }
            ]
          }
        ],
        margin: [0, 10, 0, 20]
      }
    ];
  }

  /**
   * Constrói seção de competências
   */
  private buildCompetencies(data: ReportData): any[] {
    const sections = data.competencies.map(comp => ({
      stack: [
        { text: comp.nome, style: 'competencyTitle' },
        { text: comp.descricao, style: 'competencyDescription', margin: [0, 0, 0, 10] },
        {
          columns: [
            {
              width: 'auto',
              text: [
                { text: 'Média Geral: ', style: 'label' },
                { text: comp.media.toFixed(2), style: 'value', bold: true }
              ]
            },
            {
              width: '*',
              text: ''
            },
            {
              width: 'auto',
              text: [
                { text: 'Status: ', style: 'label' },
                { text: this.getStatusText(comp.media), style: 'value', color: this.getStatusColor(comp.media) }
              ]
            }
          ],
          margin: [0, 0, 0, 15]
        },
        this.buildCompetencyTable(comp),
        { text: '', margin: [0, 0, 0, 20] }
      ]
    }));

    return [
      { text: 'Análise por Competências', style: 'sectionTitle', pageBreak: 'before' },
      ...sections
    ];
  }

  /**
   * Constrói tabela de competência
   */
  private buildCompetencyTable(comp: Competency): any {
    const tableBody = [
      ['Categoria', 'Média', 'Total Respostas', 'Distribuição']
    ];

    comp.categorias.forEach(cat => {
      tableBody.push([
        cat.categoria,
        cat.media.toFixed(2),
        cat.totalRespostas.toString(),
        this.buildDistributionBar(cat.distribuicao)
      ]);
    });

    return {
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', '*'],
        body: tableBody
      },
      layout: 'lightGridLines',
      margin: [0, 0, 0, 15]
    };
  }

  /**
   * Constrói barra de distribuição visual
   */
  private buildDistributionBar(distribuicao: DistribuicaoNota[]): any {
    const total = distribuicao.reduce((sum, d) => sum + d.quantidade, 0);
    const bars = distribuicao.map(d => ({
      canvas: [
        {
          type: 'rect',
          x: 0,
          y: 0,
          w: (d.quantidade / total) * 100,
          h: 5,
          color: this.getNoteColor(d.nota)
        }
      ]
    }));

    return {
      stack: bars,
      margin: [5, 2, 5, 2]
    };
  }

  /**
   * Constrói seção de gráficos
   */
  private buildCharts(data: ReportData): any[] {
    // Para gráficos, você pode:
    // 1. Converter gráficos ECharts para imagens (canvas)
    // 2. Usar SVG (limitado no PDFMake)
    // 3. Criar gráficos simples com canvas do PDFMake

    const chartImages = data.charts.map(chart => ({
      image: this.chartToBase64(chart),
      width: 500,
      alignment: 'center',
      margin: [0, 10, 0, 20]
    }));

    return [
      { text: 'Análise Gráfica', style: 'sectionTitle', pageBreak: 'before' },
      ...chartImages
    ];
  }

  /**
   * Constrói tabelas detalhadas
   */
  private buildTables(data: ReportData): any[] {
    return [
      { text: 'Tabelas Detalhadas', style: 'sectionTitle', pageBreak: 'before' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', '*'],
          body: [
            ['Pergunta', 'Categoria', 'Média', 'Total', 'Observações'],
            ...data.detalhes.map(d => [
              d.pergunta,
              d.categoria,
              d.media.toFixed(2),
              d.total.toString(),
              d.observacoes || '-'
            ])
          ]
        },
        layout: {
          fillColor: (rowIndex: number) => {
            return rowIndex === 0 ? '#4A90E2' : (rowIndex % 2 === 0 ? '#F5F5F5' : null);
          }
        }
      }
    ];
  }

  /**
   * Constrói destaques e recomendações
   */
  private buildHighlights(data: ReportData): any[] {
    return [
      { text: 'Destaques e Recomendações', style: 'sectionTitle', pageBreak: 'before' },
      {
        stack: [
          { text: 'Pontos Fortes', style: 'subsectionTitle' },
          {
            ul: data.highlights.pontosFortes.map(pf => ({
              text: pf,
              margin: [0, 5, 0, 5]
            }))
          },
          { text: 'Áreas de Desenvolvimento', style: 'subsectionTitle', margin: [0, 20, 0, 10] },
          {
            ul: data.highlights.areasDesenvolvimento.map(ad => ({
              text: ad,
              margin: [0, 5, 0, 5]
            }))
          },
          { text: 'Recomendações', style: 'subsectionTitle', margin: [0, 20, 0, 10] },
          {
            ol: data.highlights.recomendacoes.map(rec => ({
              text: rec,
              margin: [0, 5, 0, 5]
            }))
          }
        ]
      }
    ];
  }

  /**
   * Constrói cabeçalho
   */
  private buildHeader(data: ReportData): any {
    return (currentPage: number, pageCount: number) => {
      return {
        columns: [
          {
            text: 'ECK - Avaliação 360°',
            alignment: 'left',
            fontSize: 8,
            color: '#666666'
          },
          {
            text: `Página ${currentPage} de ${pageCount}`,
            alignment: 'right',
            fontSize: 8,
            color: '#666666'
          }
        ],
        margin: [40, 20, 40, 0]
      };
    };
  }

  /**
   * Constrói rodapé
   */
  private buildFooter = (currentPage: number, pageCount: number) => {
    return {
      text: `© ${new Date().getFullYear()} ECK Consulting - Confidencial`,
      alignment: 'center',
      fontSize: 8,
      color: '#999999',
      margin: [40, 10, 40, 20]
    };
  };

  /**
   * Define estilos do documento
   */
  private getStyles(): any {
    return {
      coverTitle: {
        fontSize: 28,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 20],
        color: '#2C3E50'
      },
      coverSubtitle: {
        fontSize: 20,
        alignment: 'center',
        margin: [0, 0, 0, 10],
        color: '#34495E'
      },
      coverEmail: {
        fontSize: 12,
        alignment: 'center',
        margin: [0, 0, 0, 5],
        color: '#7F8C8D'
      },
      coverProject: {
        fontSize: 14,
        alignment: 'center',
        margin: [0, 20, 0, 5]
      },
      coverDate: {
        fontSize: 10,
        alignment: 'center',
        margin: [0, 10, 0, 0],
        color: '#95A5A6'
      },
      sectionTitle: {
        fontSize: 18,
        bold: true,
        color: '#2C3E50',
        margin: [0, 0, 0, 15]
      },
      subsectionTitle: {
        fontSize: 14,
        bold: true,
        color: '#34495E',
        margin: [0, 0, 0, 10]
      },
      competencyTitle: {
        fontSize: 16,
        bold: true,
        color: '#2980B9',
        margin: [0, 0, 0, 5]
      },
      competencyDescription: {
        fontSize: 11,
        color: '#555555',
        italics: true
      },
      bodyText: {
        fontSize: 11,
        alignment: 'justify',
        lineHeight: 1.6
      },
      label: {
        fontSize: 10,
        color: '#7F8C8D'
      },
      value: {
        fontSize: 10
      }
    };
  }

  /**
   * Converte gráfico ECharts para base64
   */
  private chartToBase64(chart: any): string {
    // Implementar conversão de gráfico para imagem
    // Exemplo usando html2canvas ou chart.toDataURL()
    const canvas = document.createElement('canvas');
    // ... lógica de conversão
    return canvas.toDataURL('image/png');
  }

  /**
   * Retorna texto de status
   */
  private getStatusText(media: number): string {
    if (media >= 4.5) return 'Excelente';
    if (media >= 3.5) return 'Bom';
    if (media >= 2.5) return 'Regular';
    return 'Necessita Desenvolvimento';
  }

  /**
   * Retorna cor do status
   */
  private getStatusColor(media: number): string {
    if (media >= 4.5) return '#27AE60';
    if (media >= 3.5) return '#3498DB';
    if (media >= 2.5) return '#F39C12';
    return '#E74C3C';
  }

  /**
   * Retorna cor da nota
   */
  private getNoteColor(nota: number): string {
    const colors = ['#E74C3C', '#E67E22', '#F39C12', '#3498DB', '#27AE60'];
    return colors[nota - 1] || '#95A5A6';
  }
}

// Interfaces
interface ReportData {
  participantName: string;
  participantEmail: string;
  projectName: string;
  startDate: string;
  endDate: string;
  totalRespondents: number;
  competencies: Competency[];
  charts: any[];
  detalhes: any[];
  highlights: {
    pontosFortes: string[];
    areasDesenvolvimento: string[];
    recomendacoes: string[];
  };
}

interface Competency {
  nome: string;
  descricao: string;
  media: number;
  categorias: Categoria[];
}

interface Categoria {
  categoria: string;
  media: number;
  totalRespostas: number;
  distribuicao: DistribuicaoNota[];
}

interface DistribuicaoNota {
  nota: number;
  quantidade: number;
}
```

## 📝 Uso no Componente

```typescript
// reports.component.ts
import { ReportPdfMakeService } from '../../services/report-pdfmake.service';

export class ReportsComponent {
  constructor(
    private pdfMakeService: ReportPdfMakeService
  ) {}

  async exportarRelatorioPDF(): Promise<void> {
    const reportData = this.prepareReportData();
    await this.pdfMakeService.generateReport(reportData);
  }

  private prepareReportData(): ReportData {
    return {
      participantName: this.individualParticipantName || 'Participante',
      participantEmail: this.individualParticipantEmail || '',
      projectName: this.selectedProjectName || 'Projeto',
      startDate: this.startDate || '',
      endDate: this.endDate || '',
      totalRespondents: this.totalParticipants || 0,
      competencies: this.prepareCompetencies(),
      charts: this.prepareCharts(),
      detalhes: this.prepareDetalhes(),
      highlights: this.prepareHighlights()
    };
  }
}
```

## ✅ Vantagens desta Abordagem

1. **Código Limpo**: Separação de responsabilidades
2. **Manutenível**: Fácil de modificar e estender
3. **Testável**: Serviço pode ser testado isoladamente
4. **Reutilizável**: Pode ser usado em outros componentes
5. **Performance**: PDFs nativos são mais rápidos e menores

## 🎨 Customização

PDFMake permite customização completa:
- Cores personalizadas
- Fontes customizadas
- Layouts complexos
- Tabelas avançadas
- Imagens e gráficos
- Headers e footers dinâmicos
