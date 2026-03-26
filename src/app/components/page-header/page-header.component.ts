import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  template: `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-header-accent"></div>
        <div class="page-header-text">
          <div class="page-header-eyebrow" *ngIf="eyebrow">{{ eyebrow }}</div>
          <h1 class="page-header-title">{{ title }}</h1>
          <p class="page-header-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
        </div>
      </div>
      <div class="page-header-actions">
        <ng-content></ng-content>
      </div>
    </div>
    <div class="page-header-divider">
      <div class="page-header-divider-line"></div>
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
      padding: 22px 28px;
      background: linear-gradient(
        to right,
        rgba(27, 45, 86, 0.05) 0%,
        rgba(27, 132, 255, 0.03) 60%,
        transparent 100%
      );
      border: 1px solid rgba(27, 45, 86, 0.09);
      border-left: none;
      border-radius: 0 14px 14px 0;
      position: relative;
      overflow: hidden;
    }

    .page-header::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: linear-gradient(to bottom, #1B2D56, #1B84FF);
      border-radius: 0 2px 2px 0;
    }

    .page-header-left {
      display: flex;
      align-items: center;
      gap: 0;
    }

    .page-header-accent {
      display: none;
    }

    .page-header-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .page-header-eyebrow {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #1B84FF;
      margin-bottom: 2px;
    }

    .page-header-title {
      font-size: 1.6rem;
      font-weight: 700;
      color: #1a1a2e;
      margin: 0;
      letter-spacing: -0.3px;
      line-height: 1.2;
    }

    .page-header-subtitle {
      font-size: 13px;
      color: #8a8fa8;
      margin: 0;
      font-weight: 400;
      margin-top: 3px;
    }

    .page-header-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-shrink: 0;
      flex-wrap: wrap;
    }

    .page-header-divider {
      margin: 20px 0 28px;
    }

    .page-header-divider-line {
      height: 1px;
      background: linear-gradient(
        to right,
        #1B2D56 0%,
        #1B84FF 30%,
        rgba(27, 132, 255, 0.2) 60%,
        transparent 100%
      );
    }

    @media (max-width: 600px) {
      .page-header {
        flex-direction: column;
        align-items: flex-start;
        padding: 18px 20px;
      }

      .page-header-title {
        font-size: 1.3rem;
      }

      .page-header-actions {
        width: 100%;
      }
    }
  `]
})
export class AppPageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() eyebrow = '';
}
