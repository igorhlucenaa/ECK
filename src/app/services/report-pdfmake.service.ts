import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/enviroments/environment';

// Tipos para PDFMake (serão carregados dinamicamente)
interface PdfMakeModule {
  default?: any;
  createPdf?: (docDefinition: any) => any;
  vfs?: any;
  fonts?: any;
}

interface PdfFontsModule {
  default?: any;
  pdfMake?: {
    vfs?: any;
  };
  vfs?: any;
}

// Interfaces baseadas no componente reports
interface Competencia {
  id: string;
  nome: string;
  descricao: string;
  perguntasIds: string[];
}

export interface DocumentoConfig {
  cabecalho: {
    ativo: boolean;
    ocultarNaCapa: boolean;
    textoEsquerda: string;
    mostrarNomeProjeto: boolean;
    mostrarNumeroPagina: boolean;
    cor: string;
    linhaInferior: boolean;
    logoUrl?: string;
  };
  rodape: {
    ativo: boolean;
    ocultarNaCapa: boolean;
    texto: string;
    mostrarNumeroPagina: boolean;
    mostrarAno: boolean;
    cor: string;
    linhaSuperior: boolean;
  };
}

export const DOCUMENTO_CONFIG_PADRAO: DocumentoConfig = {
  cabecalho: {
    ativo: true,
    ocultarNaCapa: true,
    textoEsquerda: 'ECK - Avaliação 360°',
    mostrarNomeProjeto: false,
    mostrarNumeroPagina: true,
    cor: '#666666',
    linhaInferior: true,
  },
  rodape: {
    ativo: true,
    ocultarNaCapa: true,
    texto: 'ECK Consulting — Confidencial',
    mostrarNumeroPagina: false,
    mostrarAno: true,
    cor: '#999999',
    linhaSuperior: true,
  },
};

interface RelatorioSecao {
  id: string;
  tipo: 'capa' | 'introducao' | 'resumo' | 'graficos' | 'tabela' | 'tabela_detalhada' | 'destaques' | 'custom' | 'texto' | 'competencia_detalhada' | 'grafico_defasagem' | 'janela_johari' | 'perguntas_abertas';
  titulo?: string;
  texto?: string;
  visivel: boolean;
  ordem: number;
  competenciasIds?: string[];
  perguntasIds?: string[];
  textosPorCompetencia?: { [key: string]: string };
  tipoGrafico?: 'barra' | 'radar' | 'pizza-comparativa' | 'pizza-individual' | 'barras-individuais' | 'janela_johari';
  paletaCor?: string;
  pageBreakAntes?: boolean;
  pageBreakDepois?: boolean;
  [key: string]: any;
}

interface ReportData {
  participantName?: string;
  clientName?: string;
  participantEmail?: string;
  projectName?: string;
  startDate?: string;
  endDate?: string;
  totalRespondents?: number;
  competencies: Competencia[];
  dataSource: any[];
  questionMap: { [key: string]: string };
  relatorioConfiguracao: RelatorioSecao[];
  grupos: string[];
  getMediaPorPerguntaEGrupo: (comp: Competencia, grupo: string) => number | null;
  getCompetenciasSelecionadasParaGraficos: (secao: RelatorioSecao) => Competencia[];
  getCompetenciaBarraComparativaData: (comp: Competencia) => any[];
  getSecaoPieData: (secao: RelatorioSecao) => any[];
  getCompetenciaStackedData: (comp: Competencia) => any[];
  getSecaoRadarOptions: (secao: RelatorioSecao) => any;
  getJohariWindowData: (secao: RelatorioSecao) => any;
  getColorSchemeParaSecao: (secao: RelatorioSecao) => { domain: string[] };
  getDadosPerguntaDefasagem?: (perguntaId: string) => { selfScore: number | null; othersScore: number | null; gap: number | null } | null;
  mapCategoriaToGrupo?: (categoria: string) => string;
  getPerguntasAbertasData?: () => { perguntaId: string; perguntaTitulo: string; respostasPorCategoria: { [categoria: string]: string[] } }[];
  getCategoriasOrdenadas?: (respostasPorCategoria: { [categoria: string]: string[] }) => string[];
  documentoConfig?: DocumentoConfig;
}

interface PdfDocumentRuntimeMeta {
  documentoConfig?: DocumentoConfig;
  projectName?: string;
}

export interface PdfHtmlRenderOptions {
  format?: 'A4' | 'Letter';
  landscape?: boolean;
  scale?: number;
  preferCssPageSize?: boolean;
  marginMm?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportPdfMakeService {

  /** Cache: carrega pdfmake + fontes apenas uma vez por sessão */
  private pdfMakeLib: any = null;
  private readonly PDF_GENERATION_TIMEOUT_MS = 180000;
  private readonly CHART_IMAGE_PIXEL_RATIO = 1.25;
  private readonly CHART_IMAGE_JPEG_QUALITY = 0.82;
  private readonly MAX_DISTRIBUTION_ROWS_PER_TABLE = 25;
  private readonly MAX_COMPETENCY_DETAIL_ROWS_PER_TABLE = 80;
  private readonly ROBOTO_FONTS = {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf'
  };

  constructor(private readonly http: HttpClient) {}

  private extractVfsMap(fontsModule: any): Record<string, string> {
    if (!fontsModule) return {};

    if (fontsModule?.pdfMake?.vfs) return fontsModule.pdfMake.vfs;
    if (fontsModule?.vfs) return fontsModule.vfs;
    if (fontsModule?.default?.pdfMake?.vfs) return fontsModule.default.pdfMake.vfs;

    const directEntries = Object.entries(fontsModule).filter(([key, value]) =>
      /\.(ttf|otf)$/i.test(key) && typeof value === 'string'
    ) as [string, string][];

    if (directEntries.length > 0) return Object.fromEntries(directEntries);
    return {};
  }

  private registerVirtualFileSystem(lib: any, vfsMap: Record<string, string>): void {
    if (!vfsMap || Object.keys(vfsMap).length === 0) return;

    if (typeof lib.addVirtualFileSystem === 'function') {
      lib.addVirtualFileSystem(vfsMap);
      return;
    }

    lib.vfs = { ...(lib.vfs || {}), ...vfsMap };
  }

  private registerRobotoFontFamily(lib: any): void {
    const normal = this.hasFontInVirtualFs(lib, this.ROBOTO_FONTS.normal)
      ? this.ROBOTO_FONTS.normal
      : '';

    if (!normal) {
      throw new Error(`Fonte '${this.ROBOTO_FONTS.normal}' nao disponivel no virtual file system do pdfmake.`);
    }

    const fontsDef = {
      Roboto: {
        normal,
        bold: this.hasFontInVirtualFs(lib, this.ROBOTO_FONTS.bold) ? this.ROBOTO_FONTS.bold : normal,
        italics: this.hasFontInVirtualFs(lib, this.ROBOTO_FONTS.italics) ? this.ROBOTO_FONTS.italics : normal,
        bolditalics: this.hasFontInVirtualFs(lib, this.ROBOTO_FONTS.bolditalics) ? this.ROBOTO_FONTS.bolditalics : normal
      }
    };

    if (typeof lib.addFonts === 'function') {
      lib.addFonts(fontsDef);
      return;
    }

    lib.fonts = {
      ...(lib.fonts || {}),
      ...fontsDef
    };
  }

  private hasFontInVirtualFs(lib: any, fileName: string): boolean {
    if (lib?.virtualfs && typeof lib.virtualfs.existsSync === 'function') {
      return Boolean(lib.virtualfs.existsSync(fileName));
    }
    return Boolean(lib?.vfs?.[fileName]);
  }

  private createPdfBlobWithTimeout(pdfMakeLib: any, docDefinition: any): Promise<Blob> {
    this.validateTableStructures(docDefinition);

    return Promise.race<Blob>([
      new Promise<Blob>((resolve, reject) => {
        try {
          pdfMakeLib.createPdf(docDefinition).getBlob((blob: Blob) => {
            if (blob && blob.size > 0) resolve(blob);
            else reject(new Error('PDFMake retornou blob vazio'));
          });
        } catch (e) {
          reject(e);
        }
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout ao gerar PDF (${Math.round(this.PDF_GENERATION_TIMEOUT_MS / 1000)}s)`)),
          this.PDF_GENERATION_TIMEOUT_MS
        )
      )
    ]);
  }

  private chunkArray<T>(items: T[], chunkSize: number): T[][] {
    if (items.length === 0) return [];
    const safeChunkSize = Math.max(1, chunkSize);
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += safeChunkSize) {
      chunks.push(items.slice(i, i + safeChunkSize));
    }
    return chunks;
  }

  private cloneTableRow(row: any[]): any[] {
    return row.map(cell => {
      if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
        return { ...cell };
      }
      return cell;
    });
  }

  /**
   * Valida estrutura de tabelas para evitar erros silenciosos do PDFMake
   * que normalmente aparecem apenas como timeout.
   */
  private validateTableStructures(docDefinition: any): void {
    const errors: string[] = [];

    const walk = (node: any, path: string): void => {
      if (node == null) return;

      if (Array.isArray(node)) {
        node.forEach((item, index) => walk(item, `${path}[${index}]`));
        return;
      }

      if (typeof node !== 'object') return;

      const table = node.table;
      if (table && Array.isArray(table.body) && Array.isArray(table.widths)) {
        const expectedColumns = table.widths.length;
        table.body.forEach((row: any, rowIndex: number) => {
          if (!Array.isArray(row)) {
            errors.push(`${path}.table.body[${rowIndex}] nao e array`);
            return;
          }

          if (row.length !== expectedColumns) {
            errors.push(
              `${path}.table.body[${rowIndex}] tem ${row.length} colunas; esperado ${expectedColumns}`
            );
          }
        });
      }

      Object.entries(node).forEach(([key, value]) => {
        if (key === 'table') return;
        walk(value, `${path}.${key}`);
      });
    };

    walk(docDefinition, 'docDefinition');

    if (errors.length > 0) {
      throw new Error(`Estrutura de tabela invalida: ${errors.slice(0, 4).join(' | ')}`);
    }
  }

  private async loadPdfMake(): Promise<any> {
    if (this.pdfMakeLib) return this.pdfMakeLib;

    try {
      // @ts-ignore
      const [pdfMakeModule, pdfFontsModule] = await Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts')
      ]);
      const lib = pdfMakeModule.default || pdfMakeModule;
      const fontsModule = pdfFontsModule.default || pdfFontsModule;
      const vfsMap = this.extractVfsMap(fontsModule);

      this.registerVirtualFileSystem(lib, vfsMap);
      this.registerRobotoFontFamily(lib);

      this.pdfMakeLib = lib;
      return lib;
    } catch (e: any) {
      throw new Error(`PDFMake não pôde ser carregado: ${e?.message || e}`);
    }
  }

  private sanitizeFileNamePart(value: string | null | undefined, fallback: string): string {
    const sanitized = (value || '')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return sanitized || fallback;
  }

  private buildDefaultFileName(data: ReportData): string {
    const participantName = this.sanitizeFileNamePart(data.participantName, 'Participante');
    const clientName = this.sanitizeFileNamePart(data.clientName, 'Cliente');
    return `${participantName}_Relatório Feedback 360_${clientName}.pdf`;
  }

  /**
   * Constrói o docDefinition compartilhado entre generateReport e generateReportBlob
   */
  private async buildDocDefinition(data: ReportData): Promise<any> {
    const docDefinition = {
      content: [] as any[],
      styles: this.getStyles(),
      defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.5 },
      pageMargins: [40, 60, 40, 60],
      header: this.buildHeader(data),
      footer: this.buildFooter(data),
    };

    const secoesOrdenadas = [...data.relatorioConfiguracao]
      .filter(s => s.visivel)
      .sort((a, b) => a.ordem - b.ordem);

    for (const secao of secoesOrdenadas) {
      const conteudo = await this.buildSection(secao, data);
      if (conteudo && conteudo.length > 0) {
        docDefinition.content.push(...conteudo);
      }
    }

    return docDefinition;
  }

  private getGeneratePdfFunctionUrl(): string {
    const url = environment.functions?.generateReportPdfUrl?.trim();
    if (!url) {
      throw new Error('URL da Cloud Function de PDF nao configurada (environment.functions.generateReportPdfUrl).');
    }
    return url;
  }

  private makeDocDefinitionTransportSafe(docDefinition: any): any {
    const serialized = JSON.stringify(
      docDefinition,
      (_key, value) => (typeof value === 'function' ? undefined : value)
    );
    const parsed = JSON.parse(serialized);

    if (!parsed.defaultStyle || typeof parsed.defaultStyle !== 'object') {
      parsed.defaultStyle = { font: 'Roboto', fontSize: 10, lineHeight: 1.5 };
    } else if (!parsed.defaultStyle.font) {
      parsed.defaultStyle = { ...parsed.defaultStyle, font: 'Roboto' };
    }

    if (!parsed.header) {
      const ch = DOCUMENTO_CONFIG_PADRAO.cabecalho;
      parsed.header = {
        columns: [
          { text: ch.textoEsquerda, alignment: 'left', fontSize: 8, color: ch.cor },
          { text: 'Página — de —', alignment: 'right', fontSize: 8, color: ch.cor }
        ],
        margin: [40, 20, 40, 0]
      };
    }

    if (!parsed.footer) {
      const rf = DOCUMENTO_CONFIG_PADRAO.rodape;
      parsed.footer = {
        text: `${rf.texto} | © ${new Date().getFullYear()}`,
        alignment: 'center',
        fontSize: 8,
        color: rf.cor,
        margin: [40, 10, 40, 20]
      };
    }

    return parsed;
  }

  private triggerBrowserDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private async buildCloudFunctionErrorMessage(error: unknown): Promise<string> {
    const fallbackMessage = 'Falha ao gerar PDF no backend.';

    if (!(error instanceof HttpErrorResponse)) {
      const nonHttpMessage = (error as Error | undefined)?.message;
      return nonHttpMessage || fallbackMessage;
    }

    const statusPrefix = error.status
      ? `Cloud Function (${error.status})`
      : 'Cloud Function';

    if (error.status === 413) {
      return `${statusPrefix}: payload muito grande para processamento.`;
    }

    const errorPayload = error.error;

    if (typeof errorPayload === 'string' && errorPayload.trim()) {
      return `${statusPrefix}: ${errorPayload.trim()}`;
    }

    if (errorPayload instanceof Blob) {
      try {
        const text = (await errorPayload.text()).trim();
        if (!text) return `${statusPrefix}: ${fallbackMessage}`;

        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed?.error) return `${statusPrefix}: ${parsed.error}`;
        } catch {
          // resposta nao era JSON; segue com texto bruto
        }

        return `${statusPrefix}: ${text}`;
      } catch {
        return `${statusPrefix}: ${fallbackMessage}`;
      }
    }

    if (errorPayload && typeof errorPayload === 'object') {
      const maybeError = (errorPayload as { error?: string }).error;
      if (maybeError) return `${statusPrefix}: ${maybeError}`;
    }

    return `${statusPrefix}: ${error.message || fallbackMessage}`;
  }

  private async generateReportViaCloudFunction(data: ReportData, fileName: string): Promise<void> {
    try {
      const blob = await this.generateReportBlobFromCloudFunction(data, fileName);
      this.triggerBrowserDownload(blob, fileName);
    } catch (error) {
      const message = await this.buildCloudFunctionErrorMessage(error);
      throw new Error(message);
    }
  }

  /**
   * Gera relatório via Cloud Function e retorna o Blob (sem download).
   * Usado para geração em lote onde precisamos acumular os PDFs antes de zipar.
   */
  async generateReportBlobFromCloudFunction(data: ReportData, fileName: string): Promise<Blob> {
    const functionUrl = this.getGeneratePdfFunctionUrl();
    const docDefinition = await this.buildDocDefinition(data);
    const safeDocDefinition = this.makeDocDefinitionTransportSafe(docDefinition);
    this.validateTableStructures(safeDocDefinition);
    const documentMeta: PdfDocumentRuntimeMeta = {
      documentoConfig: data.documentoConfig,
      projectName: data.projectName,
    };

    const payload = {
      fileName,
      docDefinition: safeDocDefinition,
      documentMeta,
    };

    const blob = await firstValueFrom(
      this.http.post(functionUrl, payload, {
        responseType: 'blob'
      })
    );

    if (!blob || blob.size === 0) {
      throw new Error('Cloud Function retornou PDF vazio.');
    }

    return blob;
  }

  async generateReportBlobFromHtml(
    html: string,
    fileName: string,
    options?: PdfHtmlRenderOptions
  ): Promise<Blob> {
    try {
      const functionUrl = this.getGeneratePdfFunctionUrl();
      const blob = await firstValueFrom(
        this.http.post(functionUrl, { html, fileName, options }, {
          responseType: 'blob'
        })
      );

      if (!blob || blob.size === 0) {
        throw new Error('Cloud Function retornou PDF vazio.');
      }

      return blob;
    } catch (error) {
      const message = await this.buildCloudFunctionErrorMessage(error);
      throw new Error(message);
    }
  }

  async generateReportFromHtml(html: string, fileName: string, options?: PdfHtmlRenderOptions): Promise<void> {
    const blob = await this.generateReportBlobFromHtml(html, fileName, options);
    this.triggerBrowserDownload(blob, fileName);
  }

  /**
   * Gera relatório e retorna como Blob (usado para geração em lote / ZIP)
   */
  async generateReportBlob(data: ReportData): Promise<Blob> {
    const pdfMakeLib = await this.loadPdfMake();
    const docDefinition = await this.buildDocDefinition(data);
    return this.createPdfBlobWithTimeout(pdfMakeLib, docDefinition);
  }

  /**
   * Gera relatório completo em PDF usando PDFMake
   */
  async generateReport(data: ReportData, fileName?: string): Promise<void> {
    try {
      const filename = fileName || this.buildDefaultFileName(data);
      await this.generateReportViaCloudFunction(data, filename);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      throw error;
    }
  }

  /**
   * Constrói uma seção do relatório baseada no tipo
   */
  private async buildSection(secao: RelatorioSecao, data: ReportData): Promise<any[]> {
    let content!: any[];

    switch (secao.tipo) {
      case 'capa':
        content = this.buildCover(data); break;
      case 'introducao':
        content = this.buildIntroduction(data, secao); break;
      case 'resumo':
        content = this.buildExecutiveSummary(data, secao); break;
      case 'graficos':
        content = await this.buildChartsSection(data, secao); break;
      case 'tabela':
        content = this.buildTablesSection(data, secao); break;
      case 'tabela_detalhada':
        content = this.buildDetailedDistributionTable(data, secao); break;
      case 'destaques':
        content = this.buildHighlights(data, secao); break;
      case 'competencia_detalhada':
        content = this.buildCompetencyDetail(data, secao); break;
      case 'grafico_defasagem':
        content = await this.buildGapChart(data, secao); break;
      case 'janela_johari':
        content = await this.buildJohariWindow(data, secao); break;
      case 'perguntas_abertas':
        content = this.buildPerguntasAbertas(data, secao); break;
      case 'texto':
      case 'custom':
        content = this.buildTextSection(secao); break;
      default:
        return [];
    }

    if (!content || content.length === 0) return [];

    // pageBreakAntes: remove the hardcoded pageBreak:'before' when explicitly disabled
    if (secao.tipo !== 'capa' && secao.pageBreakAntes === false && content[0]?.pageBreak === 'before') {
      const { pageBreak: _pb, ...rest } = content[0];
      content[0] = rest;
    }

    // pageBreakDepois: append a forced page break after this section
    if (secao.pageBreakDepois === true) {
      content.push({ text: '', pageBreak: 'after' });
    }

    return content;
  }

  /**
   * Constrói capa do relatório
   */
  private buildCover(data: ReportData): any[] {
    return [
      {
        stack: [
          { text: 'RELATÓRIO DE AVALIAÇÃO 360°', style: 'coverTitle' },
          { text: data.participantName || 'Participante', style: 'coverSubtitle' },
          ...(data.participantEmail ? [{ text: data.participantEmail, style: 'coverEmail' }] : []),
          ...(data.projectName ? [{ text: `Projeto: ${data.projectName}`, style: 'coverProject' }] : []),
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
  private buildIntroduction(data: ReportData, secao: RelatorioSecao): any[] {
    const textoIntro = secao.texto || `Este relatório apresenta os resultados da avaliação 360° realizada para ${data.participantName || 'o participante'}.`;

    return [
      { text: secao.titulo || 'Introdução', style: 'sectionTitle' },
      {
        text: textoIntro,
        style: 'bodyText',
        margin: [0, 0, 0, 15]
      }
    ];
  }

  /**
   * Constrói resumo executivo
   */
  private buildExecutiveSummary(data: ReportData, secao: RelatorioSecao): any[] {
    const competencias = data.getCompetenciasSelecionadasParaGraficos(secao);

    if (competencias.length === 0) {
      return [];
    }

    // Calcular médias
    const medias = competencias.map(comp => {
      let somaTotal = 0;
      let contadorTotal = 0;

      data.grupos.forEach(grupo => {
        const media = data.getMediaPorPerguntaEGrupo(comp, grupo);
        if (media !== null && !isNaN(media)) {
          somaTotal += media;
          contadorTotal++;
        }
      });

      const mediaGeral = contadorTotal > 0 ? somaTotal / contadorTotal : 0;
      return { nome: comp.nome, media: mediaGeral };
    });

    const topCompetencies = [...medias]
      .sort((a, b) => b.media - a.media)
      .slice(0, 5);

    const lowCompetencies = [...medias]
      .sort((a, b) => a.media - b.media)
      .slice(0, 5);

    return [
      { text: secao.titulo || 'Resumo Executivo', style: 'sectionTitle', pageBreak: 'before' },
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
          { width: 20, text: '' },
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
                      { text: c.media.toFixed(2), alignment: 'right' } as any
                    ])
                  ] as any[]
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
   * Constrói seção de gráficos
   */
  private async buildChartsSection(data: ReportData, secao: RelatorioSecao): Promise<any[]> {
    const tipoGrafico = secao.tipoGrafico || 'barra';
    const competencias = data.getCompetenciasSelecionadasParaGraficos(secao);

    if (competencias.length === 0) {
      return [];
    }

    const content: any[] = [
      { text: secao.titulo || 'Análise Gráfica', style: 'sectionTitle', pageBreak: 'before' }
    ];

    switch (tipoGrafico) {
      case 'barra':
        for (const comp of competencias) {
          const dadosGrafico = data.getCompetenciaBarraComparativaData(comp);
          const chartImage = await this.createBarChartImage(dadosGrafico, comp.nome, data.getColorSchemeParaSecao(secao));
          content.push(
            { text: comp.nome, style: 'competencyTitle', margin: [0, 20, 0, 5] },
            { text: comp.descricao, style: 'competencyDescription', margin: [0, 0, 0, 10] },
            { image: chartImage, width: 500, alignment: 'center', margin: [0, 0, 0, 20] }
          );
        }
        break;

      case 'radar':
        const radarOptions = data.getSecaoRadarOptions(secao);
        const radarImage = await this.createRadarChartImage(radarOptions, competencias.map(c => c.nome));
        content.push({ image: radarImage, width: 500, alignment: 'center', margin: [0, 10, 0, 20] });
        break;

      case 'pizza-comparativa':
        const pieData = data.getSecaoPieData(secao);
        const pieImage = await this.createPieChartImage(pieData, 'Comparação de Competências', data.getColorSchemeParaSecao(secao));
        content.push({ image: pieImage, width: 500, alignment: 'center', margin: [0, 10, 0, 20] });
        break;

      case 'pizza-individual':
        for (const comp of competencias) {
          const dadosPizza = data.getCompetenciaStackedData(comp);
          const pieImage = await this.createPieChartImage(
            dadosPizza.map(d => ({ name: d.name, value: d.value })),
            comp.nome,
            data.getColorSchemeParaSecao(secao)
          );
          content.push(
            { text: comp.nome, style: 'competencyTitle', margin: [0, 20, 0, 5] },
            { image: pieImage, width: 400, alignment: 'center', margin: [0, 0, 0, 20] }
          );
        }
        break;

      case 'barras-individuais':
        for (const comp of competencias) {
          const stackedData = data.getCompetenciaStackedData(comp);
          const chartImage = await this.createStackedBarChartImage(stackedData, comp.nome, data.getColorSchemeParaSecao(secao));
          content.push(
            { text: comp.nome, style: 'competencyTitle', margin: [0, 20, 0, 5] },
            { image: chartImage, width: 500, alignment: 'center', margin: [0, 0, 0, 20] }
          );
        }
        break;
    }

    return content;
  }

  /**
   * Constrói tabela de distribuição detalhada (tabela_detalhada)
   */
  private buildDetailedDistributionTable(data: ReportData, secao: RelatorioSecao): any[] {
    const competencias = data.getCompetenciasSelecionadasParaGraficos(secao);

    if (competencias.length === 0) {
      return [];
    }

    const content: any[] = [
      { text: secao.titulo || 'Tabela de Distribuição de Notas', style: 'sectionTitle', pageBreak: 'before' }
    ];

    // Para cada competência, criar tabela de distribuição
    for (const comp of competencias) {
      const textoIntro = secao['textosPorCompetencia']?.[comp.id] || '';

      content.push(
        { text: comp.nome, style: 'competencyTitle', margin: [0, 20, 0, 10] },
        { text: comp.descricao, style: 'competencyDescription', margin: [0, 0, 0, 10] }
      );

      if (textoIntro) {
        // Converter HTML simples para texto (PDFMake não suporta HTML completo)
        const textoLimpo = textoIntro.replace(/<[^>]*>/g, '').trim();
        if (textoLimpo) {
          content.push({
            text: textoLimpo,
            style: 'bodyText',
            margin: [0, 0, 0, 15]
          });
        }
      }

      // Construir tabela de distribuição
      const grupos = data.grupos;
      const perguntas = comp.perguntasIds || [];

      // Cabeçalho da tabela
      const headerRow: any[] = [
        { text: comp.nome.toUpperCase(), style: 'tableHeader', rowSpan: 2, alignment: 'center' }
      ];

      // Cabeçalho de categorias (com colspan 5 para cada)
      grupos.forEach(grupo => {
        headerRow.push({
          text: this.getAbreviacaoCategoria(grupo),
          style: 'tableHeader',
          colSpan: 5,
          alignment: 'center'
        });
        for (let i = 1; i < 5; i++) {
          headerRow.push({ text: '', style: 'tableHeader' });
        }
      });

      const subHeaderRow: any[] = [{ text: '', style: 'tableSubHeader' }];
      grupos.forEach(() => {
        for (let nota = 1; nota <= 5; nota++) {
          subHeaderRow.push({ text: nota.toString(), style: 'tableSubHeader', alignment: 'center' });
        }
      });

      const questionRows: any[] = [];

      // Linhas de perguntas
      perguntas.forEach(perguntaId => {
        const perguntaTexto = data.questionMap[perguntaId] || perguntaId;
        const row: any[] = [{ text: perguntaTexto, style: 'tableCell', fontSize: 9 }];

        grupos.forEach(grupo => {
          // Contar distribuição de notas para esta pergunta e grupo
          const respostas = data.dataSource
            .filter(row => this.mapCategoriaToGrupo(row['categoria'], data) === grupo)
            .map(row => {
              let valor = row[perguntaId];
              if (typeof valor === 'string' && valor.includes('Column')) {
                const match = valor.match(/Column (\d+)/);
                if (match) valor = parseInt(match[1]);
              }
              return typeof valor === 'number' ? valor : parseFloat(valor);
            })
            .filter(val => !isNaN(val) && val >= 1 && val <= 5);

          // Contar por nota
          const distribuicao: number[] = [0, 0, 0, 0, 0]; // índices 0-4 para notas 1-5
          respostas.forEach(val => {
            const notaIndex = Math.floor(val) - 1;
            if (notaIndex >= 0 && notaIndex < 5) {
              distribuicao[notaIndex]++;
            }
          });

          // Adicionar células de distribuição
          distribuicao.forEach((qtd, index) => {
            row.push({
              text: qtd > 0 ? qtd.toString() : '',
              style: 'tableCell',
              alignment: 'center',
              fontSize: 9
            });
          });
        });

        questionRows.push(row);
      });

      // Linha de médias
      const mediaRow: any[] = [{ text: 'Média', style: 'tableHeader', bold: true }];
      grupos.forEach(grupo => {
        const media = data.getMediaPorPerguntaEGrupo(comp, grupo);
        const mediaTexto = (media !== null && !isNaN(media)) ? media.toFixed(1) : '';
        mediaRow.push({
          text: mediaTexto,
          style: 'tableHeader',
          colSpan: 5,
          alignment: 'center',
          bold: true
        });
        for (let i = 1; i < 5; i++) {
          mediaRow.push({ text: '', style: 'tableHeader' });
        }
      });
      // Calcular larguras das colunas
      const widths: any[] = ['*']; // Coluna de perguntas
      grupos.forEach(() => {
        for (let i = 0; i < 5; i++) {
          widths.push(14);
        }
      });

      const questionChunks = this.chunkArray(questionRows, this.MAX_DISTRIBUTION_ROWS_PER_TABLE);
      const chunksToRender = questionChunks.length > 0 ? questionChunks : [[]];

      chunksToRender.forEach((chunkRows, chunkIndex) => {
        const isLastChunk = chunkIndex === chunksToRender.length - 1;
        const tableBody: any[] = [
          this.cloneTableRow(headerRow),
          this.cloneTableRow(subHeaderRow),
          ...chunkRows.map(row => this.cloneTableRow(row))
        ];

        if (isLastChunk) {
          tableBody.push(this.cloneTableRow(mediaRow));
        }

        content.push({
          table: {
            headerRows: 2,
            widths: widths,
            body: tableBody
          },
          layout: {
            fillColor: (rowIndex: number) => {
              if (rowIndex === 0 || rowIndex === 1) return '#4CAF50';
              if (isLastChunk && rowIndex === tableBody.length - 1) return '#81C784';
              return rowIndex % 2 === 0 ? '#F9F9F9' : null;
            }
          },
          margin: [0, 0, 0, isLastChunk ? 30 : 12]
        });
      });
    }

    return content;
  }

  /**
   * Abreviação de categoria para exibição
   */
  private getAbreviacaoCategoria(categoria: string): string {
    const abreviacoes: { [key: string]: string } = {
      'Avaliado(a)': 'A',
      'Gestor(es)': 'G',
      'Pares': 'P',
      'Subordinados': 'S',
      'Outros': 'O'
    };
    return abreviacoes[categoria] || categoria.substring(0, 1).toUpperCase();
  }

  /**
   * Constrói seção de tabelas
   */
  private buildTablesSection(data: ReportData, secao: RelatorioSecao): any[] {
    const competencias = data.getCompetenciasSelecionadasParaGraficos(secao);

    if (competencias.length === 0) {
      return [];
    }

    const content: any[] = [
      { text: secao.titulo || 'Tabelas Detalhadas', style: 'sectionTitle', pageBreak: 'before' }
    ];

    for (const comp of competencias) {
      const tableBody = [['Categoria', 'Média', 'Total Respostas']];

      data.grupos.forEach(grupo => {
        const media = data.getMediaPorPerguntaEGrupo(comp, grupo);
        if (media !== null && !isNaN(media)) {
          // Contar total de respostas
          let totalRespostas = 0;
          comp.perguntasIds.forEach(perguntaId => {
            const respostas = data.dataSource
              .filter(row => this.mapCategoriaToGrupo(row['categoria'], data) === grupo)
              .map(row => row[perguntaId])
              .filter(val => val !== undefined && val !== null && val !== '');
            totalRespostas += respostas.length;
          });

          tableBody.push([
            grupo,
            { text: media.toFixed(2), alignment: 'right' } as any,
            { text: totalRespostas.toString(), alignment: 'right' } as any
          ]);
        }
      });

      content.push(
        { text: comp.nome, style: 'competencyTitle', margin: [0, 20, 0, 10] },
        { text: comp.descricao, style: 'competencyDescription', margin: [0, 0, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto'],
            body: tableBody
          },
          layout: {
            fillColor: (rowIndex: number) => {
              return rowIndex === 0 ? '#4A90E2' : (rowIndex % 2 === 0 ? '#F5F5F5' : null);
            }
          },
          margin: [0, 0, 0, 20]
        }
      );
    }

    return content;
  }

  /**
   * Constrói destaques e recomendações
   */
  private buildHighlights(data: ReportData, secao: RelatorioSecao): any[] {
    const competencias = data.getCompetenciasSelecionadasParaGraficos(secao);

    if (competencias.length === 0) {
      return [];
    }

    // Calcular pontos fortes e áreas de desenvolvimento
    const medias = competencias.map(comp => {
      let somaTotal = 0;
      let contadorTotal = 0;

      data.grupos.forEach(grupo => {
        const media = data.getMediaPorPerguntaEGrupo(comp, grupo);
        if (media !== null && !isNaN(media)) {
          somaTotal += media;
          contadorTotal++;
        }
      });

      return {
        nome: comp.nome,
        media: contadorTotal > 0 ? somaTotal / contadorTotal : 0
      };
    });

    const pontosFortes = medias
      .filter(m => m.media >= 4.0)
      .map(m => `${m.nome} (${m.media.toFixed(2)})`);

    const areasDesenvolvimento = medias
      .filter(m => m.media < 3.0)
      .map(m => `${m.nome} (${m.media.toFixed(2)})`);

    const recomendacoes: string[] = [];
    if (areasDesenvolvimento.length > 0) {
      recomendacoes.push(`Focar no desenvolvimento de ${areasDesenvolvimento[0].split(' (')[0]}`);
    }
    if (pontosFortes.length > 0) {
      recomendacoes.push(`Aproveitar o ponto forte em ${pontosFortes[0].split(' (')[0]}`);
    }

    return [
      { text: secao.titulo || 'Destaques e Recomendações', style: 'sectionTitle', pageBreak: 'before' },
      {
        stack: [
          ...(pontosFortes.length > 0 ? [
            { text: 'Pontos Fortes', style: 'subsectionTitle' },
            {
              ul: pontosFortes.map(pf => ({ text: pf, margin: [0, 5, 0, 5] })),
              margin: [20, 0, 0, 15]
            }
          ] : []),
          ...(areasDesenvolvimento.length > 0 ? [
            { text: 'Áreas de Desenvolvimento', style: 'subsectionTitle', margin: [0, 20, 0, 10] },
            {
              ul: areasDesenvolvimento.map(ad => ({ text: ad, margin: [0, 5, 0, 5] })),
              margin: [20, 0, 0, 15]
            }
          ] : []),
          ...(recomendacoes.length > 0 ? [
            { text: 'Recomendações', style: 'subsectionTitle', margin: [0, 20, 0, 10] },
            {
              ol: recomendacoes.map(rec => ({ text: rec, margin: [0, 5, 0, 5] })),
              margin: [20, 0, 0, 15]
            }
          ] : [])
        ]
      }
    ];
  }

  /**
   * Constrói detalhamento de competência
   */
  private buildCompetencyDetail(data: ReportData, secao: RelatorioSecao): any[] {
    const competencias = data.getCompetenciasSelecionadasParaGraficos(secao);
    const content: any[] = [];

    for (const comp of competencias) {
      const perguntas = comp.perguntasIds || [];
      const headerRow: any[] = ['Pergunta', 'Categoria', 'Media', 'Respostas'];
      const detailRows: any[] = [];

      perguntas.forEach(perguntaId => {
        const perguntaTexto = data.questionMap[perguntaId] || perguntaId;

        data.grupos.forEach(grupo => {
          const respostas = data.dataSource
            .filter(row => this.mapCategoriaToGrupo(row['categoria'], data) === grupo)
            .map(row => {
              let valor = row[perguntaId];
              if (typeof valor === 'string' && valor.includes('Column')) {
                const match = valor.match(/Column (\d+)/);
                if (match) valor = parseInt(match[1]);
              }
              return typeof valor === 'number' ? valor : parseFloat(valor);
            })
            .filter(val => !isNaN(val) && val >= 1 && val <= 5);

          if (respostas.length > 0) {
            const media = respostas.reduce((a, b) => a + b, 0) / respostas.length;
            detailRows.push([
              perguntaTexto,
              grupo,
              { text: media.toFixed(2), alignment: 'right' } as any,
              { text: respostas.length.toString(), alignment: 'right' } as any
            ]);
          }
        });
      });

      content.push(
        { text: comp.nome, style: 'competencyTitle', pageBreak: 'before' },
        { text: comp.descricao, style: 'competencyDescription', margin: [0, 0, 0, 15] }
      );

      if (detailRows.length === 0) {
        content.push({
          text: 'Sem dados disponiveis para esta competencia.',
          style: 'bodyText',
          margin: [0, 0, 0, 20]
        });
        continue;
      }

      const chunks = this.chunkArray(detailRows, this.MAX_COMPETENCY_DETAIL_ROWS_PER_TABLE);

      chunks.forEach((chunkRows, chunkIndex) => {
        if (chunkIndex > 0) {
          content.push({
            text: `${comp.nome} (continuacao)`,
            style: 'subsectionTitle',
            margin: [0, 10, 0, 8]
          });
        }

        const tableBody = [
          this.cloneTableRow(headerRow),
          ...chunkRows.map(row => this.cloneTableRow(row))
        ];

        content.push({
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: tableBody
          },
          layout: {
            fillColor: (rowIndex: number) => {
              return rowIndex === 0 ? '#4A90E2' : (rowIndex % 2 === 0 ? '#F5F5F5' : null);
            }
          },
          margin: [0, 0, 0, chunkIndex === chunks.length - 1 ? 20 : 10]
        });
      });
    }

    return content;
  }

  /**
   * Constrói gráfico de defasagem (Gap Chart)
   */
  private async buildGapChart(data: ReportData, secao: RelatorioSecao): Promise<any[]> {
    const competencias = data.getCompetenciasSelecionadasParaGraficos(secao);

    if (competencias.length === 0) {
      return [];
    }

    const gapData: Array<{ competencyName: string; selfScore: number | null; othersScore: number | null; gap: number | null }> = [];

    competencias.forEach(comp => {
      const perguntas = comp.perguntasIds || [];
      const selfVals: number[] = [];
      const othersVals: number[] = [];

      perguntas.forEach(perguntaId => {
        // Autoavaliação
        const selfRows = data.dataSource.filter(row =>
          this.mapCategoriaToGrupo(row['categoria'], data) === 'Avaliado(a)'
        );
        selfRows.forEach(row => {
          let valor = row[perguntaId];
          if (typeof valor === 'string' && valor.includes('Column')) {
            const match = valor.match(/Column (\d+)/);
            if (match) valor = parseInt(match[1]);
          }
          const numVal = typeof valor === 'number' ? valor : parseFloat(valor);
          if (!isNaN(numVal) && numVal >= 1 && numVal <= 5) {
            selfVals.push(numVal);
          }
        });

        // Outros
        const othersRows = data.dataSource.filter(row =>
          this.mapCategoriaToGrupo(row['categoria']) !== 'Avaliado(a)'
        );
        othersRows.forEach(row => {
          let valor = row[perguntaId];
          if (typeof valor === 'string' && valor.includes('Column')) {
            const match = valor.match(/Column (\d+)/);
            if (match) valor = parseInt(match[1]);
          }
          const numVal = typeof valor === 'number' ? valor : parseFloat(valor);
          if (!isNaN(numVal) && numVal >= 1 && numVal <= 5) {
            othersVals.push(numVal);
          }
        });
      });

      const selfScore = selfVals.length > 0 ? selfVals.reduce((a, b) => a + b, 0) / selfVals.length : null;
      const othersScore = othersVals.length > 0 ? othersVals.reduce((a, b) => a + b, 0) / othersVals.length : null;
      const gap = (selfScore !== null && othersScore !== null) ? selfScore - othersScore : null;

      gapData.push({
        competencyName: comp.nome,
        selfScore,
        othersScore,
        gap
      });
    });

    const gapImage = await this.createGapChartImage(gapData);

    return [
      { text: secao.titulo || 'Análise de Defasagem', style: 'sectionTitle', pageBreak: 'before' },
      { image: gapImage, width: 500, alignment: 'center', margin: [0, 10, 0, 20] }
    ];
  }

  /**
   * Constrói Janela de Johari
   */
  private async buildJohariWindow(data: ReportData, secao: RelatorioSecao): Promise<any[]> {
    const johariData = data.getJohariWindowData(secao);

    if (!johariData || !johariData.points || johariData.points.length === 0) {
      return [];
    }

    const johariImage = await this.createJohariWindowImage(johariData);

    return [
      {
        stack: [
          { text: secao.titulo || 'Janela de Johari', style: 'sectionTitle' },
          { image: johariImage, width: 500, alignment: 'center', margin: [0, 10, 0, 20] }
        ],
        pageBreak: 'before',
        unbreakable: true
      }
    ];
  }

  /**
   * Constrói seção de perguntas abertas (continuar, parar, começar a fazer)
   */
  private buildPerguntasAbertas(data: ReportData, secao: RelatorioSecao): any[] {
    const getData = data.getPerguntasAbertasData;
    const getCategorias = data.getCategoriasOrdenadas;
    if (!getData || !getCategorias) return [];

    const items = getData();
    if (items.length === 0) return [];

    const content: any[] = [
      { text: secao.titulo || 'Perguntas Abertas', style: 'sectionTitle', pageBreak: 'before' },
      ...(secao.texto ? [{ text: secao.texto, style: 'bodyText', margin: [0, 0, 0, 15] }] : [])
    ];

    for (const item of items) {
      content.push({ text: item.perguntaTitulo, style: 'subsectionTitle', margin: [0, 15, 0, 8] });
      const categorias = getCategorias(item.respostasPorCategoria);
      for (const cat of categorias) {
        const respostas = item.respostasPorCategoria[cat] || [];
        if (respostas.length === 0) continue;
        content.push({ text: cat, fontSize: 11, bold: true, margin: [0, 8, 0, 4] });
        content.push({
          ul: respostas.map((r: string) => ({ text: r, fontSize: 10 })),
          margin: [15, 0, 0, 8]
        });
      }
    }

    return content;
  }

  /**
   * Constrói seção de texto customizado
   */
  private buildTextSection(secao: RelatorioSecao): any[] {
    return [
      { text: secao.titulo || '', style: 'sectionTitle', pageBreak: 'before' },
      {
        text: secao.texto || '',
        style: 'bodyText',
        margin: [0, 10, 0, 20]
      }
    ];
  }

  /**
   * Tenta capturar gráfico ECharts do DOM usando getDataURL se disponível
   */
  /**
   * Tenta capturar gráfico ECharts via getDataURL (instantâneo, sem DOM capture).
   * Retorna null imediatamente se o elemento/instância não estiver disponível.
   */
  private tryCaptureEChartsFromDOM(elementId: string): string | null {
    try {
      const element = document.getElementById(elementId);
      if (!element) return null;
      const echartsInstance = (element as any).__echarts_instance__;
      if (echartsInstance && typeof echartsInstance.getDataURL === 'function') {
        return echartsInstance.getDataURL({
          type: 'jpeg',
          pixelRatio: this.CHART_IMAGE_PIXEL_RATIO,
          quality: this.CHART_IMAGE_JPEG_QUALITY,
          backgroundColor: '#FFFFFF'
        });
      }
      return null;
    } catch {
      return null;
    }
  }

  /** @deprecated Não mais utilizado — mantido para compatibilidade */
  private captureNgxChartFromDOM(_element: HTMLElement | null): null {
    return null;
  }

  /**
   * Cria imagem de gráfico de barras horizontal
   */
  private async createBarChartImage(
    data: Array<{ name: string; value: number }>,
    title: string,
    colorScheme: { domain: string[] }
  ): Promise<string> {
    // Tentar capturar do DOM primeiro (se gráfico ECharts estiver renderizado)
    const chartId = `chart-bar-${title.replace(/\s+/g, '-').toLowerCase()}`;
    const domImage = this.tryCaptureEChartsFromDOM(chartId);
    if (domImage) return domImage;

    // Fallback: criar canvas manualmente
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = Math.max(300, data.length * 50 + 100);
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Título
    ctx.fillStyle = '#2C3E50';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, 30);

    // Configurações
    const margin = { top: 60, right: 50, bottom: 60, left: 150 };
    const chartWidth = canvas.width - margin.left - margin.right;
    const chartHeight = canvas.height - margin.top - margin.bottom;
    const barHeight = chartHeight / Math.max(data.length, 1);
    const maxValue = Math.max(...data.map(d => d.value), 5);

    // Eixos
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 1;

    // Linha vertical (eixo X)
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.stroke();

    // Linha horizontal (eixo Y)
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + chartHeight);
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.stroke();

    // Grid e labels do eixo X
    ctx.font = '12px Arial';
    ctx.fillStyle = '#666666';
    for (let i = 0; i <= 5; i++) {
      const x = margin.left + (i / 5) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.strokeStyle = '#E0E0E0';
      ctx.stroke();

      ctx.fillStyle = '#666666';
      ctx.textAlign = 'center';
      ctx.fillText(i.toString(), x, margin.top + chartHeight + 20);
    }

    // Barras e labels do eixo Y
    data.forEach((item, index) => {
      const y = margin.top + index * barHeight + barHeight / 2;
      const barWidth = (item.value / maxValue) * chartWidth;
      const color = colorScheme.domain[index % colorScheme.domain.length] || '#3498DB';

      // Barra
      ctx.fillStyle = color;
      ctx.fillRect(margin.left, y - barHeight / 2 + 5, barWidth, barHeight - 10);

      // Label do eixo Y
      ctx.fillStyle = '#2C3E50';
      ctx.textAlign = 'right';
      ctx.font = '12px Arial';
      ctx.fillText(item.name, margin.left - 10, y + 5);

      // Valor na barra
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.font = 'bold 11px Arial';
      if (barWidth > 50) {
        ctx.fillText(item.value.toFixed(2), margin.left + 5, y + 5);
      }
    });

    return canvas.toDataURL('image/jpeg', this.CHART_IMAGE_JPEG_QUALITY);
  }

  /**
   * Cria imagem de gráfico radar
   */
  private async createRadarChartImage(
    radarOptions: any,
    labels: string[]
  ): Promise<string> {
    // Tentar capturar do DOM primeiro
    const chartId = `chart-radar-${labels.join('-').replace(/\s+/g, '-').toLowerCase()}`;
    const domImage = this.tryCaptureEChartsFromDOM(chartId);
    if (domImage) return domImage;

    // Fallback: criar canvas manualmente
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    if (!ctx || !radarOptions || !radarOptions.radar || !radarOptions.series) {
      return '';
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 200;
    const indicators = radarOptions.radar.indicator || [];
    const seriesData = radarOptions.series[0]?.data || [];

    if (indicators.length === 0 || seriesData.length === 0) {
      return canvas.toDataURL('image/jpeg', this.CHART_IMAGE_JPEG_QUALITY);
    }

    // Desenhar círculos concêntricos
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (radius * i) / 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Desenhar eixos
    const angleStep = (Math.PI * 2) / indicators.length;
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 1;
    indicators.forEach((ind: any, index: number) => {
      const angle = index * angleStep - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#2C3E50';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      const labelX = centerX + Math.cos(angle) * (radius + 30);
      const labelY = centerY + Math.sin(angle) * (radius + 30);
      ctx.fillText(ind.name, labelX, labelY);
    });

    // Desenhar polígono para cada série
    seriesData.forEach((serie: any, serieIndex: number) => {
      const values = serie.value || [];
      const color = ['#3498DB', '#E74C3C', '#2ECC71', '#F39C12'][serieIndex % 4];

      ctx.strokeStyle = color;
      ctx.fillStyle = color + '40'; // Transparência
      ctx.lineWidth = 2;
      ctx.beginPath();

      values.forEach((value: number, index: number) => {
        const angle = index * angleStep - Math.PI / 2;
        const normalizedValue = value / (indicators[index]?.max || 5);
        const r = radius * normalizedValue;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pontos
      values.forEach((value: number, index: number) => {
        const angle = index * angleStep - Math.PI / 2;
        const normalizedValue = value / (indicators[index]?.max || 5);
        const r = radius * normalizedValue;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Legenda
      ctx.fillStyle = '#2C3E50';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(serie.name || `Série ${serieIndex + 1}`, 20, 30 + serieIndex * 20);
    });

    return canvas.toDataURL('image/jpeg', this.CHART_IMAGE_JPEG_QUALITY);
  }

  /**
   * Cria imagem de gráfico de pizza
   */
  private async createPieChartImage(
    data: Array<{ name: string; value: number }>,
    title: string,
    colorScheme: { domain: string[] }
  ): Promise<string> {
    // Tentar capturar do DOM primeiro
    const chartId = `chart-pie-${title.replace(/\s+/g, '-').toLowerCase()}`;
    const domImage = this.tryCaptureEChartsFromDOM(chartId);
    if (domImage) return domImage;

    // Fallback: criar canvas manualmente
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Título
    ctx.fillStyle = '#2C3E50';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, 30);

    const centerX = canvas.width / 2;
    const centerY = 200;
    const radius = 120;
    const total = data.reduce((sum, d) => sum + d.value, 0);

    if (total === 0) {
      return canvas.toDataURL('image/jpeg', this.CHART_IMAGE_JPEG_QUALITY);
    }

    let currentAngle = -Math.PI / 2;

    // Desenhar fatias
    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * Math.PI * 2;
      const color = colorScheme.domain[index % colorScheme.domain.length] || '#3498DB';

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      const labelAngle = currentAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius + 30);
      const labelY = centerY + Math.sin(labelAngle) * (radius + 30);

      ctx.fillStyle = '#2C3E50';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.name, labelX, labelY - 10);

      const percent = ((item.value / total) * 100).toFixed(1);
      ctx.fillText(`${percent}%`, labelX, labelY + 10);

      currentAngle += sliceAngle;
    });

    // Legenda
    const legendY = 350;
    data.forEach((item, index) => {
      const color = colorScheme.domain[index % colorScheme.domain.length] || '#3498DB';
      const x = 50 + (index % 3) * 150;
      const y = legendY + Math.floor(index / 3) * 30;

      ctx.fillStyle = color;
      ctx.fillRect(x, y, 15, 15);

      ctx.fillStyle = '#2C3E50';
      ctx.font = '11px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(item.name, x + 20, y + 12);
    });

    return canvas.toDataURL('image/jpeg', this.CHART_IMAGE_JPEG_QUALITY);
  }

  /**
   * Cria imagem de gráfico de barras empilhadas
   */
  private async createStackedBarChartImage(
    data: Array<{ name: string; value: number }>,
    title: string,
    colorScheme: { domain: string[] }
  ): Promise<string> {
    // Similar ao gráfico de barras, mas com barras empilhadas
    return this.createBarChartImage(data, title, colorScheme);
  }

  /**
   * Cria imagem do gráfico de Gap
   */
  private async createGapChartImage(
    gapData: Array<{ competencyName: string; selfScore: number | null; othersScore: number | null; gap: number | null }>
  ): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = Math.max(400, gapData.length * 60 + 100);
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Título
    ctx.fillStyle = '#2C3E50';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Análise de Defasagem (Gap)', canvas.width / 2, 30);

    const margin = { top: 60, right: 50, bottom: 60, left: 200 };
    const chartWidth = canvas.width - margin.left - margin.right;
    const chartHeight = canvas.height - margin.top - margin.bottom;
    const barHeight = chartHeight / gapData.length;
    const centerX = margin.left + chartWidth / 2;

    // Linha central
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, margin.top);
    ctx.lineTo(centerX, margin.top + chartHeight);
    ctx.stroke();

    // Labels e barras
    gapData.forEach((item, index) => {
      const y = margin.top + index * barHeight + barHeight / 2;

      // Label da competência
      ctx.fillStyle = '#2C3E50';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(item.competencyName, margin.left - 10, y + 5);

      if (item.gap !== null) {
        const gapWidth = Math.min(Math.abs(item.gap), 5) * (chartWidth / 2 / 5);
        const barLeft = item.gap < 0 ? centerX - gapWidth : centerX;
        const barWidth = gapWidth;

        // Cor baseada no tipo de gap
        if (item.gap > 0) {
          ctx.fillStyle = '#E74C3C'; // Ponto cego (vermelho)
        } else if (item.gap < 0) {
          ctx.fillStyle = '#27AE60'; // Ponto forte (verde)
        } else {
          ctx.fillStyle = '#95A5A6'; // Alinhado (cinza)
        }

        ctx.fillRect(barLeft, y - barHeight / 2 + 5, barWidth, barHeight - 10);

        // Valor do gap
        ctx.fillStyle = '#2C3E50';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        const labelX = item.gap < 0 ? centerX - gapWidth / 2 : centerX + gapWidth / 2;
        ctx.fillText(item.gap.toFixed(2), labelX, y + 5);
      }
    });

    // Legenda
    ctx.fillStyle = '#E74C3C';
    ctx.fillRect(50, canvas.height - 80, 15, 15);
    ctx.fillStyle = '#2C3E50';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Ponto Cego (Auto > Outros)', 70, canvas.height - 70);

    ctx.fillStyle = '#27AE60';
    ctx.fillRect(50, canvas.height - 50, 15, 15);
    ctx.fillStyle = '#2C3E50';
    ctx.fillText('Ponto Forte (Auto < Outros)', 70, canvas.height - 40);

    return canvas.toDataURL('image/jpeg', this.CHART_IMAGE_JPEG_QUALITY);
  }

  /**
   * Cria imagem da Janela de Johari
   */
  private async createJohariWindowImage(
    johariData: { points: Array<{ label: string; name: string; self: number; others: number; color: string }>; threshold: number }
  ): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Título
    ctx.fillStyle = '#2C3E50';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Janela de Johari', canvas.width / 2, 30);

    const margin = 80;
    const chartSize = canvas.width - margin * 2;
    const chartX = margin;
    const chartY = margin + 40;

    // Desenhar eixos
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 2;

    // Eixo X (Self)
    ctx.beginPath();
    ctx.moveTo(chartX, chartY + chartSize);
    ctx.lineTo(chartX + chartSize, chartY + chartSize);
    ctx.stroke();

    // Eixo Y (Others)
    ctx.beginPath();
    ctx.moveTo(chartX, chartY);
    ctx.lineTo(chartX, chartY + chartSize);
    ctx.stroke();

    // Labels dos eixos
    ctx.fillStyle = '#666666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Autoavaliação (Self)', chartX + chartSize / 2, chartY + chartSize + 30);

    ctx.save();
    ctx.translate(chartX - 30, chartY + chartSize / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Avaliação dos Outros', 0, 0);
    ctx.restore();

    // Linha de threshold
    const thresholdX = chartX + (johariData.threshold - 1) / 4 * chartSize;
    const thresholdY = chartY + chartSize - (johariData.threshold - 1) / 4 * chartSize;

    ctx.strokeStyle = '#FF6B35';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    // Linha vertical
    ctx.beginPath();
    ctx.moveTo(thresholdX, chartY);
    ctx.lineTo(thresholdX, chartY + chartSize);
    ctx.stroke();

    // Linha horizontal
    ctx.beginPath();
    ctx.moveTo(chartX, thresholdY);
    ctx.lineTo(chartX + chartSize, thresholdY);
    ctx.stroke();

    ctx.setLineDash([]);

    // Quadrantes
    ctx.fillStyle = '#F5F5F5';
    ctx.fillRect(chartX, chartY, thresholdX - chartX, thresholdY - chartY);
    ctx.fillStyle = '#E8F5E9';
    ctx.fillRect(thresholdX, chartY, chartSize - (thresholdX - chartX), thresholdY - chartY);
    ctx.fillStyle = '#FFF3E0';
    ctx.fillRect(chartX, thresholdY, thresholdX - chartX, chartSize - (thresholdY - chartY));
    ctx.fillStyle = '#E3F2FD';
    ctx.fillRect(thresholdX, thresholdY, chartSize - (thresholdX - chartX), chartSize - (thresholdY - chartY));

    // Labels dos quadrantes
    ctx.fillStyle = '#666666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Área Cega', chartX + (thresholdX - chartX) / 2, chartY + (thresholdY - chartY) / 2);
    ctx.fillText('Área Aberta', thresholdX + (chartSize - (thresholdX - chartX)) / 2, chartY + (thresholdY - chartY) / 2);
    ctx.fillText('Área Oculta', chartX + (thresholdX - chartX) / 2, thresholdY + (chartSize - (thresholdY - chartY)) / 2);
    ctx.fillText('Área Desconhecida', thresholdX + (chartSize - (thresholdX - chartX)) / 2, thresholdY + (chartSize - (thresholdY - chartY)) / 2);

    // Desenhar pontos
    johariData.points.forEach(point => {
      const x = chartX + ((point.self - 1) / 4) * chartSize;
      const y = chartY + chartSize - ((point.others - 1) / 4) * chartSize;

      // Círculo
      ctx.fillStyle = point.color;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#2C3E50';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(point.label, x, y - 15);

      // Nome (tooltip)
      ctx.font = '10px Arial';
      ctx.fillText(point.name, x, y + 25);
    });

    return canvas.toDataURL('image/jpeg', this.CHART_IMAGE_JPEG_QUALITY);
  }

  /**
   * Mapeia categoria para grupo
   */
  private mapCategoriaToGrupo(categoria: string, data?: ReportData): string {
    // Usar método do componente se disponível
    if (data?.mapCategoriaToGrupo) {
      return data.mapCategoriaToGrupo(categoria);
    }

    // Fallback padrão
    const mapping: { [key: string]: string } = {
      'Avaliado': 'Avaliado(a)',
      'Avaliado(a)': 'Avaliado(a)',
      'Gestor': 'Gestor(es)',
      'Gestor(es)': 'Gestor(es)',
      'Par': 'Pares',
      'Pares': 'Pares',
      'Subordinado': 'Subordinados',
      'Subordinados': 'Subordinados',
      'Outro': 'Outros',
      'Outros': 'Outros'
    };
    return mapping[categoria] || categoria;
  }

  /**
   * Método auxiliar para preparar dados do componente reports para PDFMake
   */
  prepareReportDataFromComponent(component: any): ReportData {
    return {
      participantName: component.individualParticipantName || component.selectedAvaliado || 'Participante',
      clientName: component.getClientName ? component.getClientName() : '',
      participantEmail: component.individualParticipantEmail || '',
      projectName: component.selectedProjectName || (component.getFilterProjectLabel ? component.getFilterProjectLabel() : '') || 'Projeto',
      startDate: component.startDate || '',
      endDate: component.endDate || '',
      totalRespondents: component.totalParticipants || component.dataSource?.length || 0,
      competencies: component.competencias || [],
      dataSource: component.dataSource || [],
      questionMap: component.questionMap || {},
      relatorioConfiguracao: component.relatorioConfiguracao || [],
      grupos: component.getGrupos ? component.getGrupos() : ['Avaliado(a)', 'Gestor(es)', 'Pares', 'Subordinados', 'Outros'],
      getMediaPorPerguntaEGrupo: (comp: Competencia, grupo: string) =>
        component.getMediaPorPerguntaEGrupo ? component.getMediaPorPerguntaEGrupo(comp, grupo) : null,
      getCompetenciasSelecionadasParaGraficos: (secao: RelatorioSecao) =>
        component.getCompetenciasSelecionadasParaGraficos ? component.getCompetenciasSelecionadasParaGraficos(secao) : [],
      getCompetenciaBarraComparativaData: (comp: Competencia) =>
        component.getCompetenciaBarraComparativaData ? component.getCompetenciaBarraComparativaData(comp) : [],
      getSecaoPieData: (secao: RelatorioSecao) =>
        component.getSecaoPieData ? component.getSecaoPieData(secao) : [],
      getCompetenciaStackedData: (comp: Competencia) =>
        component.getCompetenciaStackedData ? component.getCompetenciaStackedData(comp) : [],
      getSecaoRadarOptions: (secao: RelatorioSecao) =>
        component.getSecaoRadarOptions ? component.getSecaoRadarOptions(secao) : {},
      getJohariWindowData: (secao: RelatorioSecao) =>
        component.getJohariWindowData ? component.getJohariWindowData(secao) : { points: [], threshold: 3.5 },
      getColorSchemeParaSecao: (secao: RelatorioSecao) =>
        component.getColorSchemeParaSecao ? component.getColorSchemeParaSecao(secao) : { domain: ['#3498DB', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6'] },
      getDadosPerguntaDefasagem: component.getDadosPerguntaDefasagem ?
        (perguntaId: string) => component.getDadosPerguntaDefasagem(perguntaId) : undefined,
      mapCategoriaToGrupo: component.mapCategoriaToGrupo ?
        (categoria: string) => component.mapCategoriaToGrupo(categoria) : undefined,
      getPerguntasAbertasData: component.getPerguntasAbertasData ?
        () => component.getPerguntasAbertasData() : () => [],
      getCategoriasOrdenadas: component.getCategoriasOrdenadas ?
        (r: { [c: string]: string[] }) => component.getCategoriasOrdenadas(r) : () => [],
      documentoConfig: component.documentoConfig ?? DOCUMENTO_CONFIG_PADRAO
    };
  }

  private buildHeader(data: ReportData): any {
    const cfg = (data.documentoConfig ?? DOCUMENTO_CONFIG_PADRAO).cabecalho;
    if (!cfg.ativo) return undefined;

    return (currentPage: number, pageCount: number) => {
      if (cfg.ocultarNaCapa && currentPage === 1) return {};

      const leftParts: string[] = [];
      if (cfg.textoEsquerda) leftParts.push(cfg.textoEsquerda);
      if (cfg.mostrarNomeProjeto && data.projectName) leftParts.push(data.projectName);

      const columns: any[] = [];

      if (cfg.logoUrl) {
        columns.push({
          image: cfg.logoUrl,
          fit: [60, 20],
          alignment: 'left',
          width: 'auto',
          margin: [0, 0, 8, 0]
        });
      }

      columns.push({
        text: leftParts.join(' — '),
        alignment: 'left',
        fontSize: 8,
        color: cfg.cor,
        width: '*'
      });

      if (cfg.mostrarNumeroPagina) {
        columns.push({
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'right',
          fontSize: 8,
          color: cfg.cor,
          width: 'auto'
        });
      }

      const row = { columns, columnGap: 8 };

      if (cfg.linhaInferior) {
        return {
          stack: [
            { ...row, margin: [0, 0, 0, 3] },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: cfg.cor }] }
          ],
          margin: [40, 15, 40, 0]
        };
      }

      return { ...row, margin: [40, 20, 40, 0] };
    };
  }

  private buildFooter(data: ReportData): any {
    const cfg = (data.documentoConfig ?? DOCUMENTO_CONFIG_PADRAO).rodape;
    if (!cfg.ativo) return undefined;

    return (currentPage: number, pageCount: number) => {
      if (cfg.ocultarNaCapa && currentPage === 1) return {};

      const parts: string[] = [];
      if (cfg.texto) parts.push(cfg.texto);
      if (cfg.mostrarAno) parts.push(`© ${new Date().getFullYear()}`);
      if (cfg.mostrarNumeroPagina) parts.push(`Página ${currentPage} de ${pageCount}`);

      const textContent = parts.join(' | ');

      if (cfg.linhaSuperior) {
        return {
          stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: cfg.cor }], margin: [0, 0, 0, 3] },
            { text: textContent, alignment: 'center', fontSize: 8, color: cfg.cor }
          ],
          margin: [40, 5, 40, 15]
        };
      }

      return { text: textContent, alignment: 'center', fontSize: 8, color: cfg.cor, margin: [40, 10, 40, 20] };
    };
  }

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
      },
      tableHeader: {
        fontSize: 10,
        bold: true,
        color: '#FFFFFF',
        fillColor: '#4CAF50'
      },
      tableSubHeader: {
        fontSize: 9,
        bold: true,
        color: '#FFFFFF',
        fillColor: '#66BB6A'
      },
      tableCell: {
        fontSize: 9
      }
    };
  }
}
