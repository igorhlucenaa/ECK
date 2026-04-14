import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';

export interface EvaluatorBinding {
  participantId: string;
  participantName: string;
  participantEmail: string;
  avaliadoId: string | null;
  alreadySent: boolean;
}

export interface AvaliadoCoverage {
  id: string;
  name: string;
  evaluatorCount: number;
}

export interface LinkEvaluateeModalData {
  evaluators: Array<{
    id: string;
    name: string;
    email: string;
    avaliadoId?: string;
    assessmentId?: string;
  }>;
  avaliados: Array<{ id: string; name: string }>;
  assessmentId: string;
  projectId: string;
}

export interface LinkEvaluateeModalResult {
  bindings: EvaluatorBinding[];
}

@Component({
  selector: 'app-link-evaluatee-modal',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './link-evaluatee-modal.component.html',
  styleUrls: ['./link-evaluatee-modal.component.scss'],
})
export class LinkEvaluateeModalComponent implements OnInit {
  bindings: EvaluatorBinding[] = [];
  coverage: AvaliadoCoverage[] = [];
  isLoading = true;

  // map avaliadoId → quantos avaliadores já vinculados na seleção atual
  private coverageMap = new Map<string, number>();

  constructor(
    public dialogRef: MatDialogRef<LinkEvaluateeModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LinkEvaluateeModalData,
    private firestore: Firestore
  ) {}

  async ngOnInit(): Promise<void> {
    // Para cada avaliador selecionado, verificar se já tem link enviado
    const sentMap = new Map<string, string | null>(); // participantId → avaliadoId ou null
    for (const ev of this.data.evaluators) {
      const snap = await getDocs(query(
        collection(this.firestore, 'assessmentLinks'),
        where('participantId', '==', ev.id),
        where('assessmentId', '==', this.data.assessmentId)
      ));
      if (!snap.empty) {
        sentMap.set(ev.id, snap.docs[0].data()['avaliadoId'] || null);
      }
    }

    this.bindings = this.data.evaluators.map(ev => ({
      participantId: ev.id,
      participantName: ev.name,
      participantEmail: ev.email,
      avaliadoId: sentMap.has(ev.id) ? sentMap.get(ev.id)! : (ev.avaliadoId || null),
      alreadySent: sentMap.has(ev.id),
    }));

    this.rebuildCoverage();
    this.isLoading = false;
  }

  onAvaliadoChange(binding: EvaluatorBinding, avaliadoId: string): void {
    binding.avaliadoId = avaliadoId || null;
    this.rebuildCoverage();
  }

  private rebuildCoverage(): void {
    this.coverageMap.clear();
    for (const b of this.bindings) {
      if (b.avaliadoId) {
        this.coverageMap.set(b.avaliadoId, (this.coverageMap.get(b.avaliadoId) || 0) + 1);
      }
    }
    this.coverage = this.data.avaliados.map(a => ({
      id: a.id,
      name: a.name,
      evaluatorCount: this.coverageMap.get(a.id) || 0,
    }));
  }

  get allBound(): boolean {
    return this.bindings.every(b => b.alreadySent || !!b.avaliadoId);
  }

  getCoverageIcon(count: number): string {
    if (count === 0) return 'radio_button_unchecked';
    return 'check_circle';
  }

  getCoverageClass(count: number): string {
    if (count === 0) return 'cov--none';
    return 'cov--ok';
  }

  confirm(): void {
    this.dialogRef.close({ bindings: this.bindings } as LinkEvaluateeModalResult);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
