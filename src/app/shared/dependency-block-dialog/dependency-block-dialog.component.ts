import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { DependencyLink } from 'src/app/services/dependency-check.service';

export interface DependencyBlockData {
  /** Rótulo do registro pai (ex.: o cliente "Lojas NC"). */
  entityLabel: string;
  /** Vínculos que impedem a exclusão. */
  blockers: DependencyLink[];
}

@Component({
  selector: 'app-dependency-block-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, RouterModule],
  templateUrl: './dependency-block-dialog.component.html',
  styleUrls: ['./dependency-block-dialog.component.scss'],
})
export class DependencyBlockDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<DependencyBlockDialogComponent>,
    private router: Router,
    @Inject(MAT_DIALOG_DATA) public data: DependencyBlockData
  ) {}

  get totalBlockers(): number {
    return this.data.blockers.reduce((sum, b) => sum + b.count, 0);
  }

  get entityLabelCapitalized(): string {
    const s = this.data.entityLabel || '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  navegar(blocker: DependencyLink): void {
    if (!blocker.route) return;
    this.dialogRef.close();
    this.router.navigate([blocker.route], blocker.queryParams ? { queryParams: blocker.queryParams } : {});
  }
}
