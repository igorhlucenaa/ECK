import { Component, Inject, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
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
    <h2 mat-dialog-title style="display: flex; align-items: center; gap: 12px;">
      <mat-icon style="color: #6366f1;">description</mat-icon>
      {{ 'Gerar Relatório' | translate }} - {{ data.participant.name }}
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
              {{ 'Informações do Participante' | translate }}
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
              1. {{ 'Selecione o Template de Relatório' | translate }}
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-form-field appearance="outline" style="width: 100%;">
              <mat-label>{{ 'Template de Relatório' | translate }}</mat-label>
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
              <mat-hint>{{ reportTemplates.length }} {{ 'templates disponíveis' | translate }}</mat-hint>
            </mat-form-field>

            <div *ngIf="templateControl.value" style="margin-top: 12px;">
              <mat-chip-listbox>
                <mat-chip>
                  <mat-icon matChipAvatar>layers</mat-icon>
                  {{ templateControl.value.sections.length || 0 }} {{ 'seções configuradas' | translate }}
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
              2. {{ 'Selecione as Competências' | translate }}
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-form-field appearance="outline" style="width: 100%;">
              <mat-label>{{ 'Competências' | translate }}</mat-label>
              <mat-select [formControl]="competenciesControl" multiple>
                <mat-option *ngFor="let competency of competencies" [value]="competency">
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-weight: 500;">{{ competency.name }}</span>
                    <span style="font-size: 12px; color: #666;">
                      {{ competency.description }}
                    </span>
                    <span style="font-size: 11px; color: #888;">
                      {{ competency.perguntasIds.length || 0 }} {{ 'questões' | translate }}
                    </span>
                  </div>
                </mat-option>
              </mat-select>
              <mat-hint>
                {{ competencies.length }} {{ 'competências disponíveis.' | translate }}
                {{ (competenciesControl.value || []).length }} {{ 'selecionadas.' | translate }}
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
              {{ 'Resumo da Configuração' | translate }}
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
              <mat-chip>
                <mat-icon matChipAvatar>dashboard</mat-icon>
                {{ 'Template' | translate }}: {{ templateControl.value?.name }}
              </mat-chip>
              <mat-chip>
                <mat-icon matChipAvatar>psychology</mat-icon>
                {{ (competenciesControl.value || []).length }} {{ 'competências' | translate }}
              </mat-chip>
              <mat-chip>
                <mat-icon matChipAvatar>quiz</mat-icon>
                {{ getTotalQuestions() }} {{ 'questões total' | translate }}
              </mat-chip>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" style="padding: 16px 24px; border-top: 1px solid #e0e0e0;">
      <button mat-button mat-dialog-close [disabled]="isGenerating">
        {{ 'Cancelar' | translate }}
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
        <span *ngIf="isGenerating">{{ 'Gerando Relatório...' | translate }}</span>
        <span *ngIf="!isGenerating">{{ 'Gerar Relatório PDF' | translate }}</span>
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
    private router: Router,
    private dialog: MatDialog,
    private translate: TranslateService
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
      this.snackBar.open(this.translate.instant('Erro ao carregar dados. Tente novamente.'), this.translate.instant('Fechar'), { duration: 5000 });
    } finally {
      this.isLoading = false;
    }
  }

  async loadReportTemplates(): Promise<void> {
    try {
      const templatesCollection = collection(this.firestore, 'reportTemplates');
      const templatesSnapshot = await getDocs(templatesCollection);

      this.reportTemplates = templatesSnapshot.docs.map(doc => {
        const data: any = doc.data();
        return {
          id: doc.id,
          name: data['name'] || data['nome'] || 'Template sem nome',
          description: data['description'] || data['descricao'] || '',
          sections: data['sections'] || data['configuracao'] || [],
          clientId: data['clientId'] || '',
          assessmentId: data['assessmentId'] || data['avaliacaoId'] || undefined
        } as ReportTemplate;
      });

      console.log('Templates carregados:', this.reportTemplates.length);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      this.reportTemplates = [];
    }
  }

  async loadCompetencies(): Promise<void> {
    try {
      // Buscar grupos de competências do cliente
      const groupsCollection = collection(this.firestore, 'competencyGroups');
      let groupsSnapshot;

      if (this.data.clientId) {
        const groupsQuery = query(groupsCollection, where('clientId', '==', this.data.clientId));
        groupsSnapshot = await getDocs(groupsQuery);
      } else {
        // Fallback: buscar todas as competências se não tiver clientId
        const competenciesCollection = collection(this.firestore, 'competencies');
        let competenciesSnapshot;

        if (this.data.assessmentId) {
          const competenciesQuery = query(competenciesCollection, where('assessmentId', '==', this.data.assessmentId));
          competenciesSnapshot = await getDocs(competenciesQuery);
        } else {
          competenciesSnapshot = await getDocs(competenciesCollection);
        }

        this.competencies = competenciesSnapshot.docs.map(doc => {
          const data: any = doc.data();
          return {
            id: doc.id,
            name: data['name'] || data['nome'] || 'Competência sem nome',
            description: data['description'] || data['descricao'] || '',
            perguntasIds: data['perguntasIds'] || data['questionIds'] || [],
            assessmentId: data['assessmentId'] || undefined
          } as Competency;
        });
        return;
      }

      // Processar grupos de competências
      this.competencies = [];
      groupsSnapshot.docs.forEach(doc => {
        const groupData = doc.data();
        const groupName = groupData['name'] || 'Grupo sem nome';

        // Adicionar o grupo como uma competência
        this.competencies.push({
          id: doc.id,
          name: groupName,
          description: `Grupo de competências: ${groupData['competencias']?.length || 0} competências`,
          perguntasIds: groupData['competencias'] || [],
          assessmentId: groupData['assessmentId'] || undefined
        } as Competency);
      });

      console.log('Grupos de competências carregados:', this.competencies.length);
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
      // Navegar para a página de relatórios com configuração automática
      const selectedTemplate = this.templateControl.value!;
      const selectedCompetencies = this.competenciesControl.value || [];

                   // Preparar parâmetros para navegação
             const queryParams = {
               mode: 'individual',
               assessmentId: this.data.assessmentId,
               participantId: this.data.participant.id,
               participantName: this.data.participant.name,
               templateId: selectedTemplate.id,
               competencyIds: JSON.stringify(selectedCompetencies.map(c => c.id)),
               autoGenerate: 'true',
               aba: 'visualizar'
             };

      // Fechar este modal
      this.dialogRef.close({ success: true });

            // Navegar para a página de relatórios
      this.router.navigate(['/reports'], {
        queryParams: queryParams
      });

      this.snackBar.open(this.translate.instant('Redirecionando para geração do relatório...'), this.translate.instant('Fechar'), { duration: 3000 });

    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      this.snackBar.open(this.translate.instant('Erro ao gerar relatório. Tente novamente.'), this.translate.instant('Fechar'), { duration: 5000 });
    } finally {
      this.isGenerating = false;
    }
  }


}
