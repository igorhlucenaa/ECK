import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-relatorio-individual-preview',
  standalone: true,
  template: `
    <div style="padding: 32px; text-align: center; color: #888;">
      <h2>Pré-visualização do Relatório Individual</h2>
      <p><b>Avaliado:</b> {{ participante?.name }}</p>
      <p><b>Template:</b> {{ template?.nome || template?.name || template?.id }}</p>
      <p style="font-size: 13px;">(Aqui será renderizado o relatório real, com gráficos, tabelas e textos do template, filtrando apenas os dados do avaliado.)</p>
    </div>
  `,
  styleUrls: []
})
export class RelatorioIndividualPreviewComponent {
  @Input() participante: any;
  @Input() template: any;
}
