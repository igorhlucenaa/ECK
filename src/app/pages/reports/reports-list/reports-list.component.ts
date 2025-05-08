import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterModule } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ReportsService, Report } from '../services/reports.service';
import { MatConfirmDialogComponent } from '../../../shared/components/mat-confirm-dialog/mat-confirm-dialog.component';

@Component({
  selector: 'app-reports-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    RouterModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  template: `
    <div class="reports-container">
      <div class="header">
        <h1>Relatórios</h1>
        <button mat-raised-button color="primary" routerLink="/reports/new">
          <mat-icon>add</mat-icon>
          Novo Relatório
        </button>
      </div>

      <table mat-table [dataSource]="reports" class="reports-table">
        <!-- Nome -->
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Nome</th>
          <td mat-cell *matCellDef="let report">{{report.name}}</td>
        </ng-container>

        <!-- Data de Criação -->
        <ng-container matColumnDef="createdAt">
          <th mat-header-cell *matHeaderCellDef>Criado em</th>
          <td mat-cell *matCellDef="let report">{{report.createdAt | date:'dd/MM/yyyy HH:mm'}}</td>
        </ng-container>

        <!-- Data de Atualização -->
        <ng-container matColumnDef="updatedAt">
          <th mat-header-cell *matHeaderCellDef>Atualizado em</th>
          <td mat-cell *matCellDef="let report">{{report.updatedAt | date:'dd/MM/yyyy HH:mm'}}</td>
        </ng-container>

        <!-- Ações -->
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Ações</th>
          <td mat-cell *matCellDef="let report">
            <button mat-icon-button [matMenuTriggerFor]="menu">
              <mat-icon>more_vert</mat-icon>
            </button>
            <mat-menu #menu="matMenu">
              <button mat-menu-item (click)="editReport(report)">
                <mat-icon>edit</mat-icon>
                <span>Editar</span>
              </button>
              <button mat-menu-item (click)="exportReport(report)">
                <mat-icon>download</mat-icon>
                <span>Exportar</span>
              </button>
              <button mat-menu-item (click)="deleteReport(report)">
                <mat-icon>delete</mat-icon>
                <span>Excluir</span>
              </button>
            </mat-menu>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>
    </div>
  `,
  styles: [`
    .reports-container {
      padding: 24px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .reports-table {
      width: 100%;
    }

    .mat-column-actions {
      width: 80px;
      text-align: center;
    }
  `]
})
export class ReportsListComponent implements OnInit {
  reports: Report[] = [];
  displayedColumns: string[] = ['name', 'createdAt', 'updatedAt', 'actions'];

  constructor(
    private reportsService: ReportsService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadReports();
  }

  private loadReports() {
    this.reportsService.getReports().subscribe(
      reports => this.reports = reports,
      error => {
        console.error('Erro ao carregar relatórios:', error);
        this.snackBar.open('Erro ao carregar relatórios', 'Fechar', {
          duration: 3000
        });
      }
    );
  }

  editReport(report: Report) {
    this.router.navigate(['/reports', report.id, 'edit']);
  }

  exportReport(report: Report) {
    // TODO: Implementar lógica de exportação
    this.snackBar.open('Relatório exportado com sucesso!', 'Fechar', {
      duration: 3000
    });
  }

  async deleteReport(report: Report) {
    const dialogRef = this.dialog.open(MatConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirmar exclusão',
        message: `Tem certeza que deseja excluir o relatório "${report.name}"?`
      }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        try {
          await this.reportsService.deleteReport(report.id);
          this.snackBar.open('Relatório excluído com sucesso!', 'Fechar', {
            duration: 3000
          });
          this.loadReports();
        } catch (error) {
          console.error('Erro ao excluir relatório:', error);
          this.snackBar.open('Erro ao excluir relatório', 'Fechar', {
            duration: 3000
          });
        }
      }
    });
  }
}
