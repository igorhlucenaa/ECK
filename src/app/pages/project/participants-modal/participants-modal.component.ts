import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialog,
} from '@angular/material/dialog';
import {
  FormBuilder,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  getDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { Timestamp } from '@angular/fire/firestore';
import * as XLSX from 'xlsx';
import { AddParticipantModalComponent } from '../add-participant-modal/add-participant-modal.component';
import { ParticipantsConfirmationDialogComponent } from '../../assessments/participants/participants-confirmation-dialog/participants-confirmation-dialog.component';

interface ModalData {
  projectId: string;
  clientId: string;
}

interface UnifiedParticipant {
  id: string;
  name: string;
  email: string;
  sentAt?: Date;
  completedAt?: Date;
  status?: string;
  selected?: boolean;
  category: string;
  type: 'avaliado' | 'avaliador';
}

interface MailTemplate {
  id: string;
  name: string;
  content: string;
  emailType: string;
  subject: string;
  clientId: string;
}

@Component({
  selector: 'app-participants-modal',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>Participantes</h2>
    <mat-dialog-content>
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
          <button mat-raised-button color="accent">
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
        </div>

        <!-- Botão Adicionar Novo Participante -->
        <button
          mat-flat-button
          color="primary"
          (click)="openAddParticipantModal()"
        >
          Adicionar Novo Participante
        </button>
      </div>

      <!-- Filtros -->
      <div class="row mb-3" style="margin-top: 20px">
        <!-- Filtro por Tipo -->
        <div class="col-md-3">
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
        <div class="col-md-3">
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

        <!-- Filtro por Status -->
        <div class="col-md-3">
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

        <!-- Campo de Pesquisa -->
        <div class="col-md-3">
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
      </div>

      <!-- Campo de Seleção de Template -->
      <mat-form-field class="w-100 mb-3" appearance="outline">
        <mat-label>Escolha um Template de E-mail</mat-label>
        <mat-select [formControl]="templateFormControl" required>
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

      <!-- Tabela de Participantes -->
      <div class="table-responsive">
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
                [disabled]="participant.completedAt != null"
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

          <!-- Ações (Excluir) -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Ações</th>
            <td mat-cell *matCellDef="let participant">
              <button
                mat-icon-button
                color="warn"
                (click)="deleteParticipant(participant.id)"
                matTooltip="Excluir Participante"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
      </div>

      <!-- Paginação -->
      <mat-paginator
        [pageSize]="5"
        [pageSizeOptions]="[5, 10, 20]"
        showFirstLastButtons
      ></mat-paginator>

      <!-- Botão Enviar Links -->
      <div class="mt-3 text-end"></div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        (click)="resendLinks()"
        [disabled]="
          isLoading ||
          selectedParticipants.length === 0 ||
          !templateFormControl.valid
        "
      >
        <mat-spinner *ngIf="isLoading" [diameter]="20"></mat-spinner>
        <span *ngIf="isLoading">Enviando...</span>
        <span *ngIf="!isLoading">Enviar Links</span>
      </button>
      <button mat-button mat-dialog-close>Fechar</button>
    </mat-dialog-actions>
  `,
  styleUrls: ['./participants-modal.component.scss'],
})
export class ParticipantsModalComponent implements OnInit {
  displayedColumns: string[] = [
    'select',
    'name',
    'email',
    'type',
    'category',
    'status',
    'sentAt',
    'completedAt',
    'actions',
  ];

  dataSource = new MatTableDataSource<UnifiedParticipant>([]);
  searchValue: string = '';
  filterType: string = '';
  filterCategory: string = '';
  filterStatus: string = '';
  selectedParticipants: UnifiedParticipant[] = [];
  isLoading: boolean = false;
  mailTemplates: MailTemplate[] = [];
  templateFormControl = this.fb.control('', Validators.required);

  @ViewChild('participantsPaginator', { static: false })
  participantsPaginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  clients: { id: string; name: string }[] = [];
  projects: { id: string; name: string }[] = [];

  constructor(
    public dialogRef: MatDialogRef<ParticipantsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ModalData,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private dialog: MatDialog
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.loadParticipants(),
      this.loadMailTemplates(),
      this.loadClients(),
      this.loadProjects(),
    ]);
    this.dataSource.paginator = this.participantsPaginator;
    this.dataSource.sort = this.sort;

    this.dataSource.filterPredicate = (
      data: UnifiedParticipant,
      filter: string
    ) => {
      const searchStr = `${data.name} ${data.email}`.toLowerCase();
      const typeMatch = !this.filterType || data.type === this.filterType;
      const categoryMatch =
        !this.filterCategory || data.category === this.filterCategory;
      const statusMatch =
        !this.filterStatus || data.status === this.filterStatus;
      return (
        searchStr.includes(this.searchValue.trim().toLowerCase()) &&
        typeMatch &&
        categoryMatch &&
        statusMatch
      );
    };
  }

  // Função para formatar o emailType de forma amigável
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
      default:
        return emailType || 'Tipo Desconhecido';
    }
  }

  async loadParticipants(): Promise<void> {
    try {
      // Buscar os participantes do projeto
      const participantsQuery = query(
        collection(this.firestore, 'participants'),
        where('projectId', '==', this.data.projectId)
      );
      const participantsSnapshot = await getDocs(participantsQuery);

      // Buscar as avaliações associadas ao projeto
      const assessmentsQuery = query(
        collection(this.firestore, 'assessments'),
        where('projectId', '==', this.data.projectId)
      );
      const assessmentsSnapshot = await getDocs(assessmentsQuery);
      const assessmentIds = assessmentsSnapshot.docs.map((doc) => doc.id);

      // Buscar os links de avaliação para todas as avaliações do projeto
      let linkDataMap: { [key: string]: any[] } = {};
      if (assessmentIds.length > 0) {
        const assessmentLinksQuery = query(
          collection(this.firestore, 'assessmentLinks'),
          where('assessmentId', 'in', assessmentIds)
        );
        const linksSnapshot = await getDocs(assessmentLinksQuery);

        // Agrupar os links por participantId
        linksSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const participantId = data['participantId'];
          if (!linkDataMap[participantId]) {
            linkDataMap[participantId] = [];
          }
          linkDataMap[participantId].push(data);
        });
      }

      const participants: UnifiedParticipant[] = [];
      for (const doc of participantsSnapshot.docs) {
        const participantId = doc.id;
        const participantData = doc.data();
        const email = participantData['email'] || 'Sem e-mail';
        const type = participantData['type'] as 'avaliado' | 'avaliador';
        const category = participantData['category'] || 'N/A';

        let sentAt: Date | undefined;
        let completedAt: Date | undefined;
        let status: string = 'Não Enviado';

        // Verificar todos os links de avaliação associados a este participante
        const participantLinks = linkDataMap[participantId] || [];
        if (participantLinks.length > 0) {
          // Determinar o status com base nos links
          for (const linkData of participantLinks) {
            const linkSentAt = linkData['sentAt']
              ? (linkData['sentAt'] as Timestamp).toDate()
              : undefined;
            const linkCompletedAt =
              linkData['status'] === 'completed' && linkData['completedAt']
                ? (linkData['completedAt'] as Timestamp).toDate()
                : undefined;

            // Prioridade: se houver um link completado, o status é "Respondido"
            if (linkCompletedAt) {
              completedAt = linkCompletedAt;
              status = 'Respondido';
              sentAt = linkSentAt; // Pode ser undefined, mas não importa se já foi completado
              break; // Não precisa verificar mais links
            }

            // Se não houver completado, mas houver enviado, definimos como "Enviado (Pendente)"
            if (linkSentAt && !completedAt) {
              sentAt = linkSentAt;
              status = 'Enviado (Pendente)';
            }
          }
        }

        // Adicionar o participante à lista apenas uma vez
        participants.push({
          id: participantId,
          name: participantData['name'] || 'Desconhecido',
          email: email,
          sentAt: sentAt,
          completedAt: completedAt,
          status: status,
          selected: false,
          category: category,
          type: type,
        });
      }

      this.dataSource.data = participants;
    } catch (error) {
      console.error('Erro ao carregar participantes:', error);
      this.snackBar.open('Erro ao carregar participantes.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadMailTemplates(): Promise<void> {
    try {
      if (!this.data.clientId) {
        this.snackBar.open('Nenhum clientId fornecido.', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      const templatesCollection = collection(this.firestore, 'mailTemplates');
      const templatesQuery = query(
        templatesCollection,
        where('clientId', '==', this.data.clientId)
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

  async loadClients(): Promise<void> {
    try {
      const clientsCollection = collection(this.firestore, 'clients');
      const snapshot = await getDocs(clientsCollection);

      this.clients = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['companyName'] || 'Cliente Sem Nome',
      }));
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
      }));
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      this.snackBar.open('Erro ao carregar projetos.', 'Fechar', {
        duration: 3000,
      });
    }
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

  determineStatus(sentAt?: Date, completedAt?: Date): string {
    if (completedAt) return 'Respondido';
    if (sentAt) return 'Enviado (Pendente)';
    return 'Não Enviado';
  }

  applyFilter(): void {
    this.dataSource.filter = 'apply';
  }

  toggleAll(checked: boolean): void {
    this.dataSource.data.forEach((participant) => {
      if (!participant.completedAt) {
        participant.selected = checked;
      }
    });
    this.updateSelection();
  }

  updateSelection(): void {
    this.selectedParticipants = this.dataSource.data.filter(
      (p) => p.selected && !p.completedAt
    );
  }

  allSelected(): boolean {
    const eligibleParticipants = this.dataSource.data.filter(
      (p) => !p.completedAt
    );
    return (
      eligibleParticipants.length > 0 &&
      eligibleParticipants.every((p) => p.selected)
    );
  }

  someSelected(): boolean {
    const eligibleParticipants = this.dataSource.data.filter(
      (p) => !p.completedAt
    );
    return eligibleParticipants.some((p) => p.selected) && !this.allSelected();
  }

  async resendLinks(): Promise<void> {
    this.isLoading = true;
    try {
      const selectedTemplateId = this.templateFormControl.value;
      if (!selectedTemplateId) {
        this.snackBar.open(
          'Por favor, selecione um template antes de enviar.',
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

      // Buscar a avaliação associada ao projeto
      const evaluation = await this.loadEvaluation(this.data.projectId);
      if (!evaluation) {
        this.snackBar.open(
          'Nenhuma avaliação associada ao projeto.',
          'Fechar',
          { duration: 3000 }
        );
        this.isLoading = false;
        return;
      }

      for (const participant of this.selectedParticipants) {
        const emailRequest = {
          email: participant.email,
          templateId: template.id,
          participantId: participant.id,
          assessmentId: evaluation.id, // Usar o assessmentId do projeto
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
          where('assessmentId', '==', evaluation.id)
        );
        const existingLinksSnapshot = await getDocs(assessmentLinkQuery);

        if (existingLinksSnapshot.empty) {
          const assessmentLinkDoc = doc(
            collection(this.firestore, 'assessmentLinks')
          );
          await setDoc(assessmentLinkDoc, {
            assessmentId: evaluation.id,
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

      this.snackBar.open(
        `Links enviados para ${this.selectedParticipants.length} participantes!`,
        'Fechar',
        { duration: 3000 }
      );
      this.dialogRef.close();
    } catch (error) {
      console.error('Erro ao enviar links:', error);
      this.snackBar.open('Erro ao enviar links.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isLoading = false;
    }
  }

  async deleteParticipant(participantId: string): Promise<void> {
    const confirmDelete = confirm(
      'Tem certeza que deseja excluir este participante?'
    );
    if (!confirmDelete) return;

    try {
      const participantDoc = doc(
        this.firestore,
        `participants/${participantId}`
      );
      await deleteDoc(participantDoc);

      this.dataSource.data = this.dataSource.data.filter(
        (p) => p.id !== participantId
      );
      this.snackBar.open('Participante excluído com sucesso.', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao excluir participante:', error);
      this.snackBar.open('Erro ao excluir participante.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  openAddParticipantModal(): void {
    const dialogRef = this.dialog.open(AddParticipantModalComponent, {
      width: '500px',
      data: {
        projectId: this.data.projectId,
        clientId: this.data.clientId,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadParticipants();
      }
    });
  }

  downloadTemplate(): void {
    const link = document.createElement('a');
    link.href = 'assets/templates/Modelo_Avaliacao_360.xlsx';
    link.download = 'Modelo_Avaliacao_360.xlsx';
    link.click();
  }

  async uploadExcel(event: any): Promise<void> {
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
            clientId: this.data.clientId,
            clientName:
              this.clients.find((c) => c.id === this.data.clientId)?.name ||
              'Cliente Desconhecido',
            projectId: this.data.projectId,
            projectName:
              this.projects.find((p) => p.id === this.data.projectId)?.name ||
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

  async loadProjectsForClient(
    clientId: string
  ): Promise<{ id: string; name: string }[]> {
    if (!clientId) return [];

    try {
      const projectsCollection = collection(this.firestore, 'projects');
      const snapshot = await getDocs(projectsCollection);

      return snapshot.docs
        .filter((doc) => doc.data()['clientId'] === clientId)
        .map((doc) => ({
          id: doc.id,
          name: doc.data()['name'] || 'Projeto Sem Nome',
        }));
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      this.snackBar.open('Erro ao carregar projetos.', 'Fechar', {
        duration: 3000,
      });
      return [];
    }
  }
}
