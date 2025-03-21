import { Component, OnInit, ViewChild } from '@angular/core';
import {
  Firestore,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
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
import { ResendAssessmentModalComponent } from '../resend-assessment-modal/resend-assessment-modal.component';
import { ParticipantsModalComponent } from '../participants-modal/participants-modal.component';
import { ParticipantsComponent } from '../../assessments/participants/participants.component';

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './projects-list.component.html',
  styleUrls: ['./projects-list.component.scss'],
})
export class ProjectsListComponent implements OnInit {
  displayedColumns: string[] = [
    'client',
    'name',
    'deadline',
    'responses',
    'actions',
  ];
  dataSource = new MatTableDataSource<any>();
  searchValue: string = '';
  currentUser: any;
  clientId: any;
  clientsMap: { [key: string]: string } = {};
  clients: { id: string; name: string }[] = [];
  selectedClientId: string | null = null;
  isAdminMaster: boolean = false;

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
      const projects = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          const deadline =
            data['deadline'] instanceof Timestamp
              ? data['deadline'].toDate()
              : null;

          const projectId = doc.id;
          const [respondedCount, totalParticipants] =
            await this.countAssessmentResponses(projectId);

          return {
            id: doc.id,
            ...data,
            deadline: deadline,
            clientName:
              this.clientsMap[data['clientId']] || 'Cliente não encontrado',
            respondedCount: respondedCount || 0,
            totalParticipants: totalParticipants || 0,
            pendingCount: (totalParticipants || 0) - (respondedCount || 0),
          };
        })
      );

      this.dataSource.data = this.filterProjectsByClient(projects);
      this.dataSource.paginator = this.paginator;

      this.dataSource.sortingDataAccessor = (item, property) => {
        switch (property) {
          case 'client':
            return item.clientName.toLowerCase();
          case 'name':
            return item.name.toLowerCase();
          case 'deadline':
            return item.deadline ? item.deadline.getTime() : 0;
          case 'responses':
            return item.respondedCount;
          default:
            return item[property];
        }
      };
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

  private async countAssessmentResponses(
    projectId: string
  ): Promise<[number, number]> {
    try {
      // Passo 1: Obter o clientId do projeto
      const projectRef = doc(this.firestore, 'projects', projectId);
      const projectSnapshot = await getDoc(projectRef);
      if (!projectSnapshot.exists()) {
        console.warn(`Projeto ${projectId} não encontrado.`);
        return [0, 0];
      }
      const projectData = projectSnapshot.data();
      const clientId = projectData['clientId'];
      if (!clientId) {
        console.warn(`Projeto ${projectId} não tem clientId associado.`);
        return [0, 0];
      }

      // Passo 2: Obter todos os assessments associados ao clientId
      const assessmentsQuery = query(
        collection(this.firestore, 'assessments'),
        where('clientId', '==', clientId)
      );
      const assessmentsSnapshot = await getDocs(assessmentsQuery);
      const assessmentIds = assessmentsSnapshot.docs.map((doc) => doc.id);
      if (assessmentIds.length === 0) {
        console.warn(
          `Nenhum assessment encontrado para o clientId ${clientId}.`
        );
        return [0, 0];
      }

      // Passo 3: Contar todos os participantes do projeto
      const participantsQuery = query(
        collection(this.firestore, 'participants'),
        where('projectId', '==', projectId)
      );
      const participantsSnapshot = await getDocs(participantsQuery);
      const totalParticipants = participantsSnapshot.docs.length;
      console.log(
        `Projeto ${projectId} - Total de participantes: ${totalParticipants}`
      );

      // Passo 4: Contar respostas completadas em assessmentLinks
      let respondedCount = 0;
      const participantIds = participantsSnapshot.docs.map((doc) => doc.id);

      if (participantIds.length > 0 && assessmentIds.length > 0) {
        // Dividir os assessmentIds em lotes de 10 (limite do Firestore para cláusula 'in')
        const batchSize = 10;
        const completedParticipants = new Set<string>(); // Para evitar contar o mesmo participante mais de uma vez

        for (let i = 0; i < assessmentIds.length; i += batchSize) {
          const assessmentBatch = assessmentIds.slice(i, i + batchSize);
          const assessmentLinksQuery = query(
            collection(this.firestore, 'assessmentLinks'),
            where('participantId', 'in', participantIds),
            where('assessmentId', 'in', assessmentBatch)
          );
          const linksSnapshot = await getDocs(assessmentLinksQuery);

          linksSnapshot.docs.forEach((doc) => {
            const linkData = doc.data();
            if (linkData['status'] === 'completed') {
              completedParticipants.add(linkData['participantId']);
            }
          });
        }

        respondedCount = completedParticipants.size;
      }

      console.log(
        `Projeto ${projectId} - Respostas completadas: ${respondedCount}`
      );
      return [respondedCount, totalParticipants];
    } catch (error) {
      console.error('Erro ao contar respostas da avaliação:', error);
      return [0, 0];
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
        { duration: 3000 }
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
    this.router.navigate([`/projects/assessments/${projectId}`]);
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

  openResendModal(projectId: string, clientId: string): void {
    const dialogRef = this.dialog.open(ParticipantsComponent, {
      width: '80%',
      data: {
        projectId: projectId,
        clientId: clientId,
      },
    });

    dialogRef.afterClosed().subscribe(() => {
      this.loadProjects();
    });
  }
}
