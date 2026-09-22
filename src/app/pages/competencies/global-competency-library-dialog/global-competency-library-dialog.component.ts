import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from '@angular/fire/firestore';

export interface GlobalCompetencyLibraryDialogData {
  scopeClientIds: string[];
  targetClientId: string;
  targetClientName: string;
}

export type GlobalCompetencyLibraryAction = 'duplicate' | 'openGroup';

export interface GlobalCompetencyLibraryDialogResult {
  action: GlobalCompetencyLibraryAction;
  groupId: string;
  clientId: string;
  groupName: string;
}

interface LibraryGroupRow {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  competenciaCount: number;
}

@Component({
  selector: 'app-global-competency-library-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'competencies.globalLibrary.title' | translate }}</h2>
    <mat-dialog-content class="library-content">
      <p class="library-hint">{{ 'competencies.globalLibrary.hint' | translate }}</p>
      <p class="library-scope" *ngIf="!loading && rows.length > 0">
        {{
          'competencies.reuse.globalCount'
            | translate: { count: rows.length, clients: distinctClientCount }
        }}
      </p>
      <mat-form-field appearance="outline" class="w-full" *ngIf="rows.length > 0">
        <mat-label>{{ 'competencies.globalLibrary.search' | translate }}</mat-label>
        <input matInput [(ngModel)]="search" name="librarySearch" />
        <mat-icon matPrefix>search</mat-icon>
      </mat-form-field>
      <div class="library-list" *ngIf="!loading && filteredRows.length > 0">
        <div class="library-row" *ngFor="let g of filteredRows">
          <div class="library-row__main">
            <span class="library-row__name">{{ g.name }}</span>
            <span class="library-row__meta">
              {{ g.clientName }} · {{ g.competenciaCount }}
              {{ 'competencies.reuse.competenciesShort' | translate }}
            </span>
          </div>
          <div class="library-row__actions">
            <button
              mat-icon-button
              type="button"
              [matTooltip]="'competencies.globalLibrary.openGroup' | translate"
              (click)="pick('openGroup', g)"
            >
              <mat-icon>open_in_new</mat-icon>
            </button>
            <button
              mat-icon-button
              type="button"
              color="primary"
              [matTooltip]="'competencies.globalLibrary.duplicateHere' | translate:{ client: data.targetClientName }"
              (click)="pick('duplicate', g)"
            >
              <mat-icon>content_copy</mat-icon>
            </button>
          </div>
        </div>
      </div>
      <p *ngIf="loading" class="library-empty">{{ 'Carregando...' | translate }}</p>
      <p *ngIf="!loading && rows.length === 0" class="library-empty">
        {{ 'competencies.reuse.noGroups' | translate }}
      </p>
      <p *ngIf="!loading && rows.length > 0 && filteredRows.length === 0" class="library-empty">
        {{ 'competencies.globalLibrary.noMatch' | translate }}
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'Fechar' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .library-content {
        min-width: min(560px, 95vw);
        max-height: 70vh;
      }
      .w-full {
        width: 100%;
      }
      .library-hint {
        font-size: 13px;
        color: #64748b;
        margin: 0 0 8px;
      }
      .library-scope {
        font-size: 12px;
        color: #475569;
        margin: 0 0 12px;
      }
      .library-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 360px;
        overflow: auto;
        padding-right: 4px;
      }
      .library-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #fafbfc;
      }
      .library-row__main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .library-row__name {
        font-weight: 600;
        font-size: 14px;
        color: #1e293b;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .library-row__meta {
        font-size: 12px;
        color: #64748b;
      }
      .library-row__actions {
        flex-shrink: 0;
        display: flex;
        gap: 0;
      }
      .library-empty {
        color: #94a3b8;
        font-size: 13px;
      }
    `,
  ],
})
export class GlobalCompetencyLibraryDialogComponent implements OnInit {
  rows: LibraryGroupRow[] = [];
  search = '';
  loading = true;

  get distinctClientCount(): number {
    return new Set(this.rows.map((g) => g.clientId)).size;
  }

  get filteredRows(): LibraryGroupRow[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.rows;
    return this.rows.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.clientName.toLowerCase().includes(q)
    );
  }

  constructor(
    private dialogRef: MatDialogRef<
      GlobalCompetencyLibraryDialogComponent,
      GlobalCompetencyLibraryDialogResult | undefined
    >,
    @Inject(MAT_DIALOG_DATA) public data: GlobalCompetencyLibraryDialogData,
    private firestore: Firestore
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadRows();
    this.loading = false;
  }

  pick(action: GlobalCompetencyLibraryAction, g: LibraryGroupRow): void {
    this.dialogRef.close({
      action,
      groupId: g.id,
      clientId: g.clientId,
      groupName: g.name,
    });
  }

  private async loadRows(): Promise<void> {
    const scope = this.data.scopeClientIds.filter(Boolean);
    if (!scope.length) {
      this.rows = [];
      return;
    }

    const clientNames = new Map<string, string>();
    for (const cid of scope.slice(0, 30)) {
      const snap = await getDoc(doc(this.firestore, 'clients', cid));
      if (snap.exists()) {
        clientNames.set(cid, snap.data()['companyName'] || cid);
      }
    }

    const all: LibraryGroupRow[] = [];
    for (let i = 0; i < scope.length; i += 10) {
      const chunk = scope.slice(i, i + 10);
      const snap = await getDocs(
        query(
          collection(this.firestore, 'competencyGroups'),
          where('clientId', 'in', chunk)
        )
      );
      for (const d of snap.docs) {
        const data = d.data();
        const clientId = data['clientId'] as string;
        all.push({
          id: d.id,
          name: data['name'] || d.id,
          clientId,
          clientName: clientNames.get(clientId) || clientId,
          competenciaCount: data['competencias']?.length || 0,
        });
      }
    }

    all.sort((a, b) =>
      `${a.clientName} ${a.name}`.localeCompare(`${b.clientName} ${b.name}`, 'pt-BR')
    );
    this.rows = all;
  }
}
