import { Component, OnInit } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { Firestore, collection, getDocs, query, where, doc, getDoc } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as XLSX from 'xlsx';
import { Timestamp } from '@angular/fire/firestore';
import { Chart as ChartJS } from 'chart.js';

interface Assessment {
  id: string;
  name: string;
  description: string;
  createdAt: Timestamp;
  clientId: string;
  clientName?: string;
}

interface AssessmentResult {
  competencia: string;
  autoavaliacao: number;
  gestor: number;
  pares: number;
  liderados: number;
  resultadoFinal: number;
}

interface ReportConfig {
  showRadarChart: boolean;
  showBarCharts: boolean;
  showSummaryTable: boolean;
  selectedCompetencies: string[];
  customColors: {
    autoavaliacao: string;
    gestor: string;
    pares: string;
    liderados: string;
    resultadoFinal: string;
  };
}

interface AssessmentLink {
  id: string;
  assessmentId: string;
  participantId: string;
  participantEmail: string;
  status: string;
  sentAt: Timestamp;
  completedAt?: Timestamp;
}

interface Participant {
  id: string;
  name: string;
  email: string;
}

@Component({
  selector: 'app-export',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './export.component.html',
  styleUrl: './export.component.scss'
})
export class ExportComponent implements OnInit {
  assessments: Assessment[] = [];
  selectedAssessment: string | null = null;
  exportFormat: 'pdf' | 'excel' = 'excel';
  isLoading = false;
  reportForm: FormGroup;
  previewChart: any;

  defaultColors = {
    autoavaliacao: '#4CAF50',
    gestor: '#F44336',
    pares: '#FFC107',
    liderados: '#9E9E9E',
    resultadoFinal: '#673AB7'
  };

  competencias = [
    'Comunicação',
    'Organização',
    'Flexibilidade',
    'Previsibilidade',
    'Orientação aos resultados',
    'Confiança',
    'Autoestima',
    'Negociação',
    'Autodesenvolvimento',
    'O que o avaliado deveria fazer para melhor',
    'Inteligência emocional',
    'Empatia'
  ];

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private fb: FormBuilder
  ) {
    this.reportForm = this.fb.group({
      showRadarChart: [true],
      showBarCharts: [true],
      showSummaryTable: [true],
      selectedCompetencies: [this.competencias],
      colors: this.fb.group({
        autoavaliacao: [this.defaultColors.autoavaliacao],
        gestor: [this.defaultColors.gestor],
        pares: [this.defaultColors.pares],
        liderados: [this.defaultColors.liderados],
        resultadoFinal: [this.defaultColors.resultadoFinal]
      })
    });

    // Atualizar preview quando as configurações mudarem
    this.reportForm.valueChanges.subscribe(() => {
      this.updatePreview();
    });
  }

  async ngOnInit() {
    await this.loadAssessments();
  }

  async loadAssessments() {
    try {
      const assessmentsCollection = collection(this.firestore, 'assessments');
      const snapshot = await getDocs(assessmentsCollection);

      this.assessments = await Promise.all(
        snapshot.docs.map(async (assessmentDoc) => {
          const data = assessmentDoc.data();
          const clientDoc = await getDoc(doc(this.firestore, 'clients', data['clientId']));
          const clientData: any = clientDoc.data();

          return {
            id: assessmentDoc.id,
            name: data['name'],
            description: data['description'],
            createdAt: data['createdAt'],
            clientId: data['clientId'],
            clientName: clientData?.['name'] || 'Cliente não encontrado'
          };
        })
      );
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      this.snackBar.open('Erro ao carregar avaliações.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async updatePreview() {
    if (!this.selectedAssessment) return;

    const config = this.reportForm.value;
    if (this.previewChart) {
      this.previewChart.destroy();
    }

    if (config.showRadarChart) {
      const ctx = document.getElementById('previewChart') as HTMLCanvasElement;
      if (!ctx) return;

      // Simular dados para preview
      const data = {
        labels: config.selectedCompetencies,
        datasets: [
          {
            label: 'Autoavaliação',
            data: Array(config.selectedCompetencies.length).fill(3),
            borderColor: config.colors.autoavaliacao,
            backgroundColor: `${config.colors.autoavaliacao}33`
          },
          {
            label: 'Gestor',
            data: Array(config.selectedCompetencies.length).fill(3.5),
            borderColor: config.colors.gestor,
            backgroundColor: `${config.colors.gestor}33`
          },
          {
            label: 'Pares',
            data: Array(config.selectedCompetencies.length).fill(4),
            borderColor: config.colors.pares,
            backgroundColor: `${config.colors.pares}33`
          },
          {
            label: 'Liderados',
            data: Array(config.selectedCompetencies.length).fill(3.8),
            borderColor: config.colors.liderados,
            backgroundColor: `${config.colors.liderados}33`
          },
          {
            label: 'Resultado Final',
            data: Array(config.selectedCompetencies.length).fill(3.6),
            borderColor: config.colors.resultadoFinal,
            backgroundColor: `${config.colors.resultadoFinal}33`
          }
        ]
      };

      this.previewChart = new ChartJS(ctx, {
        type: 'radar',
        data: data,
        options: {
          scales: {
            r: {
              min: 0,
              max: 5,
              ticks: {
                stepSize: 1
              }
            }
          }
        }
      });
    }
  }

  resetColors() {
    this.reportForm.patchValue({
      colors: this.defaultColors
    });
  }

  async exportReport() {
    if (!this.selectedAssessment) {
      this.snackBar.open('Selecione uma avaliação para exportar.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    this.isLoading = true;

    try {
      // Implementar a lógica de exportação com as configurações selecionadas
      const config = this.reportForm.value;

      // TODO: Implementar geração do relatório baseado nas configurações

      this.snackBar.open('Relatório exportado com sucesso!', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      this.snackBar.open('Erro ao gerar relatório.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isLoading = false;
    }
  }
}
