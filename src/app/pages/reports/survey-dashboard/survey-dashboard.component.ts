import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Firestore, collection, getDocs, doc, getDoc } from '@angular/fire/firestore';
import { Subject, takeUntil } from 'rxjs';

// Importar SurveyJS Dashboard
// Os CSS já estão configurados no angular.json
import { VisualizationPanel } from 'survey-analytics';
import { SurveyModel } from 'survey-core';

@Component({
  selector: 'app-survey-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './survey-dashboard.component.html',
  styleUrls: ['./survey-dashboard.component.scss']
})
export class SurveyDashboardComponent implements OnInit, OnDestroy {
  @Input() assessmentId: string | null = null;
  @ViewChild('dashboardContainer', { static: false }) dashboardContainer!: ElementRef;

  private destroy$ = new Subject<void>();
  dashboard: VisualizationPanel | null = null;

  isLoading = false;
  error: string | null = null;
  surveyJSON: any = null;
  surveyResults: any[] = [];

  constructor(
    private firestore: Firestore,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.assessmentId) {
      this.loadDashboard();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.dashboard) {
      this.dashboard.destroy();
    }
  }

  async loadDashboard(): Promise<void> {
    if (!this.assessmentId) {
      this.error = 'ID da avaliação não fornecido';
      return;
    }

    this.isLoading = true;
    this.error = null;

    try {
      // 1. Carregar surveyJSON
      const assessmentRef = doc(this.firestore, 'assessments', this.assessmentId);
      const assessmentSnap = await getDoc(assessmentRef);

      if (!assessmentSnap.exists()) {
        throw new Error('Avaliação não encontrada');
      }

      const assessmentData = assessmentSnap.data();
      this.surveyJSON = assessmentData['surveyJSON'];

      if (!this.surveyJSON) {
        throw new Error('SurveyJSON não encontrado na avaliação');
      }

      // 2. Carregar resultados
      const resultsRef = collection(this.firestore, `assessments/${this.assessmentId}/results`);
      const resultsSnap = await getDocs(resultsRef);

      // 3. Converter resultados para formato SurveyJS
      this.surveyResults = await this.convertResultsToSurveyFormat(resultsSnap);

      if (this.surveyResults.length === 0) {
        this.error = 'Nenhum resultado encontrado para esta avaliação';
        this.isLoading = false;
        this.cdr.detectChanges();
        return;
      }

      // 4. Renderizar dashboard após view init
      setTimeout(() => this.renderDashboard(), 100);

    } catch (error: any) {
      console.error('Erro ao carregar dashboard:', error);
      this.error = error.message || 'Erro ao carregar dashboard';
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Converte resultados do Firestore para formato esperado pelo SurveyJS Dashboard
   */
  private async convertResultsToSurveyFormat(resultsSnap: any): Promise<any[]> {
    const results: any[] = [];

    for (const resultDoc of resultsSnap.docs) {
      const resultData = resultDoc.data();
      const surveyData = resultData['surveyData'] || {};

      // Buscar dados do participante
      let participantName = 'Participante Desconhecido';
      let participantCategory = 'Outros';

      if (resultData['participantId']) {
        try {
          const participantRef = doc(this.firestore, 'participants', resultData['participantId']);
          const participantSnap = await getDoc(participantRef);
          
          if (participantSnap.exists()) {
            const participantData = participantSnap.data();
            participantName = participantData['name'] || participantName;
            participantCategory = participantData['category'] || participantCategory;
          }
        } catch (error) {
          console.warn('Erro ao buscar participante:', error);
        }
      }

      // Converter surveyData para formato SurveyJS
      // SurveyJS espera: { "pergunta1": "valor1", "pergunta2": "valor2" }
      const convertedData: any = {
        ...surveyData,
        // Adicionar metadados como campos customizados
        '__participantName': participantName,
        '__participantCategory': participantCategory,
        '__completedAt': resultData['completedAt']?.toDate?.() || new Date()
      };

      // Processar estruturas aninhadas (matrizes)
      // Se houver estruturas como { "pergunta4": { "Row 1": "Column 1" } }
      // SurveyJS Dashboard pode precisar de formato diferente
      const flattenedData = this.flattenSurveyData(convertedData);

      results.push(flattenedData);
    }

    return results;
  }

  /**
   * Achata estruturas aninhadas de matrizes para formato mais simples
   */
  private flattenSurveyData(data: any): any {
    const flattened: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // É um objeto aninhado (provavelmente matriz)
        // Converter para formato: "pergunta4_Row1" = "Column1"
        for (const [rowKey, colValue] of Object.entries(value)) {
          const flatKey = `${key}_${rowKey}`;
          flattened[flatKey] = colValue;
        }
      } else {
        flattened[key] = value;
      }
    }

    return flattened;
  }

  /**
   * Renderiza o dashboard SurveyJS
   */
  private renderDashboard(): void {
    if (!this.dashboardContainer || !this.dashboardContainer.nativeElement) {
      console.error('Container do dashboard não encontrado');
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    if (!this.surveyJSON || this.surveyResults.length === 0) {
      console.error('Dados insuficientes para renderizar dashboard');
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    try {
      // Limpar dashboard anterior se existir
      if (this.dashboard) {
        this.dashboard.destroy();
      }

      // Criar modelo do survey a partir do surveyJSON
      const survey = new SurveyModel(this.surveyJSON);
      
      // Obter todas as questões do survey
      const questions = survey.getAllQuestions();

      // Configurações do dashboard
      const dashboardOptions = {
        // Permitir customização
        allowDynamicLayout: true,
        // Mostrar filtros
        showFilter: true,
        // Mostrar barra de ferramentas
        showToolbar: true
      };

      // Criar e renderizar dashboard
      this.dashboard = new VisualizationPanel(
        questions,
        this.surveyResults,
        dashboardOptions
      );

      this.dashboard.render(this.dashboardContainer.nativeElement);

      this.isLoading = false;
      this.cdr.detectChanges();

    } catch (error: any) {
      console.error('Erro ao renderizar dashboard:', error);
      this.error = `Erro ao renderizar dashboard: ${error.message}`;
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Recarrega o dashboard
   */
  async reload(): Promise<void> {
    if (this.dashboard) {
      this.dashboard.destroy();
      this.dashboard = null;
    }
    await this.loadDashboard();
  }

  /**
   * Exporta dashboard para PDF
   */
  exportToPDF(): void {
    if (this.dashboard && typeof (this.dashboard as any).exportToPDF === 'function') {
      (this.dashboard as any).exportToPDF();
    } else {
      console.warn('Método exportToPDF não disponível no dashboard');
    }
  }

  /**
   * Exporta dashboard para Excel
   */
  exportToExcel(): void {
    if (this.dashboard && typeof (this.dashboard as any).exportToExcel === 'function') {
      (this.dashboard as any).exportToExcel();
    } else {
      console.warn('Método exportToExcel não disponível no dashboard');
    }
  }
}
