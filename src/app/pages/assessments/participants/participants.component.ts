import { Component, OnInit, ViewChild } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  where,
  addDoc,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import * as XLSX from 'xlsx';
import { MatDialog } from '@angular/material/dialog';
import { FormBuilder, Validators } from '@angular/forms';
import { ParticipantsConfirmationDialogComponent } from './participants-confirmation-dialog/participants-confirmation-dialog.component';
import { AddParticipantModalComponent } from '../../project/add-participant-modal/add-participant-modal.component';

interface UnifiedParticipant {
  id: string;
  name: string;
  email: string;
  assessmentId?: string;
  sentAt?: Date;
  completedAt?: Date;
  status?: string;
  category: string;
  type: 'avaliado' | 'avaliador';
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  selected?: boolean;
}

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  clientId: string;
}

interface MailTemplate {
  id: string;
  name: string;
  content: string;
  emailType: string;
  subject: string;
  clientId: string;
}

interface Assessment {
  id: string;
  name: string;
}

@Component({
  selector: 'app-participants',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="container mt-4">
      <h2>Lista de Participantes</h2>

      <!-- Botões de Upload/Download e Adicionar Participante -->
      <div class="d-flex justify-content-between mb-3">
        <div>
          <!-- Botão Baixar Planilha -->
          <button
            mat-raised-button
            color="primary"
            (click)="downloadTemplate()"
            style="margin-right: 10px"
          >
            <mat-icon>download</mat-icon> Baixar Planilha de Modelo
          </button>

          <!-- Botão Upload -->
          <button mat-raised-button color="accent" style="margin-right: 10px">
            <label for="uploadExcel" class="btn btn-secondary">
              <mat-icon>upload_file</mat-icon> Carregar Arquivo Excel
            </label>
            <input
              id="uploadExcel"
              type="file"
              accept=".xlsx, .xls"
              style="display: none"
              (change)="uploadExcel($event)"
            />
          </button>
          <!-- Botão Adicionar Novo Participante -->
          <button
            mat-flat-button
            color="primary"
            (click)="openAddParticipantModal()"
          >
            Adicionar Novo Participante
          </button>
        </div>
      </div>

      <div class="row mb-4" style="margin-top: 40px">
        <div class="col-md-12">
          <mat-form-field class="w-100" appearance="outline">
            <mat-label>Buscar por Nome ou E-mail</mat-label>
            <input
              matInput
              [(ngModel)]="searchValue"
              (ngModelChange)="applyFilter()"
            />
            <button
              mat-icon-button
              matSuffix
              *ngIf="searchValue"
              (click)="searchValue = ''; applyFilter()"
            >
              <mat-icon>close</mat-icon>
            </button>
          </mat-form-field>
        </div>
        <!-- Filtro por Cliente -->
        <div class="col-md-3">
          <mat-form-field class="w-100" appearance="outline">
            <mat-label>Selecione o Cliente</mat-label>
            <mat-select
              [(ngModel)]="filterClient"
              (ngModelChange)="onClientChange()"
            >
              <mat-option value="">Todos</mat-option>
              <mat-option *ngFor="let client of clients" [value]="client.id">
                {{ client.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Filtro por Projeto -->
        <div class="col-md-3">
          <mat-form-field class="w-100" appearance="outline">
            <mat-label>Selecione o Projeto</mat-label>
            <mat-select
              [(ngModel)]="filterProject"
              (ngModelChange)="onProjectChange()"
              [disabled]="!filterClient"
            >
              <mat-option value="">Todos</mat-option>
              <mat-option
                *ngFor="let project of filteredProjects"
                [value]="project.id"
              >
                {{ project.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Campo de Seleção de Template -->
        <div class="col-md-3">
          <mat-form-field class="w-100" appearance="outline">
            <mat-label>Selecione um Template de E-mail</mat-label>
            <mat-select
              [formControl]="templateFormControl"
              required
              (ngModelChange)="onTemplateChange()"
            >
              <mat-option
                *ngFor="let template of mailTemplates"
                [value]="template.id"
              >
                {{ template.name }} -
                <strong>{{ getFriendlyEmailType(template.emailType) }}</strong>
              </mat-option>
            </mat-select>
            <mat-error *ngIf="templateFormControl.hasError('required')">
              Por favor, selecione um template.
            </mat-error>
          </mat-form-field>
        </div>

        <!-- Campo de Seleção de Avaliação -->
        <div class="col-md-3">
          <mat-form-field class="w-100" appearance="outline">
            <mat-label>Selecione um Formulário de Avaliação</mat-label>
            <mat-select [formControl]="assessmentFormControl" required>
              <mat-option
                *ngFor="let assessment of assessments"
                [value]="assessment.id"
              >
                {{ assessment.name }}
              </mat-option>
            </mat-select>
            <mat-error *ngIf="assessmentFormControl.hasError('required')">
              Por favor, selecione uma avaliação.
            </mat-error>
          </mat-form-field>
        </div>
      </div>

      <hr style="border: 1px solid #ccc; margin-bottom:40px" />

      <!-- Filtros -->
      <div class="row mb-4" style="margin-top: 40px">
        <!-- Campo de Pesquisa -->

        <!-- Filtro por Tipo -->
        <div class="col-md-4">
          <mat-form-field class="w-100" appearance="outline">
            <mat-label>Filtrar por Tipo</mat-label>
            <mat-select
              [(ngModel)]="filterType"
              (ngModelChange)="applyFilter()"
            >
              <mat-option value="">Todos</mat-option>
              <mat-option value="avaliado">Avaliado</mat-option>
              <mat-option value="avaliador">Avaliador</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Filtro por Categoria -->
        <div class="col-md-4">
          <mat-form-field class="w-100" appearance="outline">
            <mat-label>Filtrar por Categoria</mat-label>
            <mat-select
              [(ngModel)]="filterCategory"
              (ngModelChange)="applyFilter()"
            >
              <mat-option value="">Todos</mat-option>
              <mat-option value="Avaliado">Avaliado</mat-option>
              <mat-option value="Gestor">Gestor</mat-option>
              <mat-option value="Par">Par</mat-option>
              <mat-option value="Subordinado">Subordinado</mat-option>
              <mat-option value="Outros">Outros</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="col-md-4">
          <mat-form-field class="w-100" appearance="outline">
            <mat-label>Filtrar por Status</mat-label>
            <mat-select
              [(ngModel)]="filterStatus"
              (ngModelChange)="applyFilter()"
            >
              <mat-option value="">Todos</mat-option>
              <mat-option value="Não Enviado">Não Enviado</mat-option>
              <mat-option value="Enviado (Pendente)"
                >Enviado (Pendente)</mat-option
              >
              <mat-option value="Respondido">Respondido</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </div>

      <!-- Mensagem quando não há participantes -->
      <div *ngIf="dataSource.data.length === 0" class="text-center my-4">
        <p>Nenhum participante encontrado.</p>
      </div>

      <!-- Tabela de Participantes -->
      <div class="table-responsive" *ngIf="dataSource.data.length > 0">
        <table
          mat-table
          [dataSource]="dataSource"
          matSort
          class="mat-elevation-z8 w-100"
        >
          <!-- Checkbox para Seleção -->
          <ng-container matColumnDef="select">
            <th mat-header-cell *matHeaderCellDef>
              <mat-checkbox
                (change)="toggleAll($event.checked)"
                [checked]="allSelected()"
                [indeterminate]="someSelected() && !allSelected()"
              ></mat-checkbox>
            </th>
            <td mat-cell *matCellDef="let participant">
              <mat-checkbox
                [(ngModel)]="participant.selected"
                (ngModelChange)="updateSelection()"
                [disabled]="
                  participant.completedAt != null ||
                  (selectedTemplate?.emailType === 'conviteAvaliador' ||
                  selectedTemplate?.emailType === 'lembreteAvaliador'
                    ? participant.type !== 'avaliador'
                    : selectedTemplate?.emailType === 'cadastro'
                    ? false
                    : participant.type !== 'avaliado')
                "
              ></mat-checkbox>
            </td>
          </ng-container>

          <!-- Nome -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Nome</th>
            <td mat-cell *matCellDef="let participant">
              {{ participant.name }}
            </td>
          </ng-container>

          <!-- E-mail -->
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>E-mail</th>
            <td mat-cell *matCellDef="let participant">
              {{ participant.email }}
            </td>
          </ng-container>

          <!-- Tipo -->
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Tipo</th>
            <td mat-cell *matCellDef="let participant">
              {{ participant.type }}
            </td>
          </ng-container>

          <!-- Categoria -->
          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Categoria</th>
            <td mat-cell *matCellDef="let participant">
              {{ participant.category }}
            </td>
          </ng-container>

          <!-- Projeto -->
          <ng-container matColumnDef="projectName">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Projeto</th>
            <td mat-cell *matCellDef="let participant">
              {{ participant.projectName || 'N/A' }}
            </td>
          </ng-container>

          <!-- Cliente -->
          <ng-container matColumnDef="clientName">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Cliente</th>
            <td mat-cell *matCellDef="let participant">
              {{ participant.clientName || 'N/A' }}
            </td>
          </ng-container>

          <!-- Status -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
            <td mat-cell *matCellDef="let participant">
              {{ participant.status || 'N/A' }}
            </td>
          </ng-container>

          <!-- Data de Envio -->
          <ng-container matColumnDef="sentAt">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              Data de Envio
            </th>
            <td mat-cell *matCellDef="let participant">
              {{ participant.sentAt | date : 'short' }}
            </td>
          </ng-container>

          <!-- Data de Resposta -->
          <ng-container matColumnDef="completedAt">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              Data de Resposta
            </th>
            <td mat-cell *matCellDef="let participant">
              {{ participant.completedAt | date : 'short' }}
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
      </div>

      <!-- Paginação -->
      <mat-paginator
        *ngIf="dataSource.data.length > 0"
        [pageSize]="10"
        [pageSizeOptions]="[5, 10, 20, 50]"
        showFirstLastButtons
      ></mat-paginator>

      <!-- Botão Enviar Links -->
      <div class="mt-3 text-end" *ngIf="dataSource.data.length > 0">
        <button
          mat-button
          (click)="resendLinks()"
          [disabled]="
            isLoading ||
            selectedParticipants.length === 0 ||
            !templateFormControl.valid ||
            !assessmentFormControl.valid
          "
        >
          <mat-spinner *ngIf="isLoading" [diameter]="20"></mat-spinner>
          <span *ngIf="isLoading">Enviando...</span>
          <span *ngIf="!isLoading">Enviar Links</span>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./participants.component.scss'],
})
export class ParticipantsComponent implements OnInit {
  displayedColumns: string[] = [
    'select',
    'clientName',
    'projectName',
    'name',
    'email',
    'type',
    'category',
    'status',
    'sentAt',
    'completedAt',
  ];

  dataSource = new MatTableDataSource<UnifiedParticipant>([]);
  searchValue: string = '';
  filterType: string = '';
  filterCategory: string = '';
  filterStatus: string = '';
  filterClient: string = '';
  filterProject: string = '';
  clients: Client[] = [];
  projects: Project[] = [];
  filteredProjects: Project[] = [];
  mailTemplates: MailTemplate[] = [];
  assessments: Assessment[] = [];
  selectedParticipants: UnifiedParticipant[] = [];
  isLoading: boolean = false;
  templateFormControl = this.fb.control('', Validators.required);
  assessmentFormControl = this.fb.control('', Validators.required);
  selectedTemplate: MailTemplate | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private fb: FormBuilder
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.loadClients(),
      this.loadProjects(),
      this.loadParticipants(),
    ]);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    this.dataSource.filterPredicate = (
      data: UnifiedParticipant,
      filter: string
    ) => {
      const searchStr =
        `${data.name} ${data.email} ${data.projectName} ${data.clientName}`.toLowerCase();
      const typeMatch = !this.filterType || data.type === this.filterType;
      const categoryMatch =
        !this.filterCategory || data.category === this.filterCategory;
      const statusMatch =
        !this.filterStatus || data.status === this.filterStatus;
      const clientMatch =
        !this.filterClient || data.clientId === this.filterClient;
      const projectMatch =
        !this.filterProject || data.projectId === this.filterProject;
      const emailTypeMatch = this.applyEmailTypeFilter(data);
      return (
        searchStr.includes(this.searchValue.trim().toLowerCase()) &&
        typeMatch &&
        categoryMatch &&
        statusMatch &&
        clientMatch &&
        projectMatch &&
        emailTypeMatch
      );
    };
  }

  applyEmailTypeFilter(data: UnifiedParticipant): boolean {
    if (!this.selectedTemplate) return true;
    const emailType = this.selectedTemplate.emailType;
    if (emailType === 'cadastro') return true;
    if (['conviteAvaliador', 'lembreteAvaliador'].includes(emailType)) {
      return data.type === 'avaliador';
    }
    if (
      [
        'conviteRespondente',
        'lembreteRespondente',
        'convite',
        'lembrete',
      ].includes(emailType)
    ) {
      return data.type === 'avaliado';
    }
    return true;
  }

  async loadClients(): Promise<void> {
    try {
      const clientsCollection = collection(this.firestore, 'clients');
      const snapshot = await getDocs(clientsCollection);

      this.clients = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['companyName'] || 'Cliente Sem Nome',
      }));
      console.log('Clientes carregados:', this.clients);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open('Erro ao carregar clientes.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadProjects(): Promise<void> {
    try {
      const projectsCollection = collection(this.firestore, 'projects');
      const snapshot = await getDocs(projectsCollection);

      this.projects = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Projeto Sem Nome',
        clientId: doc.data()['clientId'] || '',
      }));
      this.filteredProjects = [...this.projects];
      console.log('Projetos carregados:', this.projects);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      this.snackBar.open('Erro ao carregar projetos.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadParticipants(): Promise<void> {
    try {
      const participantsCollection = collection(this.firestore, 'participants');
      const participantsSnapshot = await getDocs(participantsCollection);

      console.log(
        'Snapshot de participantes (todos):',
        participantsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );

      if (participantsSnapshot.empty) {
        console.log('Nenhum participante encontrado no Firestore.');
        this.dataSource.data = [];
        return;
      }

      const projectIds = new Set<string>();
      participantsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data['projectId']) projectIds.add(data['projectId']);
      });

      const projectsMap: { [key: string]: { name: string; clientId: string } } =
        {};
      if (projectIds.size > 0) {
        const projectsPromises = Array.from(projectIds).map(
          async (projectId) => {
            const projectDoc = doc(this.firestore, 'projects', projectId);
            const projectSnapshot = await getDoc(projectDoc);
            if (projectSnapshot.exists()) {
              projectsMap[projectId] = {
                name: projectSnapshot.data()['name'] || 'Projeto Sem Nome',
                clientId: projectSnapshot.data()['clientId'] || '',
              };
            } else {
              projectsMap[projectId] = { name: 'N/A', clientId: '' };
            }
          }
        );
        await Promise.all(projectsPromises);
      }

      const clientIds = new Set<string>();
      participantsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data['clientId']) clientIds.add(data['clientId']);
      });
      Object.values(projectsMap).forEach((project) => {
        if (project.clientId) clientIds.add(project.clientId);
      });

      const clientsMap: { [key: string]: string } = {};
      if (clientIds.size > 0) {
        const clientsPromises = Array.from(clientIds).map(async (clientId) => {
          const clientDoc = doc(this.firestore, 'clients', clientId);
          const clientSnapshot = await getDoc(clientDoc);
          if (clientSnapshot.exists()) {
            clientsMap[clientId] =
              clientSnapshot.data()['companyName'] || 'Cliente Sem Nome';
          } else {
            clientsMap[clientId] = 'N/A';
          }
        });
        await Promise.all(clientsPromises);
      }

      const participants: UnifiedParticipant[] = [];
      for (const doc of participantsSnapshot.docs) {
        const participantId = doc.id;
        const participantData = doc.data();
        const projectId = participantData['projectId'] || '';
        let clientId = participantData['clientId'] || '';

        if (!clientId && projectId && projectsMap[projectId]) {
          clientId = projectsMap[projectId].clientId;
        }

        const email = participantData['email'] || 'Sem e-mail';
        const type = participantData['type'] as 'avaliado' | 'avaliador';
        const category = participantData['category'] || 'N/A';
        const assessments = participantData['assessments'] || [];

        let sentAt: Date | undefined;
        let completedAt: Date | undefined;
        let status: string = 'Não Enviado';

        if (type === 'avaliado' && assessments.length > 0) {
          const assessmentLinksQuery = query(
            collection(this.firestore, 'assessmentLinks'),
            where('participantId', '==', participantId),
            where('assessmentId', 'in', assessments)
          );
          const linksSnapshot = await getDocs(assessmentLinksQuery);

          linksSnapshot.docs.forEach((linkDoc) => {
            const linkData = linkDoc.data();
            if (linkData['sentAt']) {
              sentAt = (linkData['sentAt'] as Timestamp).toDate();
            }
            if (linkData['status'] === 'completed' && linkData['completedAt']) {
              completedAt = (linkData['completedAt'] as Timestamp).toDate();
            }
          });

          status = this.determineStatus(sentAt, completedAt);
        } else {
          status = type === 'avaliado' ? 'Não Enviado' : 'N/A';
        }

        if (clientId) {
          participants.push({
            id: participantId,
            name: participantData['name'] || 'Desconhecido',
            email: email,
            assessmentId: assessments.length > 0 ? assessments[0] : undefined,
            sentAt: sentAt,
            completedAt: completedAt,
            status: status,
            category: category,
            type: type,
            projectId: projectId,
            projectName: projectsMap[projectId]?.name || 'N/A',
            clientId: clientId,
            clientName: clientsMap[clientId] || 'N/A',
            selected: false,
          });
        } else {
          console.warn(
            `Participante ${participantId} ignorado: não foi possível determinar o clientId.`,
            participantData
          );
        }
      }

      this.dataSource.data = participants;
      console.log('Participantes carregados (todos):', participants);
    } catch (error) {
      console.error('Erro ao carregar participantes:', error);
      this.snackBar.open('Erro ao carregar participantes.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadMailTemplates(): Promise<void> {
    try {
      if (!this.filterClient) {
        this.mailTemplates = [];
        this.templateFormControl.setValue('');
        return;
      }

      const templatesCollection = collection(this.firestore, 'mailTemplates');
      const templatesQuery = query(
        templatesCollection,
        where('clientId', '==', this.filterClient)
      );
      const snapshot = await getDocs(templatesQuery);

      this.mailTemplates = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Sem Nome',
        content: doc.data()['content'] || '',
        emailType: doc.data()['emailType'] || '',
        subject: doc.data()['subject'] || '',
        clientId: doc.data()['clientId'] || '',
      }));

      console.log('Templates carregados:', this.mailTemplates);

      if (this.mailTemplates.length === 0) {
        this.snackBar.open(
          'Nenhum template encontrado para este cliente.',
          'Fechar',
          { duration: 3000 }
        );
      }
    } catch (error) {
      console.error('Erro ao carregar Modelos de e-mail:', error);
      this.snackBar.open('Erro ao carregar Modelos de e-mail.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadAssessments(): Promise<void> {
    try {
      if (!this.filterClient) {
        this.assessments = [];
        this.assessmentFormControl.setValue('');
        return;
      }

      const assessmentsCollection = collection(this.firestore, 'assessments');
      const assessmentsQuery = query(
        assessmentsCollection,
        where('clientId', '==', this.filterClient)
      );
      const snapshot = await getDocs(assessmentsQuery);

      this.assessments = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Avaliação Sem Nome',
      }));

      console.log('Avaliações carregadas:', this.assessments);

      if (this.assessments.length === 0) {
        this.snackBar.open(
          'Nenhuma avaliação encontrada para este cliente.',
          'Fechar',
          { duration: 3000 }
        );
      }
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      this.snackBar.open('Erro ao carregar avaliações.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  determineStatus(sentAt?: Date, completedAt?: Date): string {
    if (completedAt) return 'Respondido';
    if (sentAt) return 'Enviado (Pendente)';
    return 'Não Enviado';
  }

  onClientChange(): void {
    this.filterProject = '';
    this.templateFormControl.setValue('');
    this.assessmentFormControl.setValue('');
    this.mailTemplates = [];
    this.assessments = [];
    if (this.filterClient) {
      this.filteredProjects = this.projects.filter(
        (project) => project.clientId === this.filterClient
      );
      this.loadMailTemplates();
      this.loadAssessments();
    } else {
      this.filteredProjects = [...this.projects];
    }
    this.applyFilter();
  }

  onProjectChange(): void {
    this.applyFilter();
  }

  onTemplateChange(): void {
    this.selectedTemplate =
      this.mailTemplates.find((t) => t.id === this.templateFormControl.value) ||
      null;
    this.applyFilter();
    this.updateSelection();
  }

  applyFilter(): void {
    this.dataSource.filter = 'apply';
  }

  toggleAll(checked: boolean): void {
    this.dataSource.data.forEach((participant) => {
      if (!participant.completedAt && this.applyEmailTypeFilter(participant)) {
        participant.selected = checked;
      }
    });
    this.updateSelection();
  }

  updateSelection(): void {
    this.selectedParticipants = this.dataSource.data.filter(
      (p) => p.selected && this.applyEmailTypeFilter(p) && !p.completedAt
    );
  }

  allSelected(): boolean {
    const eligibleParticipants = this.dataSource.data.filter(
      (p) => this.applyEmailTypeFilter(p) && !p.completedAt
    );
    return (
      eligibleParticipants.length > 0 &&
      eligibleParticipants.every((p) => p.selected)
    );
  }

  someSelected(): boolean {
    const eligibleParticipants = this.dataSource.data.filter(
      (p) => this.applyEmailTypeFilter(p) && !p.completedAt
    );
    return eligibleParticipants.some((p) => p.selected) && !this.allSelected();
  }

  async resendLinks(): Promise<void> {
    this.isLoading = true;
    try {
      const selectedTemplateId = this.templateFormControl.value;
      const selectedAssessmentId = this.assessmentFormControl.value;
      if (!selectedTemplateId) {
        this.snackBar.open(
          'Por favor, selecione um template antes de enviar.',
          'Fechar',
          { duration: 3000 }
        );
        this.isLoading = false;
        return;
      }

      if (!selectedAssessmentId) {
        this.snackBar.open(
          'Por favor, selecione uma avaliação antes de enviar.',
          'Fechar',
          { duration: 3000 }
        );
        this.isLoading = false;
        return;
      }

      const template = this.mailTemplates.find(
        (t) => t.id === selectedTemplateId
      );
      if (!template) {
        this.snackBar.open('Template selecionado não encontrado.', 'Fechar', {
          duration: 3000,
        });
        this.isLoading = false;
        return;
      }

      const templateRef = doc(
        this.firestore,
        'mailTemplates',
        selectedTemplateId
      );
      const templateDoc = await getDoc(templateRef);
      if (!templateDoc.exists()) {
        throw new Error('Template não encontrado.');
      }

      let templateContent = templateDoc.data()['content'] || '';
      const originalContent = templateContent;

      let contentObj;
      try {
        contentObj = JSON.parse(templateContent);
      } catch (error) {
        throw new Error('Erro ao parsear o conteúdo do template: ' + error);
      }

      let projectIdForDeadline = this.filterProject;
      if (!projectIdForDeadline && this.selectedParticipants.length > 0) {
        projectIdForDeadline = this.selectedParticipants[0].projectId;
      }

      let projectDeadline: Date | undefined;
      if (projectIdForDeadline) {
        const projectRef = doc(
          this.firestore,
          'projects',
          projectIdForDeadline
        );
        const projectDoc = await getDoc(projectRef);
        if (projectDoc.exists()) {
          if (projectDoc.data()['deadline'] instanceof Timestamp) {
            projectDeadline = projectDoc.data()['deadline'].toDate();
          } else if (projectDoc.data()['deadline'] instanceof Date) {
            projectDeadline = projectDoc.data()['deadline'];
          }
        }
      }
      const formattedDeadline = this.formatDate(projectDeadline);

      contentObj = this.replaceDeadlineInContent(contentObj, formattedDeadline);
      const updatedContent = JSON.stringify(contentObj);

      await updateDoc(templateRef, { content: updatedContent });

      for (const participant of this.selectedParticipants) {
        const emailRequest = {
          email: participant.email,
          templateId: template.id,
          participantId: participant.id,
          assessmentId: selectedAssessmentId,
        };

        const response = await fetch(
          'https://us-central1-pwa-workana.cloudfunctions.net/sendEmail',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailRequest),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Erro ao enviar e-mail para ${
              participant.email
            }: ${await response.text()}`
          );
        }

        const assessmentLinkQuery = query(
          collection(this.firestore, 'assessmentLinks'),
          where('participantId', '==', participant.id),
          where('assessmentId', '==', selectedAssessmentId)
        );
        const existingLinksSnapshot = await getDocs(assessmentLinkQuery);

        if (existingLinksSnapshot.empty) {
          const assessmentLinkDoc = doc(
            collection(this.firestore, 'assessmentLinks')
          );
          await setDoc(assessmentLinkDoc, {
            assessmentId: selectedAssessmentId,
            participantId: participant.id,
            sentAt: new Date(),
            status: 'pending',
            emailTemplate: template.id,
            participantEmail: participant.email,
          });
        } else {
          const existingLinkDoc = existingLinksSnapshot.docs[0];
          await updateDoc(
            doc(this.firestore, 'assessmentLinks', existingLinkDoc.id),
            {
              sentAt: new Date(),
              emailTemplate: template.id,
              status:
                existingLinkDoc.data()['status'] === 'completed'
                  ? 'completed'
                  : 'pending',
            }
          );
        }
      }

      await updateDoc(templateRef, { content: originalContent });

      this.snackBar.open(
        `Links enviados para ${this.selectedParticipants.length} participantes!`,
        'Fechar',
        { duration: 3000 }
      );
    } catch (error) {
      console.error('Erro ao enviar links:', error);
      this.snackBar.open('Erro ao enviar links.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isLoading = false;
    }
  }

  private replaceDeadlineInContent(
    contentObj: any,
    formattedDeadline: string
  ): any {
    if (contentObj.body && contentObj.body.rows) {
      contentObj.body.rows.forEach((row: any) => {
        if (row.columns) {
          row.columns.forEach((column: any) => {
            if (column.contents) {
              column.contents.forEach((content: any) => {
                if (content.values && content.values.text) {
                  content.values.text = content.values.text.replace(
                    /\*\$\%DATA DE EXPIRAÇÃO DO PROJETO\$\%/g,
                    formattedDeadline
                  );
                }
              });
            }
          });
        }
      });
    }
    return contentObj;
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'Não definida';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  downloadTemplate(): void {
    const link = document.createElement('a');
    link.href = 'assets/templates/Modelo_Avaliacao_360.xlsx';
    link.download = 'Modelo_Avaliacao_360.xlsx';
    link.click();
  }

  async uploadExcel(event: any): Promise<void> {
    if (!this.filterClient || !this.filterProject) {
      this.snackBar.open(
        'Por favor, selecione um cliente e um projeto antes de fazer o upload.',
        'Fechar',
        { duration: 3000 }
      );
      return;
    }

    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      });

      const startRowIndex = 19;
      const participants: any[] = [];

      for (let i = startRowIndex; i < jsonData.length; i++) {
        const row = jsonData[i];

        if (
          !Array.isArray(row) ||
          row.length < 4 ||
          !row[1] ||
          !row[2] ||
          !row[3]
        ) {
          continue;
        }

        const category = row[3]?.toString().trim() || '';
        const type = category === 'Avaliado' ? 'avaliado' : 'avaliador';

        participants.push({
          name: row[1]?.toString().trim() || '',
          email: row[2]?.toString().trim() || '',
          category,
          type,
        });
      }

      if (participants.length === 0) {
        this.snackBar.open('Nenhum participante válido encontrado.', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      const dialogRef = this.dialog.open(
        ParticipantsConfirmationDialogComponent,
        {
          width: '800px',
          data: {
            participants,
            clientId: this.filterClient,
            clientName:
              this.clients.find((c) => c.id === this.filterClient)?.name ||
              'Cliente Desconhecido',
            projectId: this.filterProject,
            projectName:
              this.projects.find((p) => p.id === this.filterProject)?.name ||
              'Projeto Desconhecido',
            loadEvaluation: (projectId: string) =>
              this.loadEvaluation(projectId),
          },
        }
      );

      dialogRef.afterClosed().subscribe(async (result) => {
        if (result) {
          const savedParticipants = [];

          for (const participant of participants) {
            try {
              const docRef = await addDoc(
                collection(this.firestore, 'participants'),
                {
                  ...participant,
                  clientId: result.client,
                  projectId: result.project,
                  assessments: result.evaluation ? [result.evaluation] : [],
                  createdAt: new Date(),
                }
              );

              savedParticipants.push({
                ...participant,
                id: docRef.id,
                assessments: result.evaluation ? [result.evaluation] : [],
              });
            } catch (error) {
              console.error('Erro ao salvar participante:', error);
            }
          }

          this.snackBar.open('Upload e salvamento concluídos!', 'Fechar', {
            duration: 3000,
          });
          this.loadParticipants();
        }
      });
    };

    reader.readAsArrayBuffer(file);
  }

  async loadEvaluation(
    projectId: string
  ): Promise<{ id: string; name: string } | null> {
    if (!projectId) return null;

    try {
      const projectDoc = doc(this.firestore, 'projects', projectId);
      const projectSnapshot = await getDoc(projectDoc);
      if (!projectSnapshot.exists()) {
        throw new Error('Projeto não encontrado');
      }

      const projectData = projectSnapshot.data();
      const assessmentId = projectData['assessmentId'];

      if (!assessmentId) {
        this.snackBar.open(
          'Nenhuma avaliação associada a este projeto.',
          'Fechar',
          { duration: 3000 }
        );
        return null;
      }

      const assessmentDoc = doc(this.firestore, 'assessments', assessmentId);
      const assessmentSnapshot = await getDoc(assessmentDoc);
      if (!assessmentSnapshot.exists()) {
        throw new Error('Avaliação não encontrada');
      }

      const assessmentData = assessmentSnapshot.data();
      return {
        id: assessmentId,
        name: assessmentData['name'] || 'Avaliação Sem Nome',
      };
    } catch (error) {
      console.error('Erro ao carregar avaliação:', error);
      this.snackBar.open('Erro ao carregar avaliação.', 'Fechar', {
        duration: 3000,
      });
      return null;
    }
  }

  openAddParticipantModal(): void {
    const dialogRef = this.dialog.open(AddParticipantModalComponent, {
      width: '500px',
      data: {
        clients: this.clients, // Passa a lista de clientes
        projects: this.projects, // Passa a lista de projetos
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadParticipants();
      }
    });
  }

  getFriendlyEmailType(emailType: string): string {
    switch (emailType) {
      case 'conviteAvaliador':
        return 'Convite Avaliador';
      case 'conviteRespondente':
        return 'Convite Avaliado';
      case 'lembreteAvaliador':
        return 'Lembrete Avaliador';
      case 'lembreteRespondente':
        return 'Lembrete Avaliado';
      case 'lembrete':
        return 'Lembrete Avaliado';
      case 'convite':
        return 'Convite Avaliado';
      case 'cadastro':
        return 'Cadastro';
      default:
        return emailType || 'Tipo Desconhecido';
    }
  }
}
