import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { NgApexchartsModule } from 'ng-apexcharts';
import { MetricsService, MetricConfig } from '../services/metrics.service';
import { ReportExportService } from '../services/report-export.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-report-metrics',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    NgApexchartsModule
  ],
  template: `
    <div class="metrics-container">
      <mat-card class="config-card">
        <mat-card-header>
          <mat-card-title>Configuração de Métricas</mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="metricsForm">
            <!-- Seleção de Avaliação -->
            <mat-form-field class="w-100">
              <mat-label>Selecione a Avaliação</mat-label>
              <mat-select formControlName="assessmentId">
                <mat-option *ngFor="let assessment of assessments" [value]="assessment.id">
                  {{assessment.name}}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Seleção de Métricas -->
            <div formArrayName="metrics">
              <div *ngFor="let metric of metricsControls; let i = index" [formGroupName]="i" class="metric-item">
                <mat-form-field>
                  <mat-label>Nome da Métrica</mat-label>
                  <input matInput formControlName="name">
                </mat-form-field>

                <mat-form-field>
                  <mat-label>Tipo de Métrica</mat-label>
                  <mat-select formControlName="type">
                    <mat-option value="media">Média</mat-option>
                    <mat-option value="contagem">Contagem</mat-option>
                    <mat-option value="percentual">Percentual</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field>
                  <mat-label>Categoria</mat-label>
                  <mat-select formControlName="categoria">
                    <mat-option value="competencias">Competências</mat-option>
                    <mat-option value="perguntas">Perguntas</mat-option>
                    <mat-option value="participantes">Participantes</mat-option>
                  </mat-select>
                </mat-form-field>

                <button mat-icon-button color="warn" (click)="removeMetric(i)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>

            <div class="actions">
              <button mat-raised-button color="primary" (click)="addMetric()">
                Adicionar Métrica
              </button>

              <mat-form-field>
                <mat-label>Formato de Exportação</mat-label>
                <mat-select formControlName="format">
                  <mat-option value="pdf">PDF</mat-option>
                  <mat-option value="excel">Excel</mat-option>
                </mat-select>
              </mat-form-field>

              <button
                mat-raised-button
                color="accent"
                [disabled]="!metricsForm.valid || !metricsForm.get('metrics')?.value?.length"
                (click)="exportReport()"
              >
                Exportar Relatório
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Preview dos Gráficos -->
      <mat-card class="preview-card">
        <mat-card-header>
          <mat-card-title>Preview das Métricas</mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <div *ngFor="let chart of previewCharts" class="chart-container">
            <apx-chart
              [series]="chart.series"
              [chart]="chart.chart"
              [xaxis]="chart.xaxis"
              [dataLabels]="chart.dataLabels"
              [grid]="chart.grid"
              [stroke]="chart.stroke"
              [title]="chart.title"
            ></apx-chart>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .metrics-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      padding: 20px;
    }

    .config-card, .preview-card {
      height: 100%;
    }

    .metric-item {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      gap: 10px;
      margin-bottom: 15px;
      padding: 10px;
      border: 1px solid #eee;
      border-radius: 4px;
    }

    .chart-container {
      margin-bottom: 20px;
    }

    .w-100 {
      width: 100%;
    }

    .actions {
      display: flex;
      gap: 16px;
      align-items: center;
      margin-top: 20px;
    }
  `]
})
export class ReportMetricsComponent implements OnInit {
  metricsForm: FormGroup;
  assessments: any[] = [];
  previewCharts: any[] = [];

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    private metricsService: MetricsService,
    private reportExportService: ReportExportService,
    private snackBar: MatSnackBar
  ) {
    this.metricsForm = this.fb.group({
      assessmentId: [''],
      metrics: this.fb.array([]),
      format: ['pdf']
    });

    this.metricsForm.valueChanges.subscribe(() => {
      this.updatePreview();
    });
  }

  async ngOnInit() {
    await this.loadAssessments();
  }

  async loadAssessments() {
    try {
      const assessmentsRef = collection(this.firestore, 'assessments');
      const snapshot = await getDocs(assessmentsRef);
      this.assessments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      this.snackBar.open('Erro ao carregar avaliações', 'Fechar', {
        duration: 3000
      });
    }
  }

  get metricsControls() {
    return (this.metricsForm.get('metrics') as any).controls;
  }

  addMetric() {
    const metricsArray = this.metricsForm.get('metrics') as any;
    metricsArray.push(
      this.fb.group({
        name: [''],
        type: ['media'],
        categoria: ['competencias']
      })
    );
  }

  removeMetric(index: number) {
    const metricsArray = this.metricsForm.get('metrics') as any;
    metricsArray.removeAt(index);
  }

  async updatePreview() {
    const formValue = this.metricsForm.value;
    if (!formValue.assessmentId || !formValue.metrics.length) return;

    this.previewCharts = [];

    for (const metric of formValue.metrics) {
      const chartData = await this.metricsService.calculateMetric(formValue.assessmentId, metric);
      this.previewCharts.push(this.createChartConfig(metric.name, chartData));
    }
  }

  async exportReport() {
    try {
      const formValue = this.metricsForm.value;
      await this.reportExportService.exportReport({
        assessmentId: formValue.assessmentId,
        metrics: formValue.metrics,
        format: formValue.format
      });

      this.snackBar.open('Relatório exportado com sucesso!', 'Fechar', {
        duration: 3000
      });
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      this.snackBar.open('Erro ao exportar relatório', 'Fechar', {
        duration: 3000
      });
    }
  }

  private createChartConfig(title: string, data: any[]) {
    return {
      series: [{
        name: title,
        data: data.map(item => item.y)
      }],
      chart: {
        type: 'bar',
        height: 350
      },
      title: {
        text: title,
        align: 'center'
      },
      xaxis: {
        categories: data.map(item => item.x),
        labels: {
          rotate: -45,
          trim: true,
          maxHeight: 120
        }
      },
      dataLabels: {
        enabled: true,
        formatter: function(val: number) {
          return val.toFixed(1);
        }
      },
      grid: {
        show: true
      },
      stroke: {
        show: true,
        width: 2
      }
    };
  }
}
