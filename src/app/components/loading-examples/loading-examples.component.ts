import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-loading-examples',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule
  ],
  template: `
    <div class="loading-examples">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Exemplos de Loading Global</mat-card-title>
          <mat-card-subtitle>Teste diferentes tipos de loading</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="examples-grid">

            <!-- Loading Simples -->
            <div class="example-item">
              <h3>Loading Simples</h3>
              <p>Mostra um spinner com mensagem padrão</p>
              <button mat-raised-button color="primary" (click)="showSimpleLoading()">
                <mat-icon>refresh</mat-icon>
                Loading Simples
              </button>
            </div>

            <!-- Loading com Mensagem -->
            <div class="example-item">
              <h3>Loading com Mensagem</h3>
              <p>Spinner com mensagem customizada</p>
              <button mat-raised-button color="accent" (click)="showLoadingWithMessage()">
                <mat-icon>message</mat-icon>
                Loading com Mensagem
              </button>
            </div>

            <!-- Loading com Progresso -->
            <div class="example-item">
              <h3>Loading com Progresso</h3>
              <p>Barra de progresso com atualizações</p>
              <button mat-raised-button color="warn" (click)="showLoadingWithProgress()">
                <mat-icon>trending_up</mat-icon>
                Loading com Progresso
              </button>
            </div>

            <!-- Loading Skeleton -->
            <div class="example-item">
              <h3>Loading Skeleton</h3>
              <p>Efeito skeleton para carregamento</p>
              <button mat-raised-button color="primary" (click)="showSkeletonLoading()">
                <mat-icon>view_agenda</mat-icon>
                Loading Skeleton
              </button>
            </div>

            <!-- Loading com Timeout -->
            <div class="example-item">
              <h3>Loading com Timeout</h3>
              <p>Loading que para automaticamente após 5s</p>
              <button mat-raised-button color="accent" (click)="showLoadingWithTimeout()">
                <mat-icon>timer</mat-icon>
                Loading com Timeout
              </button>
            </div>

            <!-- Loading Delayed -->
            <div class="example-item">
              <h3>Loading Delayed</h3>
              <p>Só mostra loading se demorar mais de 500ms</p>
              <button mat-raised-button color="warn" (click)="showDelayedLoading()">
                <mat-icon>schedule</mat-icon>
                Loading Delayed
              </button>
            </div>

            <!-- Loading Específico -->
            <div class="example-item">
              <h3>Loading Específico</h3>
              <p>Loading para uma operação específica</p>
              <button mat-raised-button color="primary" (click)="showSpecificLoading()">
                <mat-icon>settings</mat-icon>
                Loading Específico
              </button>
            </div>

            <!-- Múltiplos Loadings -->
            <div class="example-item">
              <h3>Múltiplos Loadings</h3>
              <p>Simula múltiplas operações simultâneas</p>
              <button mat-raised-button color="accent" (click)="showMultipleLoadings()">
                <mat-icon>layers</mat-icon>
                Múltiplos Loadings
              </button>
            </div>

          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .loading-examples {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .examples-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .example-item {
      padding: 20px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: #fafafa;
    }

    .example-item h3 {
      margin: 0 0 10px 0;
      color: #333;
      font-size: 18px;
    }

    .example-item p {
      margin: 0 0 15px 0;
      color: #666;
      font-size: 14px;
    }

    .example-item button {
      width: 100%;
    }

    .example-item mat-icon {
      margin-right: 8px;
    }

    @media (max-width: 768px) {
      .examples-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class LoadingExamplesComponent {
  constructor(private loadingService: LoadingService) {}

  showSimpleLoading(): void {
    this.loadingService.show();
    setTimeout(() => {
      this.loadingService.hide();
    }, 2000);
  }

  showLoadingWithMessage(): void {
    this.loadingService.show('Carregando dados do servidor...');
    setTimeout(() => {
      this.loadingService.hide();
    }, 3000);
  }

  showLoadingWithProgress(): void {
    const progressControl = this.loadingService.showWithProgress('Fazendo upload de arquivos...');
    let progress = 0;

    const interval = setInterval(() => {
      progress += 10;
      progressControl.updateProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          progressControl.hide();
        }, 500);
      }
    }, 200);
  }

  showSkeletonLoading(): void {
    this.loadingService.showSkeleton('Carregando interface...');
    setTimeout(() => {
      this.loadingService.hide();
    }, 4000);
  }

  showLoadingWithTimeout(): void {
    this.loadingService.showWithTimeout('Operação que pode demorar...', 5000)
      .subscribe(timedOut => {
        if (timedOut) {
          console.log('Loading foi interrompido por timeout');
        }
      });
  }

  showDelayedLoading(): void {
    // Simula uma operação rápida
    this.loadingService.showDelayed('Carregando...', 500)
      .subscribe(shouldShow => {
        if (shouldShow) {
          setTimeout(() => {
            this.loadingService.hide();
          }, 1000);
        }
      });
  }

  showSpecificLoading(): void {
    this.loadingService.showFor('upload', 'Fazendo upload...');
    setTimeout(() => {
      this.loadingService.hideFor('upload');
    }, 2500);
  }

  showMultipleLoadings(): void {
    // Simula múltiplas operações
    this.loadingService.show('Operação 1...');

    setTimeout(() => {
      this.loadingService.show('Operação 2...');
    }, 500);

    setTimeout(() => {
      this.loadingService.show('Operação 3...');
    }, 1000);

    setTimeout(() => {
      this.loadingService.hide();
    }, 2000);

    setTimeout(() => {
      this.loadingService.hide();
    }, 2500);

    setTimeout(() => {
      this.loadingService.hide();
    }, 3000);
  }
}
