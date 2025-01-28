import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  collection,
  query,
  getDocs,
  deleteDoc,
  doc,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-questionnaire-list',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './questionnaire-list.component.html',
  styleUrls: ['./questionnaire-list.component.scss'],
})
export class QuestionnaireListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'createdAt', 'actions'];
  dataSource = new MatTableDataSource<any>();
  projectId: string | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');
    if (this.projectId) {
      this.loadQuestionnaires();
    } else {
      this.snackBar.open('Projeto não encontrado.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  private async loadQuestionnaires(): Promise<void> {
    try {
      const questionnairesCollection = collection(
        this.firestore,
        `projects/${this.projectId}/questionnaires`
      );
      const snapshot = await getDocs(query(questionnairesCollection));

      const questionnaires = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log(questionnaires)

      this.dataSource.data = questionnaires;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;

      this.dataSource.filterPredicate = (data, filter) =>
        data.name.toLowerCase().includes(filter);
    } catch (error) {
      console.error('Erro ao carregar questionários:', error);
      this.snackBar.open('Erro ao carregar questionários.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  createQuestionnaire(): void {
    this.router.navigate([`/projects/${this.projectId}/questionnaires/new`]);
  }

  editQuestionnaire(questionnaireId: string): void {
    this.router.navigate([
      `/projects/${this.projectId}/questionnaires/${questionnaireId}/edit`,
    ]);
  }

  async deleteQuestionnaire(questionnaireId: string): Promise<void> {
    try {
      const questionnaireDocRef = doc(
        this.firestore,
        `projects/${this.projectId}/questionnaires/${questionnaireId}`
      );
      await deleteDoc(questionnaireDocRef);

      this.dataSource.data = this.dataSource.data.filter(
        (q) => q.id !== questionnaireId
      );

      this.snackBar.open('Questionário excluído com sucesso!', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao excluir questionário:', error);
      this.snackBar.open('Erro ao excluir questionário.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  previewQuestionnaire(questionnaireId: string): void {
    if (!this.projectId) {
      this.snackBar.open('Projeto não identificado.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    this.router.navigate([
      `/projects/${this.projectId}/questionnaires/${questionnaireId}/preview`,
    ]);
  }
}
