import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { User } from '../users.component';

@Component({
  selector: 'app-user-details-dialog',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="udlg">

      <!-- Header -->
      <div class="udlg__header">
        <div class="udlg__avatar">{{ (data.name || '?')[0].toUpperCase() }}</div>
        <div class="udlg__header-text">
          <h2 class="udlg__name">{{ data.name }} {{ data.surname }}</h2>
          <span class="udlg__role-badge" [class]="'udlg__role-badge--' + data.role">
            {{ roleLabel(data.role) }}
          </span>
        </div>
        <button mat-icon-button class="udlg__close" (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Body -->
      <div class="udlg__body">

        <p class="udlg__section">Identificação</p>
        <div class="udlg__row">
          <mat-icon>email</mat-icon>
          <div>
            <span class="udlg__lbl">E-mail</span>
            <span class="udlg__val">{{ data.email || '—' }}</span>
          </div>
        </div>

        <p class="udlg__section">Vínculo</p>
        <div class="udlg__row">
          <mat-icon>business</mat-icon>
          <div>
            <span class="udlg__lbl">Cliente</span>
            <span class="udlg__val">{{ data.client && data.client !== 'Cliente não encontrado' ? data.client : '—' }}</span>
          </div>
        </div>

        <div class="udlg__row">
          <mat-icon>folder_open</mat-icon>
          <div>
            <span class="udlg__lbl">Projetos</span>
            <span class="udlg__val" *ngIf="(data.projects?.length || 0) > 0">{{ data.projects!.join(', ') }}</span>
            <span class="udlg__val udlg__val--empty" *ngIf="!(data.projects?.length)">Nenhum projeto</span>
          </div>
        </div>

        <div class="udlg__row">
          <mat-icon>group</mat-icon>
          <div>
            <span class="udlg__lbl">Grupos</span>
            <span class="udlg__val" *ngIf="(data.groups?.length || 0) > 0">{{ data.groups!.join(', ') }}</span>
            <span class="udlg__val udlg__val--empty" *ngIf="!(data.groups?.length)">Nenhum grupo</span>
          </div>
        </div>

        <p class="udlg__section">Status</p>
        <div class="udlg__row">
          <mat-icon>notifications</mat-icon>
          <div>
            <span class="udlg__lbl">Acesso</span>
            <span class="udlg__notif"
              [class.udlg__notif--accessed]="data.notificationStatus === 'Acessou'"
              [class.udlg__notif--sent]="data.notificationStatus === 'Link Enviado'"
              [class.udlg__notif--pending]="data.notificationStatus === 'Pendente'">
              <mat-icon>{{
                data.notificationStatus === 'Acessou' ? 'verified_user' :
                data.notificationStatus === 'Link Enviado' ? 'mark_email_read' :
                'schedule'
              }}</mat-icon>
              {{ data.notificationStatus || 'Pendente' }}
            </span>
          </div>
        </div>
        <div class="udlg__row" *ngIf="data.lastLoginAt">
          <mat-icon>login</mat-icon>
          <div>
            <span class="udlg__lbl">Último acesso</span>
            <span class="udlg__val">{{ data.lastLoginAt | date:'dd/MM/yyyy HH:mm' }}</span>
          </div>
        </div>
        <div class="udlg__row" *ngIf="data.lastInviteSentAt">
          <mat-icon>send</mat-icon>
          <div>
            <span class="udlg__lbl">Link enviado em</span>
            <span class="udlg__val">{{ data.lastInviteSentAt | date:'dd/MM/yyyy HH:mm' }}</span>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="udlg__footer">
        <button mat-stroked-button class="udlg__btn-cancel" (click)="dialogRef.close()">
          Fechar
        </button>
        <button mat-raised-button class="udlg__btn-edit" (click)="goToEdit()">
          <mat-icon>edit</mat-icon>
          Editar usuário
        </button>
      </div>

    </div>
  `,
  styles: [`
    /* Reset Material Dialog padding so we control everything */
    .mat-mdc-dialog-container .mdc-dialog__surface {
      padding: 0 !important;
      border-radius: 16px !important;
      overflow: hidden !important;
    }

    app-user-details-dialog {
      display: block;
    }

    .udlg {
      display: flex;
      flex-direction: column;
      width: 480px;
    }

    /* ── Header ── */
    .udlg__header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 20px 18px;
      background: linear-gradient(135deg, #1B2D56 0%, #1B84FF 100%);
      flex-shrink: 0;
    }
    .udlg__avatar {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: rgba(255,255,255,0.2);
      color: #fff;
      font-size: 20px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .udlg__header-text { flex: 1; min-width: 0; }
    .udlg__name {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      line-height: 1.2;
    }
    .udlg__role-badge {
      display: inline-block;
      margin-top: 5px;
      padding: 3px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      background: rgba(255,255,255,0.2);
      color: #fff;
    }
    .udlg__role-badge--admin_master { background: rgba(234,179,8,0.35); }
    .udlg__role-badge--admin_client { background: rgba(255,255,255,0.25); }
    .udlg__close { color: rgba(255,255,255,0.8) !important; flex-shrink: 0; }

    /* ── Body ── */
    .udlg__body {
      padding: 20px 24px 16px;
      flex: 1;
    }
    .udlg__section {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #94a3b8;
      margin: 18px 0 8px;
    }
    .udlg__section:first-child { margin-top: 0; }

    .udlg__row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 11px 14px;
      border-radius: 10px;
      background: #f8faff;
      border: 1px solid #e8edf3;
      margin-bottom: 6px;
    }
    .udlg__row > mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #1B84FF;
      flex-shrink: 0;
      margin-top: 3px;
    }
    .udlg__row > div {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .udlg__lbl {
      font-size: 10px;
      color: #94a3b8;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .udlg__val {
      font-size: 14px;
      color: #1e293b;
      font-weight: 500;
      word-break: break-word;
    }
    .udlg__val--empty { color: #94a3b8; font-style: italic; }

    .udlg__notif {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      padding-top: 1px;
    }
    .udlg__notif mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .udlg__notif--accessed { color: #15803d; }
    .udlg__notif--sent     { color: #b45309; }
    .udlg__notif--pending  { color: #94a3b8; }

    /* ── Footer ── */
    .udlg__footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 24px 20px;
      border-top: 1px solid #f1f5f9;
      flex-shrink: 0;
    }
    .udlg__btn-cancel {
      border-color: #e2e8f0 !important;
      color: #64748b !important;
      border-radius: 8px !important;
      height: 40px;
    }
    .udlg__btn-edit {
      display: flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #1B2D56, #1B84FF) !important;
      color: #fff !important;
      border-radius: 8px !important;
      font-weight: 600 !important;
      height: 40px;
    }
  `],
})
export class UserDetailsDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<UserDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: User,
    private router: Router
  ) {}

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      admin_master: 'Master',
      admin_client: 'Admin Cliente',
      viewer: 'Visualizador',
      user: 'Usuário',
    };
    return map[role] || role || '—';
  }

  goToEdit(): void {
    this.dialogRef.close();
    this.router.navigate(['/users', this.data.id, 'edit']);
  }
}
