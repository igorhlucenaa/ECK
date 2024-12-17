import { Component, OnInit, ViewChild } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './projects-list.component.html',
  styleUrls: ['./projects-list.component.scss'],
})
export class ProjectsListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'budget', 'deadline', 'actions'];
  dataSource = new MatTableDataSource<any>();
  searchValue: string = ''; // Campo de busca
  currentUser: any;
  clientId: any;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private router: Router,
    private dialog: MatDialog,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.getCurrentUserClientId().then((res) => {
      console.log(res);
      this.clientId = res;
      this.loadProjects();
    }); // Método que você vai criar
  }

  private async loadProjects(): Promise<void> {
    try {
      const projectsCollection = collection(this.firestore, 'projects');
      const projectsQuery = query(projectsCollection);

      const snapshot = await getDocs(projectsQuery);
      const projects = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log(projects);
      this.dataSource.data = projects;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;

      this.dataSource.filterPredicate = (data, filter) =>
        data.name.toLowerCase().includes(filter);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      this.snackBar.open('Erro ao carregar projetos.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.searchValue = filterValue;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  deleteProject(projectId: string): void {
    const projectDocRef = doc(this.firestore, `projects/${projectId}`);
    deleteDoc(projectDocRef)
      .then(() => {
        this.dataSource.data = this.dataSource.data.filter(
          (project) => project.id !== projectId
        );
        this.snackBar.open('Projeto excluído com sucesso.', 'Fechar', {
          duration: 3000,
        });
      })
      .catch((error) => {
        console.error('Erro ao excluir projeto:', error);
        this.snackBar.open(
          'Erro ao excluir projeto. Tente novamente mais tarde.',
          'Fechar',
          { duration: 3000 }
        );
      });
  }

  openProjectForm(projectId?: string): void {
    console.log(this.clientId);
    if (!this.clientId) {
      this.snackBar.open(
        'Cliente não identificado. Contate o suporte.',
        'Fechar',
        {
          duration: 3000,
        }
      );
      return;
    }

    if (projectId) {
      this.router.navigate([`/projects/${projectId}/edit`], {
        queryParams: { clientId: this.clientId },
      });
    } else {
      this.router.navigate(['/projects/new'], {
        queryParams: { clientId: this.clientId },
      });
    }
  }

  goToProjectUsers(projectId: string): void {
    this.router.navigate([`/projects/${projectId}/users`]);
  }

  goToProjectTemplates(projectId: string): void {
    this.router.navigate([`/projects/${projectId}/templates`]);
  }
}
