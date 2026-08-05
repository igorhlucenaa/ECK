import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { SurveyModel } from 'survey-core';
import { SurveyModule } from 'survey-angular-ui';
import { AssessmentPreviewPdfService } from 'src/app/services/assessment-preview-pdf.service';

export interface AssessmentPreviewDialogData {
  id?: string;
  name: string;
  description?: string;
  createdBy?: { name?: string };
  createdAt?: { toDate?: () => Date } | Date | string;
  surveyJSON?: unknown;
}

@Component({
  selector: 'app-assessment-preview',
  standalone: true,
  imports: [MaterialModule, CommonModule, SurveyModule],
  templateUrl: './assessment-preview.component.html',
  styleUrls: ['./assessment-preview.component.scss'],
})
export class AssessmentPreviewComponent implements OnInit {
  surveyModel: SurveyModel | null = null;
  isExportingPdf = false;
  private previousQuestionsOnPageMode: string | undefined;

  @ViewChild('pdfContent') pdfContentRef!: ElementRef<HTMLElement>;
  @ViewChild('previewBody') previewBodyRef!: ElementRef<HTMLElement>;

  constructor(
    public dialogRef: MatDialogRef<AssessmentPreviewComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AssessmentPreviewDialogData,
    private snackBar: MatSnackBar,
    private previewPdfService: AssessmentPreviewPdfService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    if (this.data.surveyJSON) {
      this.surveyModel = new SurveyModel(this.data.surveyJSON);
      this.surveyModel.locale = '';
      this.surveyModel.showCompletedPage = false;
      this.surveyModel.onComplete.add(() => this.dialogRef.close());
    }
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  get createdByName(): string {
    return this.data.createdBy?.name || '';
  }

  get createdAtLabel(): string {
    const value = this.data.createdAt;
    if (!value) return '';
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
      return value.toDate().toLocaleDateString('pt-BR');
    }
    if (value instanceof Date) {
      return value.toLocaleDateString('pt-BR');
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('pt-BR');
    }
    return '';
  }

  async downloadPdf(): Promise<void> {
    if (!this.surveyModel || !this.pdfContentRef?.nativeElement || this.isExportingPdf) {
      return;
    }

    this.isExportingPdf = true;
    this.dialogRef.disableClose = true;
    this.cdr.detectChanges();

    const bodyEl = this.previewBodyRef?.nativeElement;
    const previousMaxHeight = bodyEl?.style.maxHeight ?? '';
    const previousOverflow = bodyEl?.style.overflow ?? '';

    try {
      this.previousQuestionsOnPageMode = this.surveyModel.questionsOnPageMode;
      this.surveyModel.questionsOnPageMode = 'singlePage';
      this.surveyModel.currentPageNo = 0;

      if (bodyEl) {
        bodyEl.style.maxHeight = 'none';
        bodyEl.style.overflow = 'visible';
      }

      await new Promise(resolve => setTimeout(resolve, 350));

      const fileName = this.previewPdfService.sanitizeFileName(
        `${this.data.name || 'Formulario'}_Preview`
      );
      await this.previewPdfService.exportElementToPdf(
        this.pdfContentRef.nativeElement,
        fileName
      );

      this.snackBar.open(this.translate.instant('PDF do formulário baixado com sucesso.'), this.translate.instant('Fechar'), {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao exportar formulário em PDF:', error);
      this.snackBar.open(this.translate.instant('Erro ao gerar PDF do formulário.'), this.translate.instant('Fechar'), {
        duration: 4000,
      });
    } finally {
      if (this.surveyModel && this.previousQuestionsOnPageMode !== undefined) {
        this.surveyModel.questionsOnPageMode = this.previousQuestionsOnPageMode;
      }
      if (bodyEl) {
        bodyEl.style.maxHeight = previousMaxHeight;
        bodyEl.style.overflow = previousOverflow;
      }
      this.isExportingPdf = false;
      this.dialogRef.disableClose = false;
      this.cdr.detectChanges();
    }
  }
}
