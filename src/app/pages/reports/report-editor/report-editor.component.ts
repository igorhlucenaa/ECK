import { Component, OnInit, OnDestroy, ViewChild, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule, MatTable } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ReportsService } from '../services/reports.service';
import { AssessmentDataService, Assessment, AssessmentData } from '../services/assessment-data.service';
import { MetricPreviewComponent } from './metric-preview.component';
import { AuthService, User } from '../../auth/services/auth.service';
import { MatTableDataSource } from '@angular/material/table';
import { Subscription, finalize, forkJoin, firstValueFrom } from 'rxjs';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { MatCheckboxModule, MatCheckboxChange } from '@angular/material/checkbox';

export interface MetricConfig {
  id: string;
  name: string;
  type: string;
  fieldMapping: any;
  filterValue?: string;
  filterField?: string;
  showInPdf?: boolean;
}

interface ClientStyle {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  colorScheme?: any;
}

@Component({
  selector: 'app-report-editor',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatCheckboxModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    MatSnackBarModule,
    MetricPreviewComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="container my-4">
      <mat-card>
        <mat-card-header>
          <mat-card-title>
            {{ editMode ? 'Editar Relatório' : 'Novo Relatório' }}
          </mat-card-title>
          <mat-card-subtitle>
            {{ editMode ? 'Modifique o relatório existente' : 'Crie um novo relatório personalizado com as métricas desejadas' }}
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="reportForm" *ngIf="reportForm">
            <div class="row mb-3">
              <div class="col-md-6">
                <mat-form-field appearance="outline" class="w-100">
                  <mat-label>Nome do Relatório</mat-label>
                  <input matInput formControlName="name" placeholder="Digite um nome para o relatório">
                  <mat-error *ngIf="reportForm.get('name')?.hasError('required')">Nome é obrigatório</mat-error>
                </mat-form-field>
              </div>

              <div class="col-md-6">
                <mat-form-field appearance="outline" class="w-100">
                  <mat-label>Selecione a Avaliação</mat-label>
                  <mat-select formControlName="assessmentId" (selectionChange)="onAssessmentChange()">
                    <mat-option *ngFor="let assessment of assessments" [value]="assessment.id">
                      {{ assessment.name }}
                    </mat-option>
                  </mat-select>
                  <mat-error *ngIf="reportForm.get('assessmentId')?.hasError('required')">Avaliação é obrigatória</mat-error>
                </mat-form-field>
              </div>
            </div>
          </form>

          <mat-tab-group *ngIf="reportForm?.get('assessmentId')?.value">
            <mat-tab label="Designer de Relatório">
              <div class="row mt-4">
                <div class="col-md-3">
                  <mat-card class="metrics-options">
                    <mat-card-header>
                      <mat-card-title>Métricas Disponíveis</mat-card-title>
                    </mat-card-header>
                    <mat-card-content>
                      <div
                        cdkDropList
                        #availableList="cdkDropList"
                        [cdkDropListData]="availableMetricTypes"
                        [cdkDropListConnectedTo]="[selectedList]"
                        class="metrics-list"
                        (cdkDropListDropped)="drop($event)">
                        <div class="metric-item" *ngFor="let metricType of availableMetricTypes"
                          cdkDrag
                          [cdkDragData]="metricType">
                          <div class="metric-content">
                            <mat-icon>{{ getMetricIcon(metricType.type) }}</mat-icon>
                            <span>{{ metricType.name }}</span>
                          </div>
                        </div>
                      </div>
                    </mat-card-content>
                  </mat-card>
                </div>

                <div class="col-md-9">
                  <mat-card>
                    <mat-card-header>
                      <mat-card-title>Designer de Relatório</mat-card-title>
                      <mat-card-subtitle>Arraste os elementos para criar seu relatório personalizado</mat-card-subtitle>
                    </mat-card-header>
                    <mat-card-content>
                      <div
                        cdkDropList
                        #selectedList="cdkDropList"
                        [cdkDropListData]="metrics"
                        [cdkDropListConnectedTo]="[availableList]"
                        class="report-canvas"
                        (cdkDropListDropped)="drop($event)">

                        <div class="empty-message" *ngIf="metrics.length === 0">
                          Arraste métricas aqui para criar seu relatório
                        </div>

                        <div class="metric-container" *ngFor="let metric of metrics; let i = index" cdkDrag>
                          <div class="metric-header">
                            <span>{{ metric.name }}</span>
                            <div class="metric-actions">
                              <mat-checkbox [checked]="metric.showInPdf" (change)="togglePdfInclude(i, $event)">
                                Incluir no PDF
                              </mat-checkbox>
                              <button mat-icon-button (click)="configureMetric(i)">
                                <mat-icon>settings</mat-icon>
                              </button>
                              <button mat-icon-button color="warn" (click)="removeMetric(i)">
                                <mat-icon>delete</mat-icon>
                              </button>
                            </div>
                          </div>

                          <div class="metric-preview">
                            <app-metric-preview
                              [config]="metric"
                              [assessmentId]="reportForm?.get('assessmentId')?.value">
                            </app-metric-preview>
                          </div>
                        </div>
                      </div>
                    </mat-card-content>
                  </mat-card>
                </div>
              </div>
            </mat-tab>

            <mat-tab label="Dashboard 360°">
              <div class="row mt-4">
                <div class="col-md-12" *ngIf="loading">
                  <div class="loading-container">
                    <mat-spinner></mat-spinner>
                    <p>Carregando dados...</p>
                  </div>
                </div>

                <div class="col-md-12" *ngIf="!loading && processedData">
                  <div class="row">
                    <div class="col-md-8">
                      <h4>Resumo da Avaliação</h4>
                      <!-- Tabela de resumo das competências -->
                      <div class="table-container">
                        <table class="summary-table">
                          <thead>
                            <tr>
                              <th>Competência</th>
                              <th>Autoavaliação</th>
                              <th>Gestor</th>
                              <th>Pares</th>
                              <th>Liderados</th>
                              <th>Resultado final</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr *ngFor="let row of processedData.summary">
                              <td>{{row.competencia}}</td>
                              <td>{{row.autoavaliacao || '-'}}</td>
                              <td>{{row.gestor || '-'}}</td>
                              <td>{{row.pares || '-'}}</td>
                              <td>{{row.liderados || '-'}}</td>
                              <td class="highlight">{{row.resultado || '-'}}</td>
                            </tr>
                          </tbody>
                          <tfoot>
                            <tr>
                              <td><strong>Resultado da seção</strong></td>
                              <td>{{getSectionAverage('autoavaliacao')}}</td>
                              <td>{{getSectionAverage('gestor')}}</td>
                              <td>{{getSectionAverage('pares')}}</td>
                              <td>{{getSectionAverage('liderados')}}</td>
                              <td class="highlight">{{getSectionAverage('resultado')}}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    <div class="col-md-4">
                      <!-- Gráfico de comparação por avaliador -->
                      <h4>Comparação por Avaliador</h4>
                      <app-metric-preview
                        [config]="{
                          id: 'compare360',
                          name: 'Comparação Geral',
                          type: 'compare360',
                          fieldMapping: {}
                        }"
                        [assessmentId]="reportForm?.get('assessmentId')?.value">
                      </app-metric-preview>
                    </div>
                  </div>

                  <div class="row mt-4">
                    <div class="col-md-6">
                      <!-- Gráfico de radar 360° -->
                      <h4>Radar 360° de Competências</h4>
                      <app-metric-preview
                        [config]="{
                          id: 'radar360',
                          name: 'Radar 360°',
                          type: 'radar360',
                          fieldMapping: {}
                        }"
                        [assessmentId]="reportForm?.get('assessmentId')?.value">
                      </app-metric-preview>
                    </div>

                    <div class="col-md-6">
                      <!-- Competências individuais -->
                      <h4>Competências Individuais</h4>
                      <mat-form-field appearance="outline" class="w-100">
                        <mat-label>Selecione uma competência</mat-label>
                        <mat-select [(value)]="selectedCompetency" (selectionChange)="onCompetencyChange()">
                          <mat-option *ngFor="let comp of competencies" [value]="comp">
                            {{comp}}
                          </mat-option>
                        </mat-select>
                      </mat-form-field>

                      <app-metric-preview
                        *ngIf="selectedCompetency && competencyMetricConfig"
                        [config]="competencyMetricConfig"
                        [assessmentId]="reportForm?.get('assessmentId')?.value">
                      </app-metric-preview>
                    </div>
                  </div>

                  <div class="row mt-4">
                    <div class="col-md-12">
                      <div class="export-buttons">
                        <button mat-raised-button color="primary" (click)="exportToPdf()">
                          <mat-icon>picture_as_pdf</mat-icon>
                          Exportar Relatório em PDF
                        </button>
                        <button mat-raised-button color="primary" (click)="exportToExcel()">
                          <mat-icon>grid_on</mat-icon>
                          Exportar Dados em Excel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </mat-tab>

            <mat-tab label="Dados Brutos">
              <div class="row mt-4">
                <div class="col-md-12">
                  <div class="loading-container" *ngIf="loading">
                    <mat-spinner></mat-spinner>
                  </div>

                  <div *ngIf="!loading">
                    <div class="table-container">
                      <div class="export-buttons mb-3">
                        <button mat-raised-button color="primary" (click)="exportToExcel()">
                          <mat-icon>grid_on</mat-icon>
                          Exportar em Excel
                        </button>
                      </div>

                      <table mat-table [dataSource]="dataSource" matSort class="w-100">
                        <ng-container *ngFor="let column of displayedColumns" [matColumnDef]="column">
                          <th mat-header-cell *matHeaderCellDef mat-sort-header>
                            {{ formatColumnName(column) }}
                          </th>
                          <td mat-cell *matCellDef="let element">
                            {{ formatCellValue(element[column]) }}
                          </td>
                        </ng-container>

                        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                      </table>

                      <mat-paginator
                        [pageSizeOptions]="[10, 25, 50, 100]"
                        showFirstLastButtons>
                      </mat-paginator>
                    </div>
                  </div>
                </div>
              </div>
            </mat-tab>
          </mat-tab-group>
        </mat-card-content>

        <mat-card-actions align="end">
          <button mat-button (click)="cancel()">Cancelar</button>
          <button mat-raised-button color="primary"
            [disabled]="reportForm?.invalid || (editMode && metrics.length === 0)"
            (click)="saveReport()">
            {{ editMode ? 'Atualizar' : 'Salvar' }} Relatório
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .metrics-options {
      height: 100%;
    }

    .metrics-list {
      min-height: 400px;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
    }

    .metric-item {
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 10px;
      cursor: move;
      background-color: white;
    }

    .metric-content {
      display: flex;
      align-items: center;
    }

    .metric-content mat-icon {
      margin-right: 10px;
    }

    .report-canvas {
      min-height: 400px;
      border: 2px dashed #ccc;
      border-radius: 4px;
      padding: 20px;
    }

    .empty-message {
      color: #999;
      text-align: center;
      padding: 40px;
    }

    .metric-container {
      background-color: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 15px;
    }

    .metric-header {
      padding: 10px;
      background-color: #f5f5f5;
      border-bottom: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .metric-preview {
      padding: 15px;
      min-height: 250px;
    }

    .metric-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .cdk-drag-preview {
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }

    .cdk-drag-placeholder {
      opacity: 0.3;
    }

    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .table-container {
      overflow-x: auto;
      margin-bottom: 20px;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }

    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }

    .summary-table th,
    .summary-table td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: center;
    }

    .summary-table th {
      background-color: #f5f5f5;
      font-weight: bold;
    }

    .summary-table td:first-child {
      text-align: left;
      font-weight: 500;
    }

    .summary-table tfoot td {
      font-weight: bold;
      background-color: #f9f9f9;
    }

    .highlight {
      background-color: #e8f0fe;
    }

    .export-buttons {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
  `]
})
export class ReportEditorComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('selectedList') selectedList: any;
  @ViewChild('availableList') availableList: any;

  reportForm!: FormGroup;
  assessments: Assessment[] = [];
  metrics: MetricConfig[] = [];
  availableMetricTypes: any[] = [];
  editMode = false;
  reportId: string | null = null;

  // Dados da tabela
  displayedColumns: string[] = [];
  dataSource = new MatTableDataSource<any>([]);
  loading = false;
  assessmentData: AssessmentData[] = [];
  assessmentQuestions: any = {};

  // Dashboard 360°
  processedData: any = null;
  competencies: string[] = [];
  selectedCompetency: string = '';
  competencyMetricConfig: MetricConfig | null = null;

  // Estilos do cliente
  clientStyle: ClientStyle = {};

  // Usuário atual
  currentUser: User | null = null;

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private reportsService: ReportsService,
    private assessmentDataService: AssessmentDataService,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadAvailableMetricTypes();

    // Carrega o usuário atual usando o Observable
    this.subscriptions.add(
      this.authService.user.subscribe(user => {
        console.log('Usuário atual carregado:', user);
        this.currentUser = user;

        // Atualiza o formulário com os dados do usuário
        if (user) {
          this.reportForm.patchValue({
            createdBy: user.uid,
            clientId: user.clientId
          });
        }

        // Carrega avaliações após ter o usuário
        this.loadAssessments();
      })
    );

    // Verifica se estamos no modo de edição
    this.reportId = this.route.snapshot.paramMap.get('id');
    if (this.reportId) {
      this.editMode = true;
      this.loadReportData(this.reportId);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  initForm(): void {
    console.log('Inicializando formulário');
    this.reportForm = this.fb.group({
      name: ['', Validators.required],
      assessmentId: ['', Validators.required],
      clientId: [''],
      createdBy: [''],
      isPublic: [false]
    });
  }

  loadAssessments(): void {
    this.loading = true;

    let assessmentsObservable = this.assessmentDataService.getAssessments();

    console.log('Assessments Observable:', assessmentsObservable);

    this.subscriptions.add(
      assessmentsObservable
        .pipe(finalize(() => this.loading = false))
        .subscribe({
          next: (assessments) => {
            this.assessments = assessments;
          },
          error: (error) => {
            console.error('Erro ao carregar avaliações:', error);
            this.snackBar.open('Erro ao carregar avaliações', 'Fechar', { duration: 3000 });
          }
        })
    );
  }

  loadAvailableMetricTypes(): void {
    // Métrica padrão que serão disponíveis para o usuário
    this.availableMetricTypes = [
      { id: 'chart-bar', name: 'Gráfico de Barras', type: 'bar' },
      { id: 'chart-pie', name: 'Gráfico de Pizza', type: 'pie' },
      { id: 'chart-line', name: 'Gráfico de Linha', type: 'line' },
      { id: 'chart-radar', name: 'Gráfico de Radar', type: 'radar' },
      { id: 'chart-ranking', name: 'Ranking', type: 'ranking' },
      { id: 'chart-heatmap', name: 'Mapa de Calor', type: 'heatmap' },
      { id: 'chart-text', name: 'Resumo em Texto', type: 'text' },
      { id: 'chart-table', name: 'Tabela de Dados', type: 'table' },
      { id: 'chart-compare', name: 'Comparativo 360°', type: 'compare360' },
      { id: 'chart-radar360', name: 'Radar 360°', type: 'radar360' },
      { id: 'chart-summary', name: 'Resumo da Avaliação', type: 'summary' }
    ];
  }

  loadReportData(reportId: string): void {
    this.loading = true;
    this.subscriptions.add(
      this.reportsService.getReport(reportId)
        .pipe(finalize(() => this.loading = false))
        .subscribe({
          next: (report) => {
            if (report) {
              this.reportForm.patchValue({
                name: report.name,
                assessmentId: report.assessmentId,
                clientId: report.clientId,
                createdBy: report.createdBy,
                isPublic: report.isPublic
              });
              this.metrics = report.metrics || [];
              // Carregar dados após atualizar o formulário
              this.onAssessmentChange();
            } else {
              this.snackBar.open('Relatório não encontrado', 'Fechar', { duration: 3000 });
              this.router.navigate(['/reports']);
            }
          },
          error: (error) => {
            console.error('Erro ao carregar relatório:', error);
            this.snackBar.open('Erro ao carregar relatório', 'Fechar', { duration: 3000 });
          }
        })
    );
  }

  onAssessmentChange(): void {
    const assessmentId = this.reportForm.get('assessmentId')?.value;
    if (!assessmentId) return;

    this.loading = true;

    // Obtém os dados da avaliação e as perguntas em paralelo
    const assessmentData$ = this.assessmentDataService.getAssessmentData(assessmentId);
    const questions$ = this.assessmentDataService.getAssessmentQuestions(assessmentId);

    this.subscriptions.add(
      forkJoin([assessmentData$, questions$])
        .pipe(finalize(() => this.loading = false))
        .subscribe({
          next: ([data, questions]) => {
            this.assessmentData = data;
            this.assessmentQuestions = questions;

            // Processa os dados para exibição na tabela
            const tableData = this.assessmentDataService.processDataForTable(data);
            this.displayedColumns = this.assessmentDataService.getTableColumns(tableData);
            this.dataSource = new MatTableDataSource(tableData);

            // Processa os dados para visualização 360°
            this.processedData = this.assessmentDataService.process360Data(data);

            // Configura paginação e ordenação
            setTimeout(() => {
              if (this.paginator) this.dataSource.paginator = this.paginator;
              if (this.sort) this.dataSource.sort = this.sort;
            });

            // Extrai competências para o seletor de visualização individual
            if (this.processedData?.competencies) {
              this.competencies = Object.keys(this.processedData.competencies);
              if (this.competencies.length > 0) {
                this.selectedCompetency = this.competencies[0];
                this.onCompetencyChange();
              }
            }
          },
          error: (error) => {
            console.error('Erro ao carregar dados:', error);
            this.snackBar.open('Erro ao carregar dados da avaliação', 'Fechar', { duration: 3000 });
          }
        })
    );
  }

  onCompetencyChange(): void {
    if (this.selectedCompetency && this.processedData?.competencies) {
      this.competencyMetricConfig = {
        id: `comp-${this.selectedCompetency}`,
        name: `Competência: ${this.selectedCompetency}`,
        type: 'bar',
        fieldMapping: {
          competency: this.selectedCompetency,
          data: this.processedData.competencies[this.selectedCompetency]
        }
      };
    }
  }

  getSectionAverage(column: string): string {
    if (!this.processedData?.summary || this.processedData.summary.length === 0) return '-';

    let sum = 0, count = 0;

    this.processedData.summary.forEach((row: any) => {
      if (row[column] !== null && row[column] !== undefined) {
        sum += row[column];
        count++;
      }
    });

    return count > 0 ? (sum / count).toFixed(1) : '-';
  }

  drop(event: CdkDragDrop<any[]>): void {
    if (event.previousContainer === event.container) {
      // Reordenação dentro da mesma lista
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      // Transferência entre listas
      if (event.previousContainer.id === this.availableList?.id) {
        // Adicionando métrica do painel de opções para o relatório
        const metricType = event.item.data;
        const newMetric: MetricConfig = {
          id: `metric-${Date.now()}`,
          name: metricType.name,
          type: metricType.type,
          fieldMapping: {},
          showInPdf: true
        };

        // Insere a nova métrica na posição correta
        this.metrics.splice(event.currentIndex, 0, newMetric);

        // Configura a métrica recém-adicionada
        setTimeout(() => this.configureMetric(event.currentIndex), 100);
      } else {
        // Removendo métrica do relatório (voltando para opções)
        this.metrics.splice(event.previousIndex, 1);
      }
    }
  }

  configureMetric(index: number): void {
    const metric = this.metrics[index];

    // Implementação simplificada - numa versão final, abrir um dialog para configuração
    if (!metric.fieldMapping) {
      metric.fieldMapping = {};
    }

    // Configuração básica com base no tipo de métrica
    switch (metric.type) {
      case 'bar':
      case 'pie':
      case 'line':
      case 'radar':
        // Configuração para gráficos que usam competências
        const competencyKeys = Object.keys(this.assessmentQuestions);
        if (competencyKeys.length > 0) {
          metric.fieldMapping = {
            labels: competencyKeys[0],
            values: competencyKeys[0],
            title: `${metric.name} - ${this.assessmentQuestions[competencyKeys[0]].title || 'Competência'}`
          };
        }
        break;

      case 'table':
        // Configuração para tabela
        metric.fieldMapping = {
          title: 'Tabela de Resultados',
          showHeader: true,
          maxRows: 10
        };
        break;

      case 'text':
        // Configuração para resumo em texto
        metric.fieldMapping = {
          title: 'Resumo da Avaliação',
          text: 'Resumo estatístico dos resultados da avaliação.',
          valueField: Object.keys(this.assessmentQuestions)[0] || ''
        };
        break;

      case 'compare360':
        // Já configurado automaticamente pelo sistema
        metric.fieldMapping = {
          title: 'Comparativo 360°'
        };
        break;

      case 'radar360':
        // Já configurado automaticamente pelo sistema
        metric.fieldMapping = {
          title: 'Radar 360° de Competências'
        };
        break;

      case 'summary':
        // Já configurado automaticamente pelo sistema
        metric.fieldMapping = {
          title: 'Resumo da Avaliação'
        };
        break;
    }

    this.snackBar.open('Métrica configurada com sucesso', 'Fechar', { duration: 2000 });
  }

  togglePdfInclude(index: number, event: MatCheckboxChange): void {
    if (index >= 0 && index < this.metrics.length) {
      this.metrics[index].showInPdf = event.checked;
    }
  }

  removeMetric(index: number): void {
    this.metrics.splice(index, 1);
  }

  getMetricIcon(type: string): string {
    const icons: {[key: string]: string} = {
      'bar': 'bar_chart',
      'pie': 'pie_chart',
      'line': 'show_chart',
      'radar': 'radar',
      'ranking': 'format_list_numbered',
      'heatmap': 'grid_on',
      'text': 'text_fields',
      'table': 'table_chart',
      'compare360': 'compare_arrows',
      'radar360': 'radar',
      'summary': 'summarize'
    };

    return icons[type] || 'insert_chart';
  }

  formatColumnName(column: string): string {
    if (column.startsWith('pergunta_')) {
      const questionId = column.replace('pergunta_', '');
      if (this.assessmentQuestions[questionId]) {
        return this.assessmentQuestions[questionId].title || column;
      }
    }

    // Capitaliza e formata colunas padrão
    return column
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }

  formatCellValue(value: any): string {
    if (value === null || value === undefined) return '';

    if (typeof value === 'object') {
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      return JSON.stringify(value);
    }

    return String(value);
  }

  async exportToPdf(): Promise<void> {
    this.loading = true;

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      let currentY = 60; // Posição Y inicial após títulos

      // Adiciona cabeçalho
      const assessment = this.assessments.find(a => a.id === this.reportForm.get('assessmentId')?.value);
      pdf.setFontSize(18);
      pdf.text('Relatório de Avaliação 360°', pageWidth / 2, 20, { align: 'center' });

      pdf.setFontSize(14);
      pdf.text(`${assessment?.name || 'Avaliação não encontrada'}`, pageWidth / 2, 30, { align: 'center' });

      pdf.setFontSize(12);
      pdf.text(`Gerado em: ${new Date().toLocaleDateString()}`, pageWidth / 2, 40, { align: 'center' });

      // Adiciona tabela de resumo
      if (this.processedData?.summary) {
        pdf.setFontSize(14);
        pdf.text('Resumo da Avaliação por Competência', margin, currentY);
        currentY += 5;

        const tableData = this.processedData.summary.map((row: any) => [
          row.competencia,
          row.autoavaliacao || '-',
          row.gestor || '-',
          row.pares || '-',
          row.liderados || '-',
          row.resultado || '-'
        ]);

        pdf.setFontSize(10);
        const tableResult = (pdf as any).autoTable({
          head: [['Competência', 'Autoavaliação', 'Gestor', 'Pares', 'Liderados', 'Resultado']],
          body: tableData,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [66, 96, 158] },
          styles: { overflow: 'linebreak', cellWidth: 'auto' },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
        });

        // Atualiza a posição Y atual
        currentY = tableResult.finalY + 20;

        // Adiciona gráfico de radar 360° - usando canvas para converter para imagem
        const canvas = await this.captureChartAsCanvas('.radar360-chart');
        if (canvas) {
          pdf.addPage();
          currentY = 20; // Reset Y na nova página
          pdf.setFontSize(14);
          pdf.text('Radar 360° de Competências', margin, currentY);
          currentY += 5;
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, currentY, pageWidth - margin * 2, 100);
          currentY += 110; // Avança Y após o gráfico
        }

        // Adiciona gráficos de competências individuais
        for (const comp of this.competencies.slice(0, 5)) { // Limita a 5 competências por relatório
          if (currentY > pageHeight - 50) {
            pdf.addPage();
            currentY = 20; // Reset Y na nova página
          }

          pdf.setFontSize(12);
          pdf.text(`Competência: ${comp}`, margin, currentY);
          currentY += 10;

          // Aqui seria ideal capturar cada gráfico de competência
          // Para simplificar, vamos apenas adicionar uma tabela com os dados
          const compData = this.processedData.competencies[comp];
          if (compData) {
            const compRows = compData.map((d: any) => [d.name, d.value]);

            const tableResult = (pdf as any).autoTable({
              head: [['Avaliador', 'Nota']],
              body: compRows,
              startY: currentY,
              theme: 'grid',
              styles: { overflow: 'linebreak' }
            });

            currentY = tableResult.finalY + 15;
          }
        }
      }

      // Adiciona outras métricas configuradas para aparecer no PDF
      const pdfMetrics = this.metrics.filter(m => m.showInPdf);
      if (pdfMetrics.length > 0) {
        pdf.addPage();
        currentY = 20; // Reset Y na nova página
        pdf.setFontSize(14);
        pdf.text('Métricas Personalizadas', margin, currentY);
        currentY += 10;

        for (const metric of pdfMetrics) {
          if (currentY > pageHeight - 50) {
            pdf.addPage();
            currentY = 20; // Reset Y na nova página
          }

          pdf.setFontSize(12);
          pdf.text(metric.name, margin, currentY);
          currentY += 50; // Espaço para cada métrica
        }
      }

      // Salva o PDF
      pdf.save(`relatorio_${assessment?.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      this.snackBar.open('Erro ao gerar PDF', 'Fechar', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  async captureChartAsCanvas(selector: string): Promise<HTMLCanvasElement | null> {
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) return null;

    try {
      return await html2canvas(element, {
        scale: 2,
        allowTaint: true,
        useCORS: true
      });
    } catch (error) {
      console.error('Erro ao capturar imagem do gráfico:', error);
      return null;
    }
  }

  exportToExcel(): void {
    this.loading = true;

    try {
      // Prepara os dados para o Excel
      const tableData = this.assessmentDataService.processDataForTable(this.assessmentData);

      // Formata cabeçalhos para serem mais legíveis
      const headers = this.displayedColumns.map(col => this.formatColumnName(col));

      // Converte dados para formato de array para o Excel
      const excelData = tableData.map(row => {
        return this.displayedColumns.map(col => {
          const value = row[col];
          if (value instanceof Date) {
            return value.toLocaleDateString();
          }
          return value;
        });
      });

      // Cria uma planilha
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...excelData]);

      // Cria o workbook e adiciona a planilha
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados da Avaliação');

      // Adiciona planilha com resumo por competência
      if (this.processedData?.summary) {
        const summaryHeaders = ['Competência', 'Autoavaliação', 'Gestor', 'Pares', 'Liderados', 'Resultado'];
        const summaryData = this.processedData.summary.map((row: any) => [
          row.competencia,
          row.autoavaliacao || '',
          row.gestor || '',
          row.pares || '',
          row.liderados || '',
          row.resultado || ''
        ]);

        const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryData]);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo por Competência');
      }

      // Exporta o arquivo
      const assessment = this.assessments.find(a => a.id === this.reportForm.get('assessmentId')?.value);
      const fileName = `dados_${assessment?.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
      this.snackBar.open('Erro ao exportar dados para Excel', 'Fechar', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  saveReport(): void {
    if (this.reportForm.invalid) return;

    const report = {
      ...this.reportForm.value,
      metrics: this.metrics,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.loading = true;

    if (this.editMode && this.reportId) {
      // Atualiza o relatório existente
      this.subscriptions.add(
        this.reportsService.updateReport(this.reportId, report)
          .pipe(finalize(() => this.loading = false))
          .subscribe({
            next: () => {
              this.snackBar.open('Relatório atualizado com sucesso', 'Fechar', { duration: 3000 });
              this.router.navigate(['/reports']);
            },
            error: (error) => {
              console.error('Erro ao atualizar relatório:', error);
              this.snackBar.open('Erro ao atualizar relatório', 'Fechar', { duration: 3000 });
            }
          })
      );
    } else {
      // Cria um novo relatório
      this.subscriptions.add(
        this.reportsService.createReport(report)
          .pipe(finalize(() => this.loading = false))
          .subscribe({
            next: () => {
              this.snackBar.open('Relatório criado com sucesso', 'Fechar', { duration: 3000 });
              this.router.navigate(['/reports']);
            },
            error: (error) => {
              console.error('Erro ao criar relatório:', error);
              this.snackBar.open('Erro ao criar relatório', 'Fechar', { duration: 3000 });
            }
          })
      );
    }
  }

  cancel(): void {
    this.router.navigate(['/reports']);
  }
}
