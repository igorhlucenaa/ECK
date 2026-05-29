import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

@Component({
  selector: 'app-nao-autorizado',
  standalone: true,
  imports: [RouterModule, MatButtonModule, MatIconModule],
  template: `
    <div class="nao-autorizado-container">
      <div class="nao-autorizado-card">
        <div class="nao-autorizado-icon">
          <mat-icon>lock</mat-icon>
        </div>
        <h1 class="nao-autorizado-title">Acesso Negado</h1>
        <p class="nao-autorizado-desc">
          Você não tem permissão para acessar esta página.<br>
          Entre em contato com o administrador caso acredite que isso é um erro.
        </p>
        <div class="nao-autorizado-actions">
          <button mat-flat-button routerLink="/dashboard" class="btn-home">
            <mat-icon>home</mat-icon>
            Ir para o Início
          </button>
          <button mat-stroked-button (click)="logout()" class="btn-logout">
            <mat-icon>logout</mat-icon>
            Sair
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .nao-autorizado-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%);
      padding: 24px;
    }

    .nao-autorizado-card {
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 8px 40px rgba(27, 45, 86, 0.12);
      padding: 48px 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }

    .nao-autorizado-icon {
      width: 80px;
      height: 80px;
      border-radius: 20px;
      background: linear-gradient(135deg, #fef2f2, #fee2e2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;

      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: #dc2626;
      }
    }

    .nao-autorizado-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: #1B2D56;
      margin: 0 0 12px;
    }

    .nao-autorizado-desc {
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
      margin: 0 0 32px;
    }

    .nao-autorizado-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn-home {
      background: linear-gradient(135deg, #1B2D56, #1B84FF) !important;
      color: #fff !important;
      font-weight: 600;
      border-radius: 8px !important;
      display: flex;
      align-items: center;
      gap: 6px;

      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .btn-logout {
      color: #64748b !important;
      border-color: #e2e8f0 !important;
      font-weight: 500;
      border-radius: 8px !important;
      display: flex;
      align-items: center;
      gap: 6px;

      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
  `],
})
export class NaoAutorizadoComponent {
  constructor(private authService: AuthService) {}

  logout(): void {
    this.authService.logout();
  }
}
