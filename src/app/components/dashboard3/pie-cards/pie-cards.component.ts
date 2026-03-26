import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-pie-cards',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  templateUrl: './pie-cards.component.html',
  styles: [`
    .kpi-card { border-radius: 14px !important; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; }
    .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important; }
    .kpi-accent-bar { height: 4px; width: 100%; }
    .kpi-content { padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; }
    .kpi-value { font-size: 2.2rem; font-weight: 700; line-height: 1; }
    .kpi-label { font-size: 12px; color: #888; margin-top: 6px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-icon-bg { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  `]
})
export class AppPieCardsComponent {
  @Input() pieChartsData: { value: number; label: string; color: string; icon?: string }[] = [];

  getIconBg(color: string): string {
    return color + '22';
  }
}
