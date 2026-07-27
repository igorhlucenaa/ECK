import { Injectable } from '@angular/core';

const A4_WIDTH_MM = 210;
const MARGIN_MM = 10;
const MAX_CANVAS_PX = 16000;
/** Limite prático de altura de página no jsPDF (mm). */
const MAX_PAGE_HEIGHT_MM = 5000;

@Injectable({ providedIn: 'root' })
export class AssessmentPreviewPdfService {
  /**
   * Exporta o formulário em uma única página PDF contínua (sem quebras A4),
   * evitando cortes no meio de perguntas.
   */
  async exportElementToPdf(element: HTMLElement, fileName: string): Promise<void> {
    const { default: html2canvas } = await import('html2canvas');
    const { jsPDF } = await import('jspdf');

    const contentWidthMm = A4_WIDTH_MM - MARGIN_MM * 2;
    const scale = this.resolveCaptureScale(element);

    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const imgHeightMm = (canvas.height * contentWidthMm) / canvas.width;
    const pageHeightMm = imgHeightMm + MARGIN_MM * 2;

    if (pageHeightMm > MAX_PAGE_HEIGHT_MM) {
      throw new Error(
        'Formulário muito longo para exportação em página única. Tente dividir o formulário em seções menores.'
      );
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [A4_WIDTH_MM, pageHeightMm],
    });

    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      MARGIN_MM,
      MARGIN_MM,
      contentWidthMm,
      imgHeightMm
    );

    pdf.save(this.sanitizeFileName(fileName));
  }

  sanitizeFileName(name: string): string {
    const base = (name || 'Formulario')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
  }

  private resolveCaptureScale(element: HTMLElement): number {
    const preferred = 2;
    const estimatedHeight = element.scrollHeight * preferred;
    if (estimatedHeight <= MAX_CANVAS_PX) {
      return preferred;
    }
    return Math.max(1, MAX_CANVAS_PX / Math.max(element.scrollHeight, 1));
  }
}
