import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
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

export type ReuseCompetencyGroupMode = 'createNew' | 'mergeIntoCurrent';

export interface ReuseCompetencyGroupDialogData {
  targetClientId: string;
  targetClientName: string;
  scopeClientIds: string[];
  /** Grupo aberto no editor — permite importar sem criar outro (slide 1 PPT 6.1). */
  currentGroupId?: string | null;
  currentGroupName?: string;
}

export interface ReuseCompetencyGroupDialogResult {
  sourceGroupId: string;
  mode: ReuseCompetencyGroupMode;
  newGroupName?: string;
}

interface GroupOption {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  competenciaCount: number;
}

@Component({
  selector: 'app-reuse-competency-group-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatRadioModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'competencies.reuse.title' | translate }}</h2>
    <mat-dialog-content class="reuse-dialog-content">
      <p class="reuse-hint">{{ 'competencies.reuse.hint' | translate }}</p>
      <p class="reuse-scope" *ngIf="!loading && groups.length > 0">
        {{ 'competencies.reuse.globalCount' | translate:{ count: groups.length, clients: distinctClientCount } }}
      </p>
      <mat-radio-group
        *ngIf="canMergeIntoCurrent"
        class="reuse-mode"
        [(ngModel)]="mode"
        name="reuseMode"
      >
        <mat-radio-button value="mergeIntoCurrent">
          {{ 'competencies.reuse.modeMerge' | translate:{ name: data.currentGroupName } }}
        </mat-radio-button>
        <mat-radio-button value="createNew">
          {{ 'competencies.reuse.modeNew' | translate }}
        </mat-radio-button>
      </mat-radio-group>
      <mat-form-field appearance="outline" class="w-full">
        <mat-label>{{ 'competencies.reuse.sourceGroup' | translate }}</mat-label>
        <mat-select
          name="sourceGroupId"
          [(ngModel)]="selectedGroupId"
          (selectionChange)="onSourceGroupChange($event.value)"
          [disabled]="loading || groups.length === 0"
        >
          <mat-option *ngFor="let g of groups" [value]="g.id">
            {{ g.name }} — {{ g.clientName }} ({{ g.competenciaCount }}
            {{ 'competencies.reuse.competenciesShort' | translate }})
          </mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="w-full" *ngIf="mode === 'createNew'">
        <mat-label>{{ 'competencies.reuse.newName' | translate }}</mat-label>
        <input matInput name="newGroupName" [(ngModel)]="newGroupName" />
      </mat-form-field>
      <p *ngIf="!loading && groups.length === 0" class="reuse-empty">
        {{ 'competencies.reuse.noGroups' | translate }}
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'Cancelar' | translate }}</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!canConfirm"
        (click)="confirm()"
      >
        {{ confirmLabelKey | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .reuse-dialog-content {
        min-width: 320px;
        max-width: 480px;
      }
      .w-full {
        width: 100%;
      }
      .reuse-hint {
        font-size: 13px;
        color: #64748b;
        margin: 0 0 12px;
      }
      .reuse-empty {
        color: #94a3b8;
        font-size: 13px;
      }
      .reuse-scope {
        font-size: 12px;
        color: #475569;
        margin: 0 0 12px;
      }
      .reuse-mode {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
      }
    `,
  ],
})
export class ReuseCompetencyGroupDialogComponent implements OnInit {
  groups: GroupOption[] = [];
  selectedGroupId = '';
  newGroupName = '';
  mode: ReuseCompetencyGroupMode = 'createNew';
  loading = true;

  get canMergeIntoCurrent(): boolean {
    return !!this.data.currentGroupId?.trim();
  }

  get distinctClientCount(): number {
    return new Set(this.groups.map((g) => g.clientId)).size;
  }

  get canConfirm(): boolean {
    if (!this.selectedGroupId || this.loading) return false;
    if (this.mode === 'mergeIntoCurrent') return this.canMergeIntoCurrent;
    return !!this.newGroupName.trim();
  }

  get confirmLabelKey(): string {
    return this.mode === 'mergeIntoCurrent'
      ? 'competencies.reuse.confirmMerge'
      : 'competencies.reuse.confirm';
  }

  constructor(
    private dialogRef: MatDialogRef<
      ReuseCompetencyGroupDialogComponent,
      ReuseCompetencyGroupDialogResult | undefined
    >,
    @Inject(MAT_DIALOG_DATA) public data: ReuseCompetencyGroupDialogData,
    private firestore: Firestore
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.canMergeIntoCurrent) {
      this.mode = 'mergeIntoCurrent';
    }
    await this.loadGroups();
    this.loading = false;
  }

  private async loadGroups(): Promise<void> {
    const scope = this.data.scopeClientIds.filter(Boolean);
    if (!scope.length) {
      this.groups = [];
      return;
    }

    const clientNames = new Map<string, string>();
    for (const cid of scope.slice(0, 30)) {
      const snap = await getDoc(doc(this.firestore, 'clients', cid));
      if (snap.exists()) {
        clientNames.set(cid, snap.data()['companyName'] || cid);
      }
    }

    const all: GroupOption[] = [];
    for (let i = 0; i < scope.length; i += 10) {
      const chunk = scope.slice(i, i + 10);
      const snap = await getDocs(
        query(
          collection(this.firestore, 'competencyGroups'),
          where('clientId', 'in', chunk)
        )
      );
      for (const d of snap.docs) {
        if (this.data.currentGroupId && d.id === this.data.currentGroupId) {
          continue;
        }
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
    this.groups = all;

    if (this.groups.length === 1) {
      this.selectedGroupId = this.groups[0].id;
      this.newGroupName = `${this.groups[0].name} (${this.data.targetClientName})`;
    }
  }

  onSourceGroupChange(groupId: string): void {
    this.selectedGroupId = groupId;
    const g = this.groups.find((x) => x.id === groupId);
    if (g && !this.newGroupName.trim()) {
      this.newGroupName = `${g.name} (${this.data.targetClientName})`;
    }
  }

  confirm(): void {
    if (!this.canConfirm) return;
    if (this.mode === 'mergeIntoCurrent') {
      this.dialogRef.close({
        sourceGroupId: this.selectedGroupId,
        mode: 'mergeIntoCurrent',
      });
      return;
    }
    const name = this.newGroupName.trim();
    this.dialogRef.close({
      sourceGroupId: this.selectedGroupId,
      mode: 'createNew',
      newGroupName: name,
    });
  }
}
