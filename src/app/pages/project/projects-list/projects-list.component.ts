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
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { ConfirmDialogComponent } from '../../clients/clients-list/confirm-dialog/confirm-dialog.component';
import { EmailSelectionDialogComponent } from './email-selection-dialog/email-selection-dialog.component';
import { ResendAssessmentModalComponent } from '../resend-assessment-modal/resend-assessment-modal.component';
import { ParticipantsModalComponent } from '../participants-modal/participants-modal.component';
import { ParticipantsComponent } from '../../assessments/participants/participants.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule, AppPageHeaderComponent],
  templateUrl: './projects-list.component.html',
  styleUrls: ['./projects-list.component.scss'],
})
export class ProjectsListComponent implements OnInit {
  displayedColumns: string[] = [];
  private allProjects: any[] = [];
  dataSource = new MatTableDataSource<any>();
  searchValue: string = '';
  currentUser: any;
  clientId: any;
  clientsMap: { [key: string]: string } = {};
  clients: { id: string; name: string }[] = [];
  selectedClientId: string | null = null;
  isAdminMaster: boolean = false;
  userClientIds: string[] = [];
  today = new Date();
  loadingParticipantsProjectId: string | null = null;
  selectedProjectIds = new Set<string>();
  statusFilter: string = 'all';

  readonly STATUS_FILTERS = [
    { value: 'all',          label: 'Todos' },
    { value: 'Em andamento', label: 'Em andamento' },
    { value: 'Concluído',    label: 'Concluído' },
    { value: 'Cancelado',    label: 'Cancelado' },
  ];

  getInitial(name: string): string {
    return name?.charAt(0)?.toUpperCase() || 'P';
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'Em andamento': 'status-em-andamento',
      'Concluído':    'status-concluido',
      'Cancelado':    'status-cancelado',
      // legados
      'Ativo':        'status-em-andamento',
      'Inativo':      'status-cancelado',
    };
    return map[status] || 'status-em-andamento';
  }

  applyStatusFilter(value: string): void {
    this.statusFilter = value;
    this.dataSource.filter = this.statusFilter === 'all' ? (this.searchValue.trim().toLowerCase() || '') : '__status__';
    this._applyCustomFilter();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  private _applyCustomFilter(): void {
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const matchSearch = !this.searchValue || data.name.toLowerCase().includes(this.searchValue.trim().toLowerCase());
      const matchStatus = this.statusFilter === 'all' || data.status === this.statusFilter;
      return matchSearch && matchStatus;
    };
    // trigger re-filter
    this.dataSource.filter = this.dataSource.filter === '' ? ' ' : this.dataSource.filter.trim() || ' ';
    this.dataSource.filter = this.dataSource.filter.trim();
  }

  async cancelProject(projectId: string): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { message: this.translate.instant('Tem certeza de que deseja cancelar este projeto? Ele não aparecerá mais no Dashboard.') },
    });
    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      try {
        await updateDoc(doc(this.firestore, `projects/${projectId}`), { status: 'Cancelado' });
        this.dataSource.data = this.dataSource.data.map(p =>
          p.id === projectId ? { ...p, status: 'Cancelado' } : p
        );
        this.snackBar.open(this.translate.instant('Projeto cancelado com sucesso.'), this.translate.instant('Fechar'), { duration: 3000 });
      } catch (e) {
        this.snackBar.open(this.translate.instant('Erro ao cancelar projeto.'), this.translate.instant('Fechar'), { duration: 3000 });
      }
    });
  }

  isOverdue(deadline: Date | null): boolean {
    return !!deadline && deadline < this.today;
  }

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private router: Router,
    private dialog: MatDialog,
    private authService: AuthService,
    private location: Location,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.authService.getCurrentUser().then(async (user) => {
      this.isAdminMaster = user?.role === 'admin_master';
      this.userClientIds = await this.authService.getCurrentUserClientIds();
      this.clientId = this.userClientIds[0] || null;

      this.displayedColumns = [
        ...(this.isAdminMaster ? ['select'] : []),
        'client',
        'name',
        'deadline',
        'responses',
        'actions',
      ];

      if (this.isAdminMaster) {
        await this.loadClients();
      } else if (this.userClientIds.length > 0) {
        // admin_client: popula clientsMap apenas com os clientes vinculados
        await Promise.all(this.userClientIds.map(async (id) => {
          const snap = await getDoc(doc(this.firestore, 'clients', id));
          if (snap.exists()) this.clientsMap[id] = snap.data()['companyName'] || id;
        }));
      }
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
      this.snackBar.open(this.translate.instant('Erro ao carregar clientes.'), this.translate.instant('Fechar'), {
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
        snapshot.docs.map(async (projectDoc) => {
          const data = projectDoc.data();
          const deadline =
            data['deadline'] instanceof Timestamp
              ? data['deadline'].toDate()
              : null;

          const projectId = projectDoc.id;
          const [respondedCount, totalParticipants] =
            await this.countAssessmentResponses(projectId);

          // Auto-conclusão: se todos responderam, marcar como Concluído
          let currentStatus = data['status'];
          if (
            totalParticipants > 0 &&
            respondedCount >= totalParticipants &&
            !['Concluído', 'Cancelado'].includes(currentStatus)
          ) {
            const projectRef = doc(this.firestore, 'projects', projectId);
            await updateDoc(projectRef, { status: 'Concluído' });
            currentStatus = 'Concluído';
          }

          return {
            id: projectDoc.id,
            ...data,
            status: currentStatus,
            deadline: deadline,
            clientName:
              this.clientsMap[data['clientId']] || 'Cliente não encontrado',
            respondedCount: respondedCount || 0,
            totalParticipants: totalParticipants || 0,
            pendingCount: (totalParticipants || 0) - (respondedCount || 0),
          };
        })
      );

      this.allProjects = projects;
      this.dataSource.data = this.filterProjectsByClient(projects);
      this.dataSource.paginator = this.paginator;
      this._applyCustomFilter();

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
      this.snackBar.open(this.translate.instant('Erro ao carregar projetos.'), this.translate.instant('Fechar'), {
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
      return projects.filter((project) => project.clientId === this.selectedClientId);
    }
    if (!this.isAdminMaster && this.userClientIds.length > 0) {
      return projects.filter((project) => this.userClientIds.includes(project.clientId));
    }
    return projects;
  }

  onClientChange(): void {
    this.dataSource.data = this.filterProjectsByClient(this.allProjects);
    this._applyCustomFilter();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  applyFilter(event: Event): void {
    this.searchValue = (event.target as HTMLInputElement).value;
    this._applyCustomFilter();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  // ─── Seleção em massa ────────────────────────────────────────
  isAllProjectsSelected(): boolean {
    const visible = this.dataSource.filteredData;
    return visible.length > 0 && visible.every(p => this.selectedProjectIds.has(p.id));
  }

  isSomeProjectsSelected(): boolean {
    return this.dataSource.filteredData.some(p => this.selectedProjectIds.has(p.id));
  }

  toggleAllProjects(checked: boolean): void {
    if (checked) {
      this.dataSource.filteredData.forEach(p => this.selectedProjectIds.add(p.id));
    } else {
      this.dataSource.filteredData.forEach(p => this.selectedProjectIds.delete(p.id));
    }
  }

  toggleProjectSelect(id: string): void {
    if (this.selectedProjectIds.has(id)) {
      this.selectedProjectIds.delete(id);
    } else {
      this.selectedProjectIds.add(id);
    }
  }

  deleteSelectedProjects(): void {
    const count = this.selectedProjectIds.size;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { message: this.translate.instant(`Tem certeza de que deseja excluir ${count} projeto(s)? Esta ação não pode ser desfeita.`) },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      const ids = Array.from(this.selectedProjectIds);
      try {
        const batch = writeBatch(this.firestore);
        ids.forEach(id => batch.delete(doc(this.firestore, `projects/${id}`)));
        await batch.commit();
        this.dataSource.data = this.dataSource.data.filter(p => !this.selectedProjectIds.has(p.id));
        this.selectedProjectIds.clear();
        this.snackBar.open(this.translate.instant('Projetos excluídos com sucesso.'), this.translate.instant('Fechar'), { duration: 3000 });
      } catch (error) {
        console.error('Erro ao excluir projetos em massa:', error);
        this.snackBar.open(this.translate.instant('Erro ao excluir projetos. Tente novamente.'), this.translate.instant('Fechar'), { duration: 3000 });
      }
    });
  }

  deleteProject(projectId: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { message: this.translate.instant('Tem certeza de que deseja excluir este projeto?') },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        const projectDocRef = doc(this.firestore, `projects/${projectId}`);
        deleteDoc(projectDocRef)
          .then(() => {
            this.dataSource.data = this.dataSource.data.filter(
              (project) => project.id !== projectId
            );
            this.snackBar.open(this.translate.instant('Projeto excluído com sucesso.'), this.translate.instant('Fechar'), {
              duration: 3000,
            });
          })
          .catch((error) => {
            console.error('Erro ao excluir projeto:', error);
            this.snackBar.open(this.translate.instant('Erro ao excluir projeto. Tente novamente mais tarde.'), this.translate.instant('Fechar'), { duration: 3000 });
          });
      }
    });
  }

  openProjectForm(projectId?: string): void {
    if (!this.clientId && !this.isAdminMaster) {
      this.snackBar.open(this.translate.instant('Cliente não identificado. Contate o suporte.'), this.translate.instant('Fechar'), { duration: 3000 });
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

  goToProjectTemplates(clientId: string, projectId: string): void {
    this.router.navigate([`/projects/${clientId}/${projectId}/templates`]);
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
    this.loadingParticipantsProjectId = projectId;

    const dialogRef = this.dialog.open(ParticipantsComponent, {
      width: '95vw',
      maxWidth: '95vw',
      height: '90vh',
      panelClass: 'participants-fullscreen-dialog',
      data: {
        projectId: projectId,
        clientId: clientId,
      },
    });

    dialogRef.afterOpened().subscribe(() => {
      this.loadingParticipantsProjectId = null;
    });

    dialogRef.afterClosed().subscribe(() => {
      this.loadingParticipantsProjectId = null;
      this.loadProjects();
    });
  }
}
