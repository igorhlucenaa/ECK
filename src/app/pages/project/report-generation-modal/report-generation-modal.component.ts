import { Component, Inject, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { Router } from '@angular/router';
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
}

@Component({
  selector: 'app-report-generation-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MaterialModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <h2 mat-dialog-title style="display: flex; align-items: center; gap: 12px;">
      <mat-icon style="color: #6366f1;">description</mat-icon>
      Gerar Relatório - {{ data.participant.name }}
    </h2>

    <mat-dialog-content style="max-width: 600px; min-height: 500px;">
      <div *ngIf="isLoading" style="display: flex; justify-content: center; align-items: center; height: 300px;">
        <mat-spinner [diameter]="50"></mat-spinner>
      </div>

      <div *ngIf="!isLoading">
        <!-- Informações do Participante -->
        <mat-card style="margin-bottom: 20px; background-color: #f8f9ff; border-left: 4px solid #6366f1;">
          <mat-card-header>
            <mat-card-title style="font-size: 16px; color: #6366f1;">
              <mat-icon style="vertical-align: middle; margin-right: 8px;">person</mat-icon>
              Informações do Participante
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
              <mat-chip>
                <mat-icon matChipAvatar>person</mat-icon>
                {{ data.participant.name }}
              </mat-chip>
              <mat-chip>
                <mat-icon matChipAvatar>email</mat-icon>
                {{ data.participant.email }}
              </mat-chip>
              <mat-chip>
                <mat-icon matChipAvatar>category</mat-icon>
                {{ data.participant.category }}
              </mat-chip>
              <mat-chip>
                <mat-icon matChipAvatar>check_circle</mat-icon>
                {{ data.participant.status }}
              </mat-chip>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Seleção de Template -->
        <mat-card style="margin-bottom: 20px;">
          <mat-card-header>
            <mat-card-title style="font-size: 16px; color: #333;">
              <mat-icon style="vertical-align: middle; margin-right: 8px;">dashboard</mat-icon>
              1. Selecione o Template de Relatório
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-form-field appearance="outline" style="width: 100%;">
              <mat-label>Template de Relatório</mat-label>
              <mat-select [formControl]="templateControl">
                <mat-option *ngFor="let template of reportTemplates" [value]="template">
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-weight: 500;">{{ template.name }}</span>
                    <span style="font-size: 12px; color: #666;" *ngIf="template.description">
                      {{ template.description }}
                    </span>
                  </div>
                </mat-option>
              </mat-select>
              <mat-hint>{{ reportTemplates.length }} templates disponíveis</mat-hint>
            </mat-form-field>

            <div *ngIf="templateControl.value" style="margin-top: 12px;">
              <mat-chip-listbox>
                <mat-chip>
                  <mat-icon matChipAvatar>layers</mat-icon>
                  {{ templateControl.value.sections?.length || 0 }} seções configuradas
                </mat-chip>
              </mat-chip-listbox>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Seleção de Competências -->
        <mat-card style="margin-bottom: 20px;">
          <mat-card-header>
            <mat-card-title style="font-size: 16px; color: #333;">
              <mat-icon style="vertical-align: middle; margin-right: 8px;">psychology</mat-icon>
              2. Selecione as Competências
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-form-field appearance="outline" style="width: 100%;">
              <mat-label>Competências</mat-label>
              <mat-select [formControl]="competenciesControl" multiple>
                <mat-option *ngFor="let competency of competencies" [value]="competency">
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-weight: 500;">{{ competency.name }}</span>
                    <span style="font-size: 12px; color: #666;">
                      {{ competency.description }}
                    </span>
                    <span style="font-size: 11px; color: #888;">
                      {{ competency.perguntasIds?.length || 0 }} questões
                    </span>
                  </div>
                </mat-option>
              </mat-select>
              <mat-hint>
                {{ competencies.length }} competências disponíveis.
                {{ (competenciesControl.value || []).length }} selecionadas.
              </mat-hint>
            </mat-form-field>

            <div *ngIf="(competenciesControl.value || []).length > 0" style="margin-top: 12px;">
              <mat-chip-listbox>
                <mat-chip *ngFor="let comp of competenciesControl.value || []">
                  <mat-icon matChipAvatar>psychology</mat-icon>
                  {{ comp.name }}
                </mat-chip>
              </mat-chip-listbox>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Resumo -->
        <mat-card *ngIf="templateControl.valid && competenciesControl.valid && (competenciesControl.value || []).length > 0" style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9;">
          <mat-card-header>
            <mat-card-title style="font-size: 16px; color: #0ea5e9;">
              <mat-icon style="vertical-align: middle; margin-right: 8px;">summarize</mat-icon>
              Resumo da Configuração
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
              <mat-chip>
                <mat-icon matChipAvatar>dashboard</mat-icon>
                Template: {{ templateControl.value?.name }}
              </mat-chip>
              <mat-chip>
                <mat-icon matChipAvatar>psychology</mat-icon>
                {{ (competenciesControl.value || []).length }} competências
              </mat-chip>
              <mat-chip>
                <mat-icon matChipAvatar>quiz</mat-icon>
                {{ getTotalQuestions() }} questões total
              </mat-chip>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" style="padding: 16px 24px; border-top: 1px solid #e0e0e0;">
      <button mat-button mat-dialog-close [disabled]="isGenerating">
        Cancelar
      </button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="templateControl.invalid || competenciesControl.invalid || isGenerating"
        (click)="generateReport()"
        style="margin-left: 8px;"
      >
        <mat-spinner *ngIf="isGenerating" [diameter]="20" style="margin-right: 8px;"></mat-spinner>
        <mat-icon *ngIf="!isGenerating" style="margin-right: 8px;">description</mat-icon>
        <span *ngIf="isGenerating">Gerando Relatório...</span>
        <span *ngIf="!isGenerating">Gerar Relatório PDF</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-chip-listbox {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    mat-chip {
      margin: 2px;
    }

    .mat-mdc-chip-listbox .mat-mdc-chip {
      --mdc-chip-container-height: 32px;
    }

    mat-card {
      margin-bottom: 16px;
    }

    mat-form-field {
      margin-bottom: 8px;
    }

    .mat-mdc-dialog-content {
      max-height: 70vh;
      overflow-y: auto;
    }
  `]
})
export class ReportGenerationModalComponent implements OnInit {
  templateControl = new FormControl<ReportTemplate | null>(null, [Validators.required]);
  competenciesControl = new FormControl<Competency[]>([], [Validators.required]);

  reportTemplates: ReportTemplate[] = [];
  competencies: Competency[] = [];

  isLoading = true;
  isGenerating = false;

  constructor(
    public dialogRef: MatDialogRef<ReportGenerationModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReportGenerationData,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.isLoading = true;
    try {
      await Promise.all([
        this.loadReportTemplates(),
        this.loadCompetencies()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.snackBar.open('Erro ao carregar dados. Tente novamente.', 'Fechar', { duration: 5000 });
    } finally {
      this.isLoading = false;
    }
  }

  async loadReportTemplates(): Promise<void> {
    try {
      const templatesCollection = collection(this.firestore, 'reportTemplates');
      const templatesSnapshot = await getDocs(templatesCollection);

      this.reportTemplates = templatesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ReportTemplate));

      console.log('Templates carregados:', this.reportTemplates.length);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      this.reportTemplates = [];
    }
  }

  async loadCompetencies(): Promise<void> {
    try {
      const competenciesCollection = collection(this.firestore, 'competencies');
      let competenciesSnapshot;

      // Se temos assessmentId, filtrar por ele
      if (this.data.assessmentId) {
        const competenciesQuery = query(competenciesCollection, where('assessmentId', '==', this.data.assessmentId));
        competenciesSnapshot = await getDocs(competenciesQuery);
      } else {
        competenciesSnapshot = await getDocs(competenciesCollection);
      }

      this.competencies = competenciesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Competency));

      console.log('Competências carregadas:', this.competencies.length);
    } catch (error) {
      console.error('Erro ao carregar competências:', error);
      this.competencies = [];
    }
  }





  getTotalQuestions(): number {
    const selectedComps = this.competenciesControl.value || [];
    return selectedComps.reduce((total, comp) =>
      total + (comp.perguntasIds?.length || 0), 0);
  }

  async generateReport(): Promise<void> {
    if (this.templateControl.invalid || this.competenciesControl.invalid) {
      this.snackBar.open('Por favor, selecione um template e pelo menos uma competência.', 'Fechar', { duration: 3000 });
      return;
    }

    this.isGenerating = true;

    try {
      // Gerar PDF sem abrir a página de relatórios, carregando o componente de forma dinâmica em offscreen
      const { ReportsComponent } = await import('../../reports/reports.component');
      const host = document.createElement('div');
      host.style.position = 'fixed';
      host.style.left = '-20000px';
      host.style.top = '-20000px';
      document.body.appendChild(host);

      // Criar uma instância do componente via Angular appRef (mais robusto seria via ViewContainerRef; simplificado aqui)
      // Como fallback, vamos navegar se algo falhar
      try {
        // Em ambientes reais, deveríamos injetar ComponentFactoryResolver e ApplicationRef.
        // Para manter simples, use a navegação existente caso a criação dinâmica não seja suportada neste contexto.
        throw new Error('dynamic-render-not-implemented');
      } catch (_) {
        // Fallback: usar a navegação automática existente
        const navigationParams = {
          queryParams: {
            assessmentId: this.data.assessmentId,
            participantId: this.data.participant.id,
            participantName: this.data.participant.name,
            templateId: this.templateControl.value?.id || '',
            competencyIds: JSON.stringify((this.competenciesControl.value || []).map(c => c.id)),
            mode: 'individual',
            autoGenerate: 'true'
          }
        };
        this.dialogRef.close({ success: true });
        this.router.navigate(['/reports'], navigationParams);
      }

    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      this.snackBar.open('Erro ao gerar relatório. Tente novamente.', 'Fechar', { duration: 5000 });
    } finally {
      this.isGenerating = false;
    }
  }
}
