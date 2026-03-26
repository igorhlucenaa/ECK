import { Component, Inject, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { UserGroup } from '../users.component';

@Component({
  selector: 'app-group-details-dialog',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="gdlg">

      <!-- Header -->
      <div class="gdlg__header">
        <div class="gdlg__avatar">{{ (data.name || '?')[0].toUpperCase() }}</div>
        <div class="gdlg__header-text">
          <h2 class="gdlg__name">{{ data.name }}</h2>
          <span class="gdlg__client-badge">{{ data.client || '—' }}</span>
        </div>
        <button mat-icon-button class="gdlg__close" (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Body -->
      <div class="gdlg__body">

        <!-- Informações -->
        <p class="gdlg__section">Informações</p>

        <div class="gdlg__row">
          <mat-icon>notes</mat-icon>
          <div>
            <span class="gdlg__lbl">Descrição</span>
            <span class="gdlg__val">{{ data.description || '—' }}</span>
          </div>
        </div>

        <div class="gdlg__row">
          <mat-icon>person_outline</mat-icon>
          <div>
            <span class="gdlg__lbl">Criado por</span>
            <span class="gdlg__val">{{ data.createdBy || '—' }}</span>
          </div>
        </div>

        <div class="gdlg__row">
          <mat-icon>business</mat-icon>
          <div>
            <span class="gdlg__lbl">Cliente</span>
            <span class="gdlg__val">{{ data.client || '—' }}</span>
          </div>
        </div>

        <!-- Membros -->
        <p class="gdlg__section">
          Membros
          <span class="gdlg__section-count" *ngIf="!isLoadingMembers">{{ members.length }}</span>
        </p>

        <div class="gdlg__members-loading" *ngIf="isLoadingMembers">
          <mat-spinner diameter="24"></mat-spinner>
          <span>Carregando membros…</span>
        </div>

        <div *ngIf="!isLoadingMembers">
          <div class="gdlg__member-row" *ngFor="let m of members">
            <div class="gdlg__member-avatar">{{ (m.name || '?')[0].toUpperCase() }}</div>
            <div class="gdlg__member-info">
              <span class="gdlg__member-name">{{ m.name }}</span>
              <span class="gdlg__member-email">{{ m.email }}</span>
            </div>
          </div>
          <div class="gdlg__empty" *ngIf="members.length === 0">
            <mat-icon>person_off</mat-icon>
            <span>Nenhum membro neste grupo</span>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="gdlg__footer">
        <button mat-stroked-button class="gdlg__btn-cancel" (click)="dialogRef.close()">
          Fechar
        </button>
        <button mat-raised-button class="gdlg__btn-edit" (click)="goToEdit()">
          <mat-icon>edit</mat-icon>
          Editar grupo
        </button>
      </div>

    </div>
  `,
  styles: [`
    .mat-mdc-dialog-container .mdc-dialog__surface {
      padding: 0 !important;
      border-radius: 16px !important;
      overflow: hidden !important;
    }

    app-group-details-dialog { display: block; }

    .gdlg {
      display: flex;
      flex-direction: column;
      width: 500px;
    }

    /* ── Header ── */
    .gdlg__header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 20px 18px;
      background: linear-gradient(135deg, #1B2D56 0%, #1B84FF 100%);
      flex-shrink: 0;
    }
    .gdlg__avatar {
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
    .gdlg__header-text { flex: 1; min-width: 0; }
    .gdlg__name {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      line-height: 1.2;
    }
    .gdlg__client-badge {
      display: inline-block;
      margin-top: 5px;
      padding: 3px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      background: rgba(255,255,255,0.22);
      color: #fff;
    }
    .gdlg__close { color: rgba(255,255,255,0.8) !important; flex-shrink: 0; }

    /* ── Body ── */
    .gdlg__body {
      padding: 20px 24px 16px;
      flex: 1;
    }

    .gdlg__section {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #94a3b8;
      margin: 18px 0 8px;
    }
    .gdlg__section:first-child { margin-top: 0; }
    .gdlg__section-count {
      background: #e0f0ff;
      color: #1B84FF;
      border-radius: 20px;
      padding: 1px 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
    }

    .gdlg__row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 11px 14px;
      border-radius: 10px;
      background: #f8faff;
      border: 1px solid #e8edf3;
      margin-bottom: 6px;
    }
    .gdlg__row > mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #1B84FF;
      flex-shrink: 0;
      margin-top: 3px;
    }
    .gdlg__row > div {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .gdlg__lbl {
      font-size: 10px;
      color: #94a3b8;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .gdlg__val {
      font-size: 14px;
      color: #1e293b;
      font-weight: 500;
      word-break: break-word;
    }

    /* ── Membros ── */
    .gdlg__members-loading {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 0;
      color: #94a3b8;
      font-size: 13px;
    }

    .gdlg__member-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 10px;
      background: #f8faff;
      border: 1px solid #e8edf3;
      margin-bottom: 6px;
    }
    .gdlg__member-avatar {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: linear-gradient(135deg, #1B2D56, #1B84FF);
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .gdlg__member-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }
    .gdlg__member-name {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
    }
    .gdlg__member-email {
      font-size: 12px;
      color: #94a3b8;
    }

    .gdlg__empty {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      color: #94a3b8;
      font-size: 13px;
      justify-content: center;
    }
    .gdlg__empty mat-icon { font-size: 20px; width: 20px; height: 20px; opacity: 0.5; }

    /* ── Footer ── */
    .gdlg__footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 24px 20px;
      border-top: 1px solid #f1f5f9;
      flex-shrink: 0;
    }
    .gdlg__btn-cancel {
      border-color: #e2e8f0 !important;
      color: #64748b !important;
      border-radius: 8px !important;
      height: 40px;
    }
    .gdlg__btn-edit {
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
export class GroupDetailsDialogComponent implements OnInit {
  members: { name: string; email: string }[] = [];
  isLoadingMembers = true;

  constructor(
    public dialogRef: MatDialogRef<GroupDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserGroup & { client?: string },
    private firestore: Firestore,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadMembers();
  }

  goToEdit(): void {
    this.dialogRef.close();
    this.router.navigate(['/users/group', this.data.id, 'edit']);
  }

  private async loadMembers(): Promise<void> {
    const userIds: string[] = (this.data.userIds as unknown as string[]) || [];
    this.members = [];
    for (const uid of userIds) {
      try {
        const snap = await getDoc(doc(this.firestore, `users/${uid}`));
        if (snap.exists()) {
          const u = snap.data() as any;
          this.members.push({
            name: `${u.name || ''} ${u.surname || ''}`.trim(),
            email: u.email || '',
          });
        }
      } catch { /* skip */ }
    }
    this.isLoadingMembers = false;
  }
}
