/**
 * EXEMPLO DE INTEGRAÇÃO: Como usar ReportPdfMakeService no componente ReportsComponent
 *
 * Este arquivo mostra como integrar o serviço PDFMake no componente existente.
 * Copie o método exportarRelatorioPDFMake() para o seu reports.component.ts
 */

import { ReportPdfMakeService } from './report-pdfmake.service';

// Exemplo de método para adicionar ao ReportsComponent
export class ReportsComponentIntegrationExample {

  constructor(
    private pdfMakeService: ReportPdfMakeService
  ) {}

  /**
   * Exporta relatório usando PDFMake (NOVO MÉTODO)
   * Use este método ao invés de exportarRelatorioPDF()
   */
  async exportarRelatorioPDFMake(): Promise<void> {
    try {
      // Preparar dados do componente para o serviço PDFMake
      const reportData = this.pdfMakeService.prepareReportDataFromComponent(this);

      // Gerar PDF
      await this.pdfMakeService.generateReport(reportData);

      this.snackBar.open(
        this.translate.instant('PDF gerado com sucesso usando PDFMake!'),
        this.translate.instant('Fechar'),
        { duration: 3000 }
      );
    } catch (error: any) {
      console.error('Erro ao gerar PDF com PDFMake:', error);
      this.snackBar.open(
        this.translate.instant('Erro ao gerar PDF: {{error}}', { error: error.message }),
        this.translate.instant('Fechar'),
        { duration: 5000 }
      );
    }
  }

  /**
   * Método alternativo: passar dados manualmente
   */
  async exportarRelatorioPDFMakeManual(): Promise<void> {
    const reportData = {
      participantName: this.individualParticipantName || 'Participante',
      participantEmail: this.individualParticipantEmail || '',
      projectName: this.selectedProjectName || 'Projeto',
      competencies: this.competencias,
      dataSource: this.dataSource,
      questionMap: this.questionMap,
      relatorioConfiguracao: this.relatorioConfiguracao,
      grupos: this.getGrupos(),
      getMediaPorPerguntaEGrupo: (comp: any, grupo: string) => this.getMediaPorPerguntaEGrupo(comp, grupo),
      getCompetenciasSelecionadasParaGraficos: (secao: any) => this.getCompetenciasSelecionadasParaGraficos(secao),
      getCompetenciaBarraComparativaData: (comp: any) => this.getCompetenciaBarraComparativaData(comp),
      getSecaoPieData: (secao: any) => this.getSecaoPieData(secao),
      getCompetenciaStackedData: (comp: any) => this.getCompetenciaStackedData(comp),
      getSecaoRadarOptions: (secao: any) => this.getSecaoRadarOptions(secao),
      getJohariWindowData: (secao: any) => this.getJohariWindowData(secao),
      getColorSchemeParaSecao: (secao: any) => this.getColorSchemeParaSecao(secao),
      getDadosPerguntaDefasagem: this.getDadosPerguntaDefasagem?.bind(this),
      mapCategoriaToGrupo: this.mapCategoriaToGrupo?.bind(this)
    };

    await this.pdfMakeService.generateReport(reportData);
  }
}
