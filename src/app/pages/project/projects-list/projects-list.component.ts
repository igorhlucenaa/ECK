import { Component, OnInit, ViewChild } from '@angular/core';
import {
  Firestore,
  Timestamp,
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
import { CommonModule, Location } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { ConfirmDialogComponent } from '../../clients/clients-list/confirm-dialog/confirm-dialog.component';
import { EmailSelectionDialogComponent } from './email-selection-dialog/email-selection-dialog.component';

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './projects-list.component.html',
  styleUrls: ['./projects-list.component.scss'],
})
export class ProjectsListComponent implements OnInit {
  displayedColumns: string[] = [
    'name',
    'client',
    // 'budget',
    'deadline',
    'actions',
  ];
  dataSource = new MatTableDataSource<any>();
  searchValue: string = ''; // Campo de busca
  currentUser: any;
  clientId: any;
  clientsMap: { [key: string]: string } = {}; // Mapeia clientId para clientName
  clients: { id: string; name: string }[] = []; // Lista de clientes para o filtro
  selectedClientId: string | null = null; // Cliente selecionado para filtro
  isAdminMaster: boolean = false; // Verifica se o usuário é admin_master

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private router: Router,
    private dialog: MatDialog,
    private authService: AuthService,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.authService.getCurrentUser().then((user) => {
      this.isAdminMaster = user?.role === 'admin_master';
      if (this.isAdminMaster) {
        this.loadClients();
      }
      this.clientId = user?.clientId;
      this.loadProjects();
    });
  }

  private async loadClients(): Promise<void> {
    try {
      const clientsCollection = collection(this.firestore, 'clients');
      const snapshot = await getDocs(clientsCollection);

      this.clients = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['companyName'] || 'Cliente Desconhecido',
      }));

      this.clients.forEach((client) => {
        this.clientsMap[client.id] = client.name;
      });
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open('Erro ao carregar clientes.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  private async loadProjects(): Promise<void> {
    try {
      const projectsCollection = collection(this.firestore, 'projects');
      const projectsQuery = query(projectsCollection);

      const snapshot = await getDocs(projectsQuery);
      const projects = snapshot.docs.map((doc) => {
        const data = doc.data();

        // Converte o campo deadline de Timestamp para Date, se necessário
        const deadline =
          data['deadline'] instanceof Timestamp
            ? data['deadline'].toDate()
            : null;

        return {
          id: doc.id,
          ...data,
          deadline: deadline, // Campo deadline agora é um Date ou null
          clientName:
            this.clientsMap[data['clientId']] || 'Cliente não encontrado',
        };
      });

      this.dataSource.data = this.filterProjectsByClient(projects);
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

  private filterProjectsByClient(projects: any[]): any[] {
    if (this.isAdminMaster && this.selectedClientId) {
      return projects.filter(
        (project) => project.clientId === this.selectedClientId
      );
    }
    return projects;
  }

  onClientChange(): void {
    this.loadProjects();
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
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { message: 'Tem certeza de que deseja excluir este projeto?' },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
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
    });
  }

  openProjectForm(projectId?: string): void {
    if (!this.clientId && !this.isAdminMaster) {
      this.snackBar.open(
        'Cliente não identificado. Contate o suporte.',
        'Fechar',
        {
          duration: 3000,
        }
      );
      return;
    }

    this.router.navigate(
      projectId ? [`/projects/${projectId}/edit`] : ['/projects/new'],
      { queryParams: { clientId: this.clientId } }
    );
  }

  goToProjectUsers(projectId: string): void {
    this.router.navigate([`/projects/${projectId}/users`]);
  }

  goToProjectTemplates(projectId: string): void {
    this.router.navigate([`/projects/${projectId}/templates`]);
  }

  goToProjectQuestionnaires(projectId: string): void {
    this.router.navigate([`/projects/${projectId}/questionnaires`]);
  }

  goBack(): void {
    this.location.back();
  }

  openEmailSelectionModal(projectId: string): void {
    this.dialog.open(EmailSelectionDialogComponent, {
      width: '900px',
      data: { projectId },
    });
  }
}
