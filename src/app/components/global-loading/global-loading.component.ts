import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { LoadingService, LoadingState } from '../../services/loading.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-global-loading',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatCardModule,
    MatIconModule
  ],
  template: `
    <div
      *ngIf="loadingState.isLoading"
      class="global-loading-overlay"
      [class.skeleton-mode]="loadingState.type === 'skeleton'"
    >
      <!-- Loading com Spinner -->
      <div *ngIf="loadingState.type === 'spinner'" class="loading-spinner-container">
        <mat-card class="loading-card">
          <mat-card-content>
            <div class="spinner-content">
              <mat-spinner [diameter]="50"></mat-spinner>
              <p class="loading-message">{{ loadingState.message || 'Carregando...' }}</p>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Loading com Progress Bar -->
      <div *ngIf="loadingState.type === 'progress'" class="loading-progress-container">
        <mat-card class="loading-card">
          <mat-card-content>
            <div class="progress-content">
              <mat-icon class="progress-icon">cloud_upload</mat-icon>
              <p class="loading-message">{{ loadingState.message || 'Carregando...' }}</p>
              <mat-progress-bar
                mode="determinate"
                [value]="loadingState.progress || 0"
                class="progress-bar"
              ></mat-progress-bar>
              <p class="progress-text">{{ (loadingState.progress || 0) | number:'1.0-0' }}%</p>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Loading com Skeleton -->
      <div *ngIf="loadingState.type === 'skeleton'" class="loading-skeleton-container">
        <div class="skeleton-content">
          <div class="skeleton-header">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-title"></div>
          </div>
          <div class="skeleton-body">
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .global-loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      backdrop-filter: blur(2px);
    }

    .loading-card {
      max-width: 400px;
      width: 90%;
      text-align: center;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }

    .spinner-content {
      padding: 24px;
    }

    .loading-message {
      margin-top: 16px;
      color: #666;
      font-size: 14px;
      margin-bottom: 0;
    }

    .progress-content {
      padding: 24px;
    }

    .progress-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1976d2;
      margin-bottom: 16px;
    }

    .progress-bar {
      margin: 16px 0;
    }

    .progress-text {
      margin: 8px 0 0 0;
      font-weight: 500;
      color: #1976d2;
    }

    /* Skeleton Loading */
    .loading-skeleton-container {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .skeleton-content {
      background: white;
      border-radius: 12px;
      padding: 24px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }

    .skeleton-header {
      display: flex;
      align-items: center;
      margin-bottom: 24px;
    }

    .skeleton-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      margin-right: 16px;
    }

    .skeleton-title {
      height: 20px;
      width: 60%;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    .skeleton-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton-line {
      height: 16px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    .skeleton-line.short {
      width: 70%;
    }

    @keyframes shimmer {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }

    /* Responsividade */
    @media (max-width: 600px) {
      .loading-card {
        width: 95%;
        margin: 16px;
      }

      .skeleton-content {
        width: 95%;
        margin: 16px;
      }
    }

    /* Animações suaves */
    .global-loading-overlay {
      animation: fadeIn 0.3s ease-in-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
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
