import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-evaluators-modal',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  template: `
    <h1 mat-dialog-title>Avaliadores de {{ data.evaluatee.name }}</h1>
    <div mat-dialog-content>
      <table
        mat-table
        [dataSource]="data.evaluators"
        class="w-100 mat-elevation-z8"
      >
        <!-- Nome -->
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef style="font-weight: bold;">Nome</th>
          <td mat-cell *matCellDef="let evaluator">{{ evaluator.name }}</td>
        </ng-container>

        <!-- E-mail -->
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef style="font-weight: bold;">Email</th>
          <td mat-cell *matCellDef="let evaluator">{{ evaluator.email }}</td>
        </ng-container>

        <!-- Categoria -->
        <ng-container matColumnDef="category">
          <th mat-header-cell *matHeaderCellDef style="font-weight: bold;">Categoria</th>
          <td mat-cell *matCellDef="let evaluator">{{ evaluator.category }}</td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
      </table>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Fechar</button>
    </div>
  `,
})
export class EvaluatorsModalComponent {
  displayedColumns: string[] = ['name', 'email', 'category'];

  constructor(
    public dialogRef: MatDialogRef<EvaluatorsModalComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: { evaluatee: any; evaluators: any[] }
  ) {}
}
