import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import {
  classifyJohariPoint,
  formatJohariScore,
  hasJohariPlotCoordinates,
  JOHARI_EXPLANATION_PARAGRAPHS,
  JOHARI_THRESHOLD,
} from './johari-window.utils';

export interface JohariPoint {
  label: string;
  name: string;
  self: number | null;
  others: number | null;
  color: string;
}

export interface JohariWindowData {
  points: JohariPoint[];
  threshold: number;
}

@Component({
  selector: 'app-johari-window-chart',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './johari-window-chart.component.html',
  styleUrls: ['./johari-window-chart.component.scss'],
})
export class JohariWindowChartComponent implements OnChanges {
  @Input() data: JohariWindowData = { points: [], threshold: JOHARI_THRESHOLD };

  readonly explanationParagraphs = JOHARI_EXPLANATION_PARAGRAPHS;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']?.currentValue) {
      this.data = changes['data'].currentValue;
    }
  }

  toPercentX(value: number): number {
    const clamped = Math.max(1, Math.min(5, value));
    return ((clamped - 1) / 4) * 100;
  }

  toPercentY(value: number): number {
    const clamped = Math.max(1, Math.min(5, value));
    return ((5 - clamped) / 4) * 100;
  }

  get thresholdPercent(): number {
    return this.toPercentX(this.data.threshold);
  }

  analysisLabel(point: JohariPoint): string {
    return classifyJohariPoint(point.self, point.others, this.data.threshold);
  }

  formatScore(value: number | null): string {
    return formatJohariScore(value);
  }

  canPlot(point: JohariPoint): boolean {
    return hasJohariPlotCoordinates(point);
  }

  get isEmpty(): boolean {
    return !this.data.points?.length;
  }
}
