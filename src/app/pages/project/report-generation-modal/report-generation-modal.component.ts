import { ChangeDetectorRef, Component, Inject, NgZone, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Firestore, collection, doc, getDoc, getDocs, query, where } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { MaterialModule } from '../../../material.module';

interface UnifiedParticipant {
  id: string;
  name: string;
  email: string;
  type: 'avaliado' | 'avaliador';
  category: string;
  status: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  sections: any[];
  clientId: string;
  assessmentId?: string;
}

interface Competency {
  id: string;
  name: string;
  description: string;
  perguntasIds: string[];
  assessmentId?: string;
}

interface ReportGenerationData {
  participant: UnifiedParticipant;
  projectId: string;
  assessmentId: string;
  clientId: string;
  reportTemplateId?: string;
}

@Component({
  selector: 'app-report-generation-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MaterialModule,
    TranslateModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <!-- Header -->
    <div class="rgm-header">
      <div class="rgm-header__icon">
        <mat-icon>description</mat-icon>
      </div>
      <div class="rgm-header__text">
        <p class="rgm-header__title">Gerar Relatório Individual</p>
        <p class="rgm-header__subtitle">{{ data.participant.name }}</p>
      </div>
      <button mat-icon-button class="rgm-header__close" (click)="dialogRef.close()">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="rgm-content">

      <!-- Loading state -->
      <div *ngIf="isLoading" class="rgm-loading">
        <mat-spinner [diameter]="44"></mat-spinner>
        <p>Carregando dados da avaliação...</p>
      </div>

      <div *ngIf="!isLoading">

        <!-- Participant info strip -->
        <div class="rgm-participant-strip">
          <div class="rgm-participant-strip__avatar">
            {{ data.participant.name.charAt(0).toUpperCase() }}
          </div>
          <div class="rgm-participant-strip__info">
            <span class="rgm-participant-strip__name">{{ data.participant.name }}</span>
            <span class="rgm-participant-strip__email">{{ data.participant.email }}</span>
          </div>
          <div class="rgm-participant-strip__badges">
            <span class="rgm-badge rgm-badge--category">{{ data.participant.category }}</span>
            <span class="rgm-badge rgm-badge--status">{{ data.participant.status }}</span>
          </div>
        </div>

        <!-- Step 1: Template -->
        <div class="rgm-step">
          <div class="rgm-step__header">
            <div class="rgm-step__number">1</div>
            <div>
              <p class="rgm-step__title">Estrutura do Relatório</p>
              <p class="rgm-step__desc">Selecione um template salvo ou prossiga sem template</p>
            </div>
          </div>

          <!-- No templates state -->
          <div *ngIf="reportTemplates.length === 0" class="rgm-empty-state">
            <mat-icon>dashboard_customize</mat-icon>
            <p>Nenhum template salvo ainda.</p>
            <span>Você pode prosseguir sem template e configurar manualmente na página de relatórios, ou criar um template primeiro em <b>Relatórios → Montar Relatório → Templates</b>.</span>
          </div>

          <mat-form-field *ngIf="reportTemplates.length > 0" appearance="outline" class="rgm-field">
            <mat-label>Template de Relatório</mat-label>
            <mat-select [formControl]="templateControl">
              <mat-option [value]="null">— Sem template (configurar manualmente) —</mat-option>
              <mat-option *ngFor="let t of reportTemplates" [value]="t">
                {{ t.name }}
                <span *ngIf="t.description" style="font-size:11px; color:#888;"> — {{ t.description }}</span>
              </mat-option>
            </mat-select>
            <mat-hint>{{ reportTemplates.length }} template(s) disponível(is)</mat-hint>
          </mat-form-field>

          <div *ngIf="templateControl.value" class="rgm-info-pill">
            <mat-icon>layers</mat-icon>
            {{ templateControl.value.sections?.length || 0 }} seções configuradas no template
          </div>
        </div>

        <!-- Step 2: Competencies -->
        <div class="rgm-step">
          <div class="rgm-step__header">
            <div class="rgm-step__number">2</div>
            <div>
              <p class="rgm-step__title">Competências</p>
              <p class="rgm-step__desc">Selecione as competências a incluir no relatório</p>
            </div>
          </div>

          <div *ngIf="competencies.length === 0" class="rgm-empty-state">
            <mat-icon>psychology</mat-icon>
            <p>Nenhuma competência encontrada para este cliente.</p>
            <span>Configure competências em <b>Definições → Competências</b> antes de gerar o relatório.</span>
          </div>

          <mat-form-field *ngIf="competencies.length > 0" appearance="outline" class="rgm-field">
            <mat-label>Competências</mat-label>
            <mat-select [formControl]="competenciesControl" multiple>
              <mat-option *ngFor="let comp of competencies" [value]="comp">
                {{ comp.name }}
                <span style="font-size:11px; color:#888;"> ({{ comp.perguntasIds.length }} questões)</span>
              </mat-option>
            </mat-select>
            <mat-hint>
              {{ competencies.length }} disponível(is) ·
              {{ (competenciesControl.value || []).length }} selecionada(s)
            </mat-hint>
          </mat-form-field>

          <div *ngIf="(competenciesControl.value || []).length > 0" class="rgm-chips">
            <span class="rgm-chip" *ngFor="let c of (competenciesControl.value || [])">
              <mat-icon>psychology</mat-icon>{{ c.name }}
            </span>
          </div>
        </div>

        <!-- Summary (only when competencies selected) -->
        <div class="rgm-summary" *ngIf="(competenciesControl.value || []).length > 0">
          <mat-icon>summarize</mat-icon>
          <span>
            <b>{{ (competenciesControl.value || []).length }}</b> competência(s) ·
            <b>{{ getTotalQuestions() }}</b> questões ·
            Template: <b>{{ templateControl.value?.name || 'Sem template' }}</b>
          </span>
        </div>

      </div>
    </mat-dialog-content>

    <!-- Actions -->
    <div class="rgm-actions">
      <button mat-button class="rgm-btn-cancel" (click)="dialogRef.close()" [disabled]="isGenerating">
        Cancelar
      </button>
      <button
        mat-flat-button
        class="rgm-btn-generate"
        [disabled]="!canGenerate() || isGenerating"
        (click)="generateReport()"
      >
        <mat-spinner *ngIf="isGenerating" [diameter]="18" class="rgm-btn-spinner"></mat-spinner>
        <mat-icon *ngIf="!isGenerating">open_in_new</mat-icon>
        <span>{{ isGenerating ? 'Abrindo relatório...' : 'Abrir no Relatório' }}</span>
      </button>
    </div>
  `,
  styles: [`
    /* Header */
    .rgm-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 24px 16px;
      background: linear-gradient(135deg, #1B2D56, #1B84FF);
      color: #fff;
      border-radius: 12px 12px 0 0;
    }

    .rgm-header__icon {
      width: 42px; height: 42px;
      background: rgba(255,255,255,0.15);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .rgm-header__icon mat-icon { font-size: 22px; width: 22px; height: 22px; }

    .rgm-header__text { flex: 1; }
    .rgm-header__title { margin: 0; font-size: 16px; font-weight: 700; }
    .rgm-header__subtitle { margin: 2px 0 0; font-size: 13px; opacity: 0.8; }

    .rgm-header__close {
      color: rgba(255,255,255,0.7) !important;
      &:hover { color: #fff !important; }
    }

    /* Content */
    .rgm-content {
      padding: 20px 24px !important;
      max-height: 65vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Loading */
    .rgm-loading {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 16px;
      min-height: 280px;
      width: 100%;
      color: #64748b; font-size: 13px;
    }

    /* Participant strip */
    .rgm-participant-strip {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px;
      background: #f8faff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
    }
    .rgm-participant-strip__avatar {
      width: 38px; height: 38px;
      background: linear-gradient(135deg, #1B2D56, #1B84FF);
      color: #fff;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 16px; flex-shrink: 0;
    }
    .rgm-participant-strip__info {
      flex: 1;
      display: flex; flex-direction: column; gap: 2px;
    }
    .rgm-participant-strip__name { font-size: 14px; font-weight: 600; color: #1e293b; }
    .rgm-participant-strip__email { font-size: 12px; color: #64748b; }
    .rgm-participant-strip__badges { display: flex; gap: 6px; flex-wrap: wrap; }

    /* Badges */
    .rgm-badge {
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }
    .rgm-badge--category { background: #dbeafe; color: #1d4ed8; }
    .rgm-badge--status { background: #dcfce7; color: #16a34a; }

    /* Steps */
    .rgm-step {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .rgm-step__header {
      display: flex; align-items: flex-start; gap: 10px;
    }
    .rgm-step__number {
      width: 26px; height: 26px;
      background: linear-gradient(135deg, #1B2D56, #1B84FF);
      color: #fff;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; flex-shrink: 0;
    }
    .rgm-step__title { margin: 0; font-size: 14px; font-weight: 700; color: #1e293b; }
    .rgm-step__desc { margin: 2px 0 0; font-size: 12px; color: #94a3b8; }

    .rgm-field { width: 100%; }

    /* Empty state */
    .rgm-empty-state {
      display: flex; flex-direction: column; align-items: center;
      text-align: center; gap: 6px;
      padding: 16px;
      background: #fafafa;
      border: 1px dashed #e2e8f0;
      border-radius: 8px;
      color: #94a3b8;

      mat-icon { font-size: 32px; width: 32px; height: 32px; }
      p { margin: 0; font-size: 13px; font-weight: 600; color: #64748b; }
      span { font-size: 12px; line-height: 1.5; }
    }

    /* Info pill */
    .rgm-info-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 12px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 999px;
      font-size: 12px; color: #1d4ed8;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }

    /* Chips */
    .rgm-chips {
      display: flex; flex-wrap: wrap; gap: 6px;
    }
    .rgm-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 10px;
      background: #f1f5f9;
      border-radius: 999px;
      font-size: 12px; color: #475569;
      mat-icon { font-size: 13px; width: 13px; height: 13px; color: #6366f1; }
    }

    /* Summary */
    .rgm-summary {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      font-size: 13px; color: #166534;
      mat-icon { color: #16a34a; }
    }

    /* Actions */
    .rgm-actions {
      display: flex; justify-content: flex-end; align-items: center;
      gap: 10px;
      padding: 14px 24px;
      border-top: 1px solid #e2e8f0;
    }

    .rgm-btn-cancel {
      color: #64748b !important;
      border-radius: 8px !important;
    }

    .rgm-btn-generate {
      background: linear-gradient(135deg, #1B2D56, #1B84FF) !important;
      color: #fff !important;
      border-radius: 8px !important;
      font-weight: 600 !important;
      height: 38px;
      display: flex; align-items: center; gap: 6px;
      padding: 0 18px !important;

      &[disabled] {
        background: #e2e8f0 !important;
        color: #94a3b8 !important;
      }

      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .rgm-btn-spinner {
      display: inline-block;
    }
  `]
})
export class ReportGenerationModalComponent implements OnInit {
  templateControl = new FormControl<ReportTemplate | null>(null);
  competenciesControl = new FormControl<Competency[]>([]);

  reportTemplates: ReportTemplate[] = [];
  competencies: Competency[] = [];

  isLoading = true;
  isGenerating = false;

  constructor(
    public dialogRef: MatDialogRef<ReportGenerationModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReportGenerationData,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private router: Router,
    private dialog: MatDialog,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    this.isLoading = true;

    // Safety net: Firestore modular API may resolve outside Angular zone.
    // NgZone.run() guarantees change detection fires when we update state.
    const finishLoading = () => {
      this.ngZone.run(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      });
    };

    // Hard timeout — if queries hang (no network, Firestore offline, etc.)
    const safetyTimer = setTimeout(finishLoading, 5_000);

    try {
      await Promise.all([
        this.loadReportTemplates(),
        this.loadCompetencies()
      ]);
      await this.applyDefaultReportTemplate();
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      clearTimeout(safetyTimer);
      finishLoading();
    }
  }

  canGenerate(): boolean {
    // Require at least 1 competency selected
    return (this.competenciesControl.value || []).length > 0;
  }

  async loadReportTemplates(): Promise<void> {
    try {
      if (!this.data.clientId) {
        this.reportTemplates = [];
        return;
      }
      const templatesRef = query(
        collection(this.firestore, 'reportTemplates'),
        where('clientId', '==', this.data.clientId)
      );
      const snap = await getDocs(templatesRef);
      this.reportTemplates = snap.docs.map(doc => {
        const d: any = doc.data();
        return {
          id: doc.id,
          name: d['name'] || d['nome'] || 'Template sem nome',
          description: d['description'] || d['descricao'] || '',
          sections: d['sections'] || d['configuracao'] || [],
          clientId: d['clientId'] || '',
          assessmentId: d['assessmentId'] || d['avaliacaoId'] || undefined
        } as ReportTemplate;
      });
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      this.reportTemplates = [];
    }
  }

  private async applyDefaultReportTemplate(): Promise<void> {
    let templateId = this.data.reportTemplateId;

    if (!templateId && this.data.projectId) {
      try {
        const projectDoc = await getDoc(doc(this.firestore, 'projects', this.data.projectId));
        if (projectDoc.exists()) {
          templateId = projectDoc.data()['reportTemplateId'] || undefined;
        }
      } catch (error) {
        console.error('Erro ao carregar template padrão do projeto:', error);
        return;
      }
    }

    if (!templateId) return;

    const match = this.reportTemplates.find(t => t.id === templateId);
    if (match) {
      this.templateControl.setValue(match);
    }
  }

  async loadCompetencies(): Promise<void> {
    try {
      const groupsCollection = collection(this.firestore, 'competencyGroups');

      if (this.data.clientId) {
        const snap = await getDocs(query(groupsCollection, where('clientId', '==', this.data.clientId)));
        this.competencies = snap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            name: d['name'] || 'Grupo sem nome',
            description: `Grupo: ${d['competencias']?.length || 0} competências`,
            perguntasIds: d['competencias'] || [],
            assessmentId: d['assessmentId'] || undefined
          } as Competency;
        });
      } else {
        const col = this.data.assessmentId
          ? query(collection(this.firestore, 'competencies'), where('assessmentId', '==', this.data.assessmentId))
          : collection(this.firestore, 'competencies');
        const snap = await getDocs(col);
        this.competencies = snap.docs.map(doc => {
          const d: any = doc.data();
          return {
            id: doc.id,
            name: d['name'] || d['nome'] || 'Competência sem nome',
            description: d['description'] || d['descricao'] || '',
            perguntasIds: d['perguntasIds'] || d['questionIds'] || [],
            assessmentId: d['assessmentId'] || undefined
          } as Competency;
        });
      }
    } catch (error) {
      console.error('Erro ao carregar competências:', error);
      this.competencies = [];
    }
  }

  getTotalQuestions(): number {
    return (this.competenciesControl.value || []).reduce((t, c) => t + (c.perguntasIds?.length || 0), 0);
  }

  async generateReport(): Promise<void> {
    if (!this.canGenerate()) {
      this.snackBar.open(this.translate.instant('Selecione pelo menos uma competência para gerar o relatório.'), this.translate.instant('Fechar'), { duration: 3000 });
      return;
    }

    this.ngZone.run(() => { this.isGenerating = true; this.cdr.markForCheck(); });

    try {
      const selectedTemplate = this.templateControl.value;
      const selectedCompetencies = this.competenciesControl.value || [];

      const queryParams: any = {
        mode: 'individual',
        assessmentId: this.data.assessmentId,
        participantId: this.data.participant.id,
        participantName: this.data.participant.name,
        competencyIds: JSON.stringify(selectedCompetencies.map(c => c.id)),
        autoGenerate: 'true',
        aba: 'visualizar'
      };

      if (selectedTemplate) {
        queryParams['templateId'] = selectedTemplate.id;
      }

      this.dialog.closeAll();

      this.router.navigate(['/reports'], { queryParams });

      this.snackBar.open(this.translate.instant('Redirecionando para geração do relatório...'), this.translate.instant('Fechar'), { duration: 3000 });
    } catch (error) {
      console.error('Erro ao abrir relatório:', error);
      this.snackBar.open(this.translate.instant('Erro ao abrir relatório. Tente novamente.'), this.translate.instant('Fechar'), { duration: 5000 });
    } finally {
      this.ngZone.run(() => { this.isGenerating = false; this.cdr.markForCheck(); });
    }
  }
}
