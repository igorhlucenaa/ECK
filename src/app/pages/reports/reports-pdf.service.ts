import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ReportsPdfService {
  async generateCoverPDF(elementId: string, fileName = 'capa-relatorio.pdf') {
    const jsPDFmod = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');
    const element = document.getElementById(elementId);
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDFmod.jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(fileName);
  }

  async generateSummaryPDF(
    competencyAverages: Array<{ title: string; avg: number }>,
    topItems: Array<{ title: string; avg: number }>,
    lowItems: Array<{ title: string; avg: number }>,
    fileName = 'resumo.pdf'
  ) {
    const jsPDFmod = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const pdf = new jsPDFmod.jsPDF('p', 'mm', 'a4');

    pdf.setFontSize(14);
    pdf.text('Resumo do seu feedback do 360', 14, 20);

    autoTable(pdf, {
      startY: 30,
      head: [['Competência', 'Média']],
      body: competencyAverages.map((c) => [c.title, c.avg.toFixed(2)]).slice(0, 10),
    });

    pdf.addPage();
    autoTable(pdf, {
      head: [['Mais Altas', 'Média']],
      body: topItems.map((i) => [i.title, i.avg.toFixed(2)]),
    });

    const finalY = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 40;

    autoTable(pdf, {
      startY: finalY + 10,
      head: [['Mais Baixas', 'Média']],
      body: lowItems.map((i) => [i.title, i.avg.toFixed(2)]),
    });

    pdf.save(fileName);
  }
}


