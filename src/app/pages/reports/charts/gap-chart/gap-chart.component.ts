import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GapChartDataItem {
  competencyName: string;
  selfScore: number | null;
  othersScore: number | null;
  gap: number | null;
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

  getGapType(item: GapChartDataItem): 'ponto-forte' | 'ponto-cego' | 'alinhado' {
    if (item.gap === null) return 'alinhado';

    if (item.gap > 0) {
      return 'ponto-cego'; // Verde - pessoa se avalia mais alto (selfScore > othersScore)
    } else if (item.gap < 0) {
      return 'ponto-forte'; // Cinza - outros avaliam mais alto (selfScore < othersScore)
    } else {
      return 'alinhado';
    }
  }

  getMarkerColor(item: GapChartDataItem): string {
    const gapType = this.getGapType(item);
    switch (gapType) {
      case 'ponto-cego':
        return '#28a745'; // Verde
      case 'ponto-forte':
        return '#6c757d'; // Cinza
      default:
        return '#17a2b8'; // Azul para alinhado
    }
  }

  trackByIndex(index: number): number {
    return index;
  }
}
