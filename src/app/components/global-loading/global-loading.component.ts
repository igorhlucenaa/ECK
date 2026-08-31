import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { LoadingService, LoadingState } from '../../services/loading.service';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-global-loading',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatIconModule,
    TranslateModule,
  ],
  template: `
    <div *ngIf="loadingState.isLoading" class="global-loading-overlay">

      <!-- Spinner simples -->
      <div *ngIf="loadingState.type !== 'progress'" class="loading-center">
        <mat-spinner [diameter]="48"></mat-spinner>
        <p class="loading-message">{{ (loadingState.message || 'Carregando...') | translate }}</p>
      </div>

      <!-- Progress bar -->
      <div *ngIf="loadingState.type === 'progress'" class="loading-center">
        <mat-icon class="progress-icon">cloud_upload</mat-icon>
        <p class="loading-message">{{ (loadingState.message || 'Carregando...') | translate }}</p>
        <mat-progress-bar
          mode="determinate"
          [value]="loadingState.progress || 0"
          class="progress-bar"
        ></mat-progress-bar>
        <p class="progress-text">{{ (loadingState.progress || 0) | number:'1.0-0' }}%</p>
      </div>
    </div>
  `,
  styles: [`
    .global-loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 99999;
      animation: fadeIn 0.2s ease;
    }

    .loading-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .loading-message {
      margin: 0;
      color: #475569;
      font-size: 14px;
      font-weight: 500;
    }

    .progress-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #1976d2;
    }

    .progress-bar {
      width: 220px;
    }

    .progress-text {
      margin: 0;
      font-weight: 600;
      color: #1976d2;
      font-size: 13px;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* dead code kept for TS compilation — never rendered */
    .skeleton-title {
      height: 0;
    }

  `]
})
export class GlobalLoadingComponent implements OnInit, OnDestroy {
  loadingState: LoadingState = {
    isLoading: false,
    message: '',
    type: 'spinner'
  };

  private subscription: Subscription = new Subscription();

  constructor(private loadingService: LoadingService) {}

  ngOnInit(): void {
    this.subscription.add(
      this.loadingService.loading$.subscribe(state => {
        this.loadingState = state;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
