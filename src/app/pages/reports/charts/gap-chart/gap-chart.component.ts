import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GapChartDataItem {
  competencyName: string;
  selfScore: number | null;
  othersScore: number | null;
  gap: number | null; // Defasagem: selfScore - othersScore
}

@Component({
  selector: 'app-gap-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gap-chart.component.html',
  styleUrls: ['./gap-chart.component.scss']
})
export class GapChartComponent implements OnInit, OnDestroy, OnChanges {
  @Input() data: GapChartDataItem[] = [];

  // Expor Math para uso no template
  Math = Math;

  ngOnInit() {
    console.log('🚀 GapChartComponent inicializado');
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] && changes['data'].currentValue) {
      console.log('🔄 GapChartComponent - dados recebidos:', this.data);
      if (this.data && this.data.length > 0) {
        this.data.forEach((item, index) => {
          console.log(`📊 Item ${index}:`, {
            name: item.competencyName,
            selfScore: item.selfScore,
            othersScore: item.othersScore,
            gap: item.gap,
            gapType: this.getGapType(item)
          });
        });
      }
    }
  }

  ngOnDestroy() {
    // Cleanup se necessário
  }

  // gap > 0 => selfScore > othersScore => ponto-cego (verde, direita)
  // gap < 0 => selfScore < othersScore => ponto-forte (cinza, esquerda)
  getGapType(item: GapChartDataItem): 'ponto-forte' | 'ponto-cego' | 'alinhado' {
    if (item.gap === null) return 'alinhado';

    if (item.gap > 0) {
      return 'ponto-cego';
    } else if (item.gap < 0) {
      return 'ponto-forte';
    } else {
      return 'alinhado';
    }
  }

  // Largura da barra baseada no valor absoluto do gap.
  // Como a barra ocupa apenas um lado (do centro até a borda),
  // 5 pontos de gap equivalem a 50% da largura total (ou seja, 10% por ponto).
  // Limitamos entre 0% e 50%.
  getBarWidth(gap: number | null): number {
    if (gap === null) return 0;
    const width = Math.min(Math.abs(gap), 5) * 10; // 10% por ponto (lado = 50%)
    return Math.max(0, Math.min(50, width));
  }

  // Posição inicial (left) da barra:
  // - gap > 0: começa no centro (50%) e cresce para direita
  // - gap < 0: começa em (50% - width) e cresce até o centro
  // Garante que o valor fique no intervalo [0, 100]
  getBarLeft(gap: number | null): number {
    if (gap === null) return 50;
    const width = this.getBarWidth(gap);
    const left = gap < 0 ? 50 - width : 50;
    return Math.max(0, Math.min(100, left));
  }

  trackByIndex(index: number): number {
    return index;
  }
}
