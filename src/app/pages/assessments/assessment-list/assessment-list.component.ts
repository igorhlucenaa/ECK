import { MatDialog } from '@angular/material/dialog';
import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  Firestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { AssessmentPreviewComponent } from '../assessment-preview/assessment-preview.component';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-assessment-list',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  templateUrl: './assessment-list.component.html',
  styleUrls: ['./assessment-list.component.scss'],
})
export class AssessmentListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'createdBy', 'createdAt', 'actions'];
  dataSource = new MatTableDataSource<any>([]);
  searchValue: string = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private router: Router,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog // Injetar o MatDialog
  ) {}

  ngOnInit(): void {
    this.loadAssessments();
  }

  async loadAssessments(): Promise<void> {
    try {
      const assessmentsCollection = collection(this.firestore, 'assessments');
      const snapshot = await getDocs(assessmentsCollection);

      this.dataSource.data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      this.snackBar.open('Erro ao carregar avaliações.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value
      .trim()
      .toLowerCase();
    this.searchValue = filterValue;
    this.dataSource.filter = filterValue;

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  createNewAssessment(): void {
    this.router.navigate(['/assessments/new']);
  }

  editAssessment(id: string): void {
    this.router.navigate([`/assessments/${id}/edit`]);
  }

  async deleteAssessment(id: string): Promise<void> {
    try {
      const confirmDelete = confirm(
        'Tem certeza de que deseja excluir esta avaliação?'
      );
      if (!confirmDelete) return;

      const assessmentDocRef = doc(this.firestore, `assessments/${id}`);
      await deleteDoc(assessmentDocRef);

      this.dataSource.data = this.dataSource.data.filter(
        (item) => item.id !== id
      );
      this.snackBar.open('Avaliação excluída com sucesso.', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao excluir avaliação:', error);
      this.snackBar.open('Erro ao excluir avaliação.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  previewAssessment(assessment: any): void {
    this.dialog.open(AssessmentPreviewComponent, {
      width: '600px',
      data: assessment, // Passar os dados da avaliação selecionada para o modal
    });
  }
}
