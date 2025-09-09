import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';

// Pontos para o gráfico (cada competência)
export interface JohariPoint {
  label: string;           // Letra (A, B, C...)
  name: string;            // Nome da competência
  self: number;            // Média da autoavaliação (1-5)
  others: number;          // Média dos outros (1-5)
  color: string;           // Cor do marcador
}

// Estrutura de dados do gráfico Johari
export interface JohariWindowData {
  points: JohariPoint[];
  threshold: number;       // Linha de corte (ex.: 3.5)
}

@Component({
  selector: 'app-johari-window-chart',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './johari-window-chart.component.html',
  styleUrls: ['./johari-window-chart.component.scss'],
})
export class JohariWindowChartComponent implements OnChanges {
  @Input() data: JohariWindowData = { points: [], threshold: 3.5 };

  constructor() {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && changes['data'].currentValue) {
      this.data = changes['data'].currentValue;
    }
  }

  // Converte valor 1-5 em porcentagem horizontal
  toPercentX(value: number): number {
    const clamped = Math.max(1, Math.min(5, value));
    return ((clamped - 1) / 4) * 100; // 0% em 1, 100% em 5
  }

  // Converte valor 1-5 em porcentagem vertical (0% topo = 5, 100% base = 1)
  toPercentY(value: number): number {
    const clamped = Math.max(1, Math.min(5, value));
    return ((5 - clamped) / 4) * 100; // 0% em 5, 100% em 1
  }

  // Posição da linha de corte em %
  get thresholdPercent(): number {
    return this.toPercentX(this.data.threshold);
  }

  get analysisLabel() {
    return (p: JohariPoint): string => {
      const highSelf = p.self >= this.data.threshold;
      const highOthers = p.others >= this.data.threshold;
      if (highSelf && highOthers) return 'Ponto forte conhecido';
      if (!highSelf && highOthers) return 'Área de desenvolvimento conhecida';
      if (highSelf && !highOthers) return 'Ponto cego';
      return 'Ponto forte oculto';
    };
  }

  get isEmpty(): boolean {
    return !this.data.points || this.data.points.length === 0;
  }
}

