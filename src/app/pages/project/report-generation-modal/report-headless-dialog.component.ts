import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ReportsComponent } from '../../reports/reports.component';
import { ComponentRef, ViewChild, ViewContainerRef } from '@angular/core';

interface ReportHeadlessData {
  assessmentId: string;
  participantId: string;
  participantName: string;
  templateId: string;
  competencyIds: string[];
}

@Component({
  selector: 'app-report-headless-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="display: none;">
      <ng-container #reportsContainer></ng-container>
    </div>
  `,
  styles: [`
    :host {
      display: none;
    }
  `]
})
export class ReportHeadlessDialogComponent implements OnInit, OnDestroy {
  @ViewChild('reportsContainer', { read: ViewContainerRef, static: true })
  reportsContainer!: ViewContainerRef;

  private reportsComponentRef?: ComponentRef<ReportsComponent>;

  constructor(
    public dialogRef: MatDialogRef<ReportHeadlessDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReportHeadlessData,
    private viewContainerRef: ViewContainerRef
  ) {}

  ngOnInit(): void {
    this.initializeReportsComponent();
  }

  ngOnDestroy(): void {
    if (this.reportsComponentRef) {
      this.reportsComponentRef.destroy();
    }
  }

  private async initializeReportsComponent(): Promise<void> {
    try {
      // Dynamically import and create the ReportsComponent
      const { ReportsComponent } = await import('../../reports/reports.component');

      // Create the component
      this.reportsComponentRef = this.reportsContainer.createComponent(ReportsComponent);

      // Set the data for the reports component
      if (this.reportsComponentRef.instance) {
        const instance = this.reportsComponentRef.instance;

        // Call the correct method to initialize and export the report
        if (instance['initializeAndExportFromExternalConfig'] && typeof instance['initializeAndExportFromExternalConfig'] === 'function') {
          await instance['initializeAndExportFromExternalConfig']({
            assessmentId: this.data.assessmentId,
            participantId: this.data.participantId,
            participantName: this.data.participantName,
            templateId: this.data.templateId,
            competencyIds: this.data.competencyIds,
            autoGenerate: true
          });
        }
      }

      // Close the dialog after a short delay to allow the report generation to complete
      setTimeout(() => {
        this.dialogRef.close();
      }, 1000);

    } catch (error) {
      console.error('Error initializing reports component:', error);
      this.dialogRef.close();
    }
  }
}
