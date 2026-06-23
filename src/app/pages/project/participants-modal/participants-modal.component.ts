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
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  updateDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { AddParticipantModalComponent } from '../add-participant-modal/add-participant-modal.component';
import { ParticipantsConfirmationDialogComponent } from '../../assessments/participants/participants-confirmation-dialog/participants-confirmation-dialog.component';
import { SendHistoryDialogComponent } from '../../assessments/participants/send-history-dialog/send-history-dialog.component';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogService } from 'src/app/shared/confirm-dialog/confirm-dialog.service';
import { ParticipantValidationService } from 'src/app/services/participant-validation.service';
import { ParticipantCreditService } from 'src/app/services/participant-credit.service';

interface ModalData {
  projectId: string;
  clientId: string;
  projectName?: string;
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
  avaliadoId?: string;
  clientId: string;
  creditReserved?: boolean;
  creditConsumed?: boolean;
  reminderCount?: number;
  nextReminderAt?: Date;
  sendCount?: number;          // total de envios (convite + lembretes manuais)
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
  clientId: string;
}

@Component({
  selector: 'app-participants-modal',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, SendHistoryDialogComponent],
  template: `
  <div class="si-shell">

    <!-- ── HEADER ── -->
    <div class="si-header">
      <div class="si-header__left">
        <div class="si-header__icon"><mat-icon>send</mat-icon></div>
        <div>
          <div class="si-header__title">Disparar Convites</div>
          <div class="si-header__sub">{{ data.projectName || 'Projeto' }}</div>
        </div>
      </div>
      <div class="si-header__right">

        <button mat-icon-button class="si-header__refresh" (click)="refreshParticipants()" [disabled]="isRefreshing" matTooltip="Atualizar">
          <mat-icon [class.si-spin]="isRefreshing">refresh</mat-icon>
        </button>
        <button mat-icon-button class="si-header__close" (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    </div>

    <!-- ── CONFIG ROW: template + assessment ── -->
    <div class="si-config">
      <mat-form-field appearance="outline" class="si-config__field">
        <mat-label>Modelo de E-mail</mat-label>
        <mat-icon matPrefix style="color:#94a3b8;font-size:18px;margin-right:4px;">mail_outline</mat-icon>
        <mat-select [formControl]="templateFormControl">
          <mat-option *ngFor="let t of mailTemplates" [value]="t.id">
            {{ t.name }} — {{ getFriendlyEmailType(t.emailType) }}
          </mat-option>
        </mat-select>
        <mat-error>Selecione um modelo.</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="si-config__field">
        <mat-label>Formulário de Avaliação</mat-label>
        <mat-icon matPrefix style="color:#94a3b8;font-size:18px;margin-right:4px;">assignment</mat-icon>
        <mat-select [formControl]="assessmentFormControl">
          <mat-option *ngFor="let a of assessments" [value]="a.id">{{ a.name }}</mat-option>
        </mat-select>
        <mat-error>Selecione uma avaliação.</mat-error>
      </mat-form-field>
    </div>

    <!-- ── FILTER BAR ── -->
    <div class="si-filter">
      <div class="si-search">
        <mat-icon>search</mat-icon>
        <input [(ngModel)]="searchValue" (ngModelChange)="applyFilter()" placeholder="Buscar por nome ou e-mail…" />
        <button *ngIf="searchValue" (click)="searchValue='';applyFilter()" class="si-search__clear"><mat-icon>close</mat-icon></button>
      </div>

      <div class="si-chip-group">
        <button class="si-chip" [class.si-chip--active]="!filterCategory" (click)="filterCategory='';applyFilter()">Todos</button>
        <button class="si-chip" [class.si-chip--active]="filterCategory==='Avaliado'" (click)="filterCategory='Avaliado';applyFilter()">Avaliado</button>
        <button class="si-chip" [class.si-chip--active]="filterCategory==='Gestor'" (click)="filterCategory='Gestor';applyFilter()">Gestor</button>
        <button class="si-chip" [class.si-chip--active]="filterCategory==='Par'" (click)="filterCategory='Par';applyFilter()">Par</button>
        <button class="si-chip" [class.si-chip--active]="filterCategory==='Subordinado'" (click)="filterCategory='Subordinado';applyFilter()">Subordinado</button>
      </div>

      <div class="si-chip-group">
        <button class="si-chip" [class.si-chip--active]="!filterStatus" (click)="filterStatus='';applyFilter()">Todos</button>
        <button class="si-chip si-chip--unsent" [class.si-chip--active]="filterStatus==='Não Enviado'" (click)="filterStatus='Não Enviado';applyFilter()">Não Enviado</button>
        <button class="si-chip si-chip--pending" [class.si-chip--active]="filterStatus==='Enviado (Pendente)'" (click)="filterStatus='Enviado (Pendente)';applyFilter()">Pendente</button>
        <button class="si-chip si-chip--done" [class.si-chip--active]="filterStatus==='Respondido'" (click)="filterStatus='Respondido';applyFilter()">Respondido</button>
      </div>

      <button class="si-select-all-btn" (click)="selectAllPending()" [disabled]="!isSelectionReady"
              [matTooltip]="!isSelectionReady ? 'Selecione um modelo de e-mail primeiro' : ''">
        <mat-icon>done_all</mat-icon> Selecionar pendentes
      </button>
    </div>

    <!-- ── PARTICIPANTS LIST ── -->
    <div class="si-list">

      <div class="si-list__empty" *ngIf="!isRefreshing && dataSource.filteredData.length === 0">
        <mat-icon>group_off</mat-icon>
        <span>Nenhum participante encontrado</span>
      </div>

      <div class="si-row" *ngFor="let p of dataSource.filteredData"
           [class.si-row--selected]="p.selected"
           [class.si-row--completed]="p.completedAt"
           (click)="(!p.completedAt && isSelectionReady && applyEmailTypeFilter(p)) ? (p.selected=!p.selected) : null; updateSelection()">

        <mat-checkbox [(ngModel)]="p.selected"
                      [disabled]="!!p.completedAt || !isSelectionReady || !applyEmailTypeFilter(p)"
                      (ngModelChange)="updateSelection()" (click)="$event.stopPropagation()"></mat-checkbox>

        <div class="si-row__avatar">{{ p.name.charAt(0).toUpperCase() }}</div>

        <div class="si-row__info">
          <div class="si-row__name">{{ p.name }}</div>
          <div class="si-row__email">{{ p.email }}</div>
        </div>

        <!-- Datas: envio + resposta (mesmo formato da tela de participantes) -->
        <div class="si-datas-cell">
          <span class="si-datas-row" [class.si-datas-row--empty]="!p.sentAt"
                [matTooltip]="p.sentAt ? ('Enviado em ' + (p.sentAt | date:'dd/MM/yyyy HH:mm')) : 'Não enviado'">
            <mat-icon>send</mat-icon>
            {{ p.sentAt ? (p.sentAt | date:'dd/MM/yy') : '—' }}
          </span>
          <span class="si-datas-row si-datas-row--resp" [class.si-datas-row--empty]="!p.completedAt"
                [matTooltip]="p.completedAt ? ('Respondido em ' + (p.completedAt | date:'dd/MM/yyyy HH:mm')) : 'Aguardando resposta'">
            <mat-icon>check_circle</mat-icon>
            {{ p.completedAt ? (p.completedAt | date:'dd/MM/yy') : '—' }}
          </span>

        </div>

        <div class="si-row__meta">
          <span class="si-badge si-badge--cat">{{ p.category }}</span>
          <span class="si-badge"
                [class.si-badge--done]="p.completedAt"
                [class.si-badge--pending]="!p.completedAt && p.sentAt"
                [class.si-badge--unsent]="!p.completedAt && !p.sentAt">
            {{ p.completedAt ? 'Respondido' : (p.sentAt ? 'Pendente' : 'Não Enviado') }}
          </span>
          <span class="si-badge si-badge--reminder" *ngIf="(p.reminderCount ?? 0) > 0"
                [matTooltip]="(p.reminderCount) + ' lembrete(s) automático(s) enviado(s)'">
            <mat-icon style="font-size:11px;width:11px;height:11px;vertical-align:middle;">notifications</mat-icon>
            {{ p.reminderCount }}
          </span>
        </div>

        <!-- Ações por linha -->
        <div class="si-row__actions">
          <button class="si-act-btn si-act-btn--history"
                  *ngIf="p.status !== 'Não Enviado'"
                  (click)="openSendHistory(p); $event.stopPropagation()"
                  matTooltip="Histórico de envios">
            <mat-icon>history</mat-icon>
          </button>
          <button class="si-act-btn si-act-btn--cancel"
                  *ngIf="p.status === 'Enviado (Pendente)'"
                  (click)="cancelSend(p); $event.stopPropagation()"
                  matTooltip="Cancelar envio">
            <mat-icon>cancel</mat-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- ── FOOTER ── -->
    <div class="si-footer">
      <div class="si-footer__info">
        <span class="si-footer__count" *ngIf="selectedParticipants.length > 0">
          <mat-icon>check_circle</mat-icon>
          {{ selectedParticipants.length }} selecionado{{ selectedParticipants.length !== 1 ? 's' : '' }}
        </span>
        <span class="si-footer__hint" *ngIf="!isSelectionReady">
          Selecione um modelo de e-mail{{ selectedTemplate && selectedTemplate.emailType !== 'cadastro' ? ' e um formulário' : '' }} para habilitar a seleção
        </span>
        <span class="si-footer__hint" *ngIf="isSelectionReady && selectedParticipants.length === 0">
          Selecione ao menos um participante para enviar
        </span>
      </div>
      <div class="si-footer__actions">
        <button mat-button (click)="dialogRef.close()">Cancelar</button>
        <button class="si-send-btn" (click)="resendLinks()"
                [disabled]="isLoading || selectedParticipants.length === 0 || !templateFormControl.valid || !assessmentFormControl.valid">
          <span class="si-send-btn__spinner" *ngIf="isLoading"></span>
          <mat-icon *ngIf="!isLoading">send</mat-icon>
          {{ isLoading ? 'Enviando…' : 'Enviar E-mails' }}
        </button>
      </div>
    </div>

  </div>
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
    'relatorio', // nova coluna
    'actions',
  ];

  dataSource = new MatTableDataSource<UnifiedParticipant>([]);
  searchValue: string = '';
  filterType: string = '';
  filterCategory: string = '';
  filterStatus: string = '';
  selectedParticipants: UnifiedParticipant[] = [];
  isLoading: boolean = false;
  isRefreshing: boolean = false;
  lastRefreshed: Date | null = null;
  mailTemplates: MailTemplate[] = [];
  assessments: Assessment[] = [];
  templateFormControl = this.fb.control('', Validators.required);
  assessmentFormControl = this.fb.control('', Validators.required);
  selectAllPending(): void {
    if (!this.isSelectionReady) return;
    this.dataSource.filteredData.forEach(p => {
      if (!p.completedAt && this.applyEmailTypeFilter(p)) p.selected = true;
    });
    this.updateSelection();
  }

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
    private dialog: MatDialog,
    private router: Router,
    private translate: TranslateService,
    private confirmDialog: ConfirmDialogService,
    private participantValidationService: ParticipantValidationService,
    private participantCreditService: ParticipantCreditService
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.loadParticipants(),
      this.loadMailTemplates(),
      this.loadAssessmentsForClient(this.data.clientId),
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
      const emailTypeMatch = this.applyEmailTypeFilter(data);
      return (
        searchStr.includes(this.searchValue.trim().toLowerCase()) &&
        typeMatch &&
        categoryMatch &&
        statusMatch &&
        emailTypeMatch
      );
    };

    // Re-filter when template changes so incompatible types are hidden
    this.templateFormControl.valueChanges.subscribe(() => {
      // Deselect participants that no longer match the new template
      this.dataSource.data.forEach(p => {
        if (!this.applyEmailTypeFilter(p)) p.selected = false;
      });
      this.applyFilter();
      this.updateSelection();
    });

    // Pré-seleciona todos os participantes que ainda não responderam
    this.dataSource.data.forEach(p => {
      if (!p.completedAt) p.selected = true;
    });
    this.updateSelection();
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
      default:
        return emailType || 'Tipo Desconhecido';
    }
  }

  async refreshParticipants(): Promise<void> {
    this.isRefreshing = true;
    await this.loadParticipants();
    this.isRefreshing = false;
    this.lastRefreshed = new Date();
  }

  async loadParticipants(): Promise<void> {
    try {
      const participantsQuery = query(
        collection(this.firestore, 'participants'),
        where('projectId', '==', this.data.projectId)
      );
      const participantsSnapshot = await getDocs(participantsQuery);

      // Busca todos os links do projeto diretamente por projectId (mais confiável)
      let linkDataMap: { [key: string]: any[] } = {};
      const linksSnap = await getDocs(
        query(collection(this.firestore, 'assessmentLinks'), where('projectId', '==', this.data.projectId))
      );
      linksSnap.docs.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        const participantId = (data as any)['participantId'];
        if (participantId) {
          if (!linkDataMap[participantId]) linkDataMap[participantId] = [];
          linkDataMap[participantId].push(data);
        }
      });

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
        let reminderCount = 0;
        let nextReminderAt: Date | undefined;
        let sendCount = 0;

        const participantLinks = linkDataMap[participantId] || [];
        if (participantLinks.length > 0) {
          for (const linkData of participantLinks) {
            const linkSentAt = linkData['sentAt']
              ? (linkData['sentAt'] as Timestamp).toDate()
              : undefined;
            const linkCompletedAt =
              linkData['status'] === 'completed' && linkData['completedAt']
                ? (linkData['completedAt'] as Timestamp).toDate()
                : undefined;

            if (linkCompletedAt) {
              completedAt = linkCompletedAt;
              status = 'Respondido';
              sentAt = linkSentAt;
              break;
            }

            if (linkSentAt && !completedAt && linkData['status'] !== 'cancelled') {
              sentAt = linkSentAt;
              status = 'Enviado (Pendente)';
            }

            // Lembretes automáticos
            const rc = Number(linkData['reminderCount'] || 0);
            if (rc > reminderCount) reminderCount = rc;
            if (linkData['nextReminderAt']) {
              const nra = (linkData['nextReminderAt'] as Timestamp).toDate();
              if (!nextReminderAt || nra < nextReminderAt) nextReminderAt = nra;
            }

            // Total de envios manuais
            sendCount += Number(linkData['resendCount'] || (linkSentAt ? 1 : 0));
          }
        }

        const creditReserved = participantData['creditReserved'] === true;
        const creditConsumed = participantData['creditConsumed'] === true;

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
          avaliadoId: participantData['avaliadoId'] || undefined,
          clientId: this.data.clientId,
          creditReserved,
          creditConsumed,
          reminderCount,
          nextReminderAt,
          sendCount,
        });
      }

      this.dataSource.data = participants;
    } catch (error) {
      console.error('Erro ao carregar participantes:', error);
      this.snackBar.open(this.translate.instant('Erro ao carregar participantes.'), this.translate.instant('Fechar'), { duration: 3000 });
    }
  }

  async loadMailTemplates(): Promise<void> {
    try {
      if (!this.data.clientId) {
        this.snackBar.open(this.translate.instant('Nenhum clientId fornecido.'), this.translate.instant('Fechar'), { duration: 3000 });
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
        this.snackBar.open(this.translate.instant('Nenhum template encontrado para este cliente.'), this.translate.instant('Fechar'), { duration: 3000 });
      }
    } catch (error) {
      console.error('Erro ao carregar Modelos de e-mail:', error);
      this.snackBar.open(this.translate.instant('Erro ao carregar Modelos de e-mail.'), this.translate.instant('Fechar'), { duration: 3000 });
    }
  }

  async loadAssessmentsForClient(clientId: string): Promise<void> {
    try {
      if (!clientId) {
        this.snackBar.open('Nenhum clientId fornecido.', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      const assessmentsQuery = query(
        collection(this.firestore, 'assessments'),
        where('clientId', '==', clientId)
      );
      const snapshot = await getDocs(assessmentsQuery);

      this.assessments = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Avaliação Sem Nome',
        clientId: doc.data()['clientId'] || '',
      }));

      if (this.assessments.length === 0) {
        this.snackBar.open(this.translate.instant('Nenhuma avaliação encontrada para este cliente.'), this.translate.instant('Fechar'), { duration: 3000 });
      }
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      this.snackBar.open(this.translate.instant('Erro ao carregar avaliações.'), this.translate.instant('Fechar'), { duration: 3000 });
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
      this.snackBar.open(this.translate.instant('Erro ao carregar clientes.'), this.translate.instant('Fechar'), { duration: 3000 });
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
      this.snackBar.open(this.translate.instant('Erro ao carregar projetos.'), this.translate.instant('Fechar'), { duration: 3000 });
    }
  }

  determineStatus(sentAt?: Date, completedAt?: Date): string {
    if (completedAt) return 'Respondido';
    if (sentAt) return 'Enviado (Pendente)';
    return 'Não Enviado';
  }

  get selectedTemplate(): MailTemplate | undefined {
    return this.mailTemplates.find(t => t.id === this.templateFormControl.value);
  }

  /** Template must be selected (and assessment if needed) before participants can be chosen */
  get isSelectionReady(): boolean {
    if (!this.templateFormControl.valid) return false;
    const needsAssessment = this.selectedTemplate?.emailType && this.selectedTemplate?.emailType !== 'cadastro';
    if (needsAssessment && !this.assessmentFormControl.valid) return false;
    return true;
  }

  /** Returns true if participant matches the selected template's target audience */
  applyEmailTypeFilter(data: UnifiedParticipant): boolean {
    if (!this.selectedTemplate) return true;
    const emailType = this.selectedTemplate.emailType;
    if (!emailType) return true;
    if (emailType === 'cadastro') return true;
    if (['conviteAvaliador', 'lembreteAvaliador'].includes(emailType)) {
      return data.type === 'avaliador';
    }
    if (['conviteRespondente', 'lembreteRespondente', 'convite', 'lembrete'].includes(emailType)) {
      return data.type === 'avaliado';
    }
    return true;
  }

  applyFilter(): void {
    this.dataSource.filter = 'apply';
  }

  toggleAll(checked: boolean): void {
    this.dataSource.filteredData.forEach((participant) => {
      if (!participant.completedAt && this.applyEmailTypeFilter(participant)) {
        participant.selected = checked;
      }
    });
    this.updateSelection();
  }

  updateSelection(): void {
    this.selectedParticipants = this.dataSource.filteredData.filter(
      (p) => p.selected && this.applyEmailTypeFilter(p) && !p.completedAt
    );
  }

  allSelected(): boolean {
    const eligible = this.dataSource.filteredData.filter(
      (p) => this.applyEmailTypeFilter(p) && !p.completedAt
    );
    return eligible.length > 0 && eligible.every((p) => p.selected);
  }

  someSelected(): boolean {
    const eligible = this.dataSource.filteredData.filter(
      (p) => this.applyEmailTypeFilter(p) && !p.completedAt
    );
    return eligible.some((p) => p.selected) && !this.allSelected();
  }

  async resendLinks(): Promise<void> {
    this.isLoading = true;
    try {
      const selectedTemplateId = this.templateFormControl.value;
      const selectedAssessmentId = this.assessmentFormControl.value;

      if (!selectedTemplateId) {
        this.snackBar.open(this.translate.instant('Por favor, selecione um template antes de enviar.'), this.translate.instant('Fechar'), { duration: 3000 });
        this.isLoading = false;
        return;
      }

      if (!selectedAssessmentId) {
        this.snackBar.open(this.translate.instant('Por favor, selecione uma avaliação antes de enviar.'), this.translate.instant('Fechar'), { duration: 3000 });
        this.isLoading = false;
        return;
      }

      const template = this.mailTemplates.find(
        (t) => t.id === selectedTemplateId
      );
      if (!template) {
        this.snackBar.open(this.translate.instant('Template selecionado não encontrado.'), this.translate.instant('Fechar'), { duration: 3000 });
        this.isLoading = false;
        return;
      }

      const assessment = this.assessments.find(
        (a) => a.id === selectedAssessmentId
      );
      if (!assessment) {
        this.snackBar.open(this.translate.instant('Avaliação selecionada não encontrada.'), this.translate.instant('Fechar'), { duration: 3000 });
        this.isLoading = false;
        return;
      }

      // Carrega configurações de lembrete do projeto uma única vez
      const reminderSettings = await this.loadReminderSettings();
      const emailCount = this.selectedParticipants.length;

      for (const participant of this.selectedParticipants) {
        const emailRequest = {
          email: participant.email,
          templateId: template.id,
          participantId: participant.id,
          assessmentId: assessment.id,
          evaluatedParticipantId: (participant as any).avaliadoId || undefined,
        };

        const response = await fetch(
          (await import('src/enviroments/environment')).environment.functions.sendEmailUrl,
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
          where('assessmentId', '==', assessment.id)
        );
        const existingLinksSnapshot = await getDocs(assessmentLinkQuery);

        if (existingLinksSnapshot.empty) {
          // Novo link
          const newLinkData: Record<string, any> = {
            assessmentId: assessment.id,
            participantId: participant.id,
            clientId: this.data.clientId,
            projectId: this.data.projectId,
            sentAt: new Date(),
            status: 'pending',
            emailTemplate: template.id,
            participantEmail: participant.email,
            creditReserved: false,
          };

          if (participant.type === 'avaliador' && participant.avaliadoId) {
            newLinkData['avaliadoId'] = participant.avaliadoId;
          }

          if (reminderSettings) {
            const nextAt = this.computeNextReminderAt(
              reminderSettings.startDate,
              reminderSettings.intervalDays,
              reminderSettings.sendTime,
              reminderSettings.timezone,
              reminderSettings.weekdays,
            );
            newLinkData['nextReminderAt'] = Timestamp.fromDate(nextAt);
          }

          const assessmentLinkDoc = doc(collection(this.firestore, 'assessmentLinks'));
          await setDoc(assessmentLinkDoc, newLinkData);
        } else {
          const existingLinkDoc = existingLinksSnapshot.docs[0];
          const existingData = existingLinkDoc.data();
          const isPending = existingData['status'] !== 'completed';

          const updateData: Record<string, any> = {
            clientId: this.data.clientId,
            projectId: this.data.projectId,
            sentAt: new Date(),
            emailTemplate: template.id,
            status: isPending ? 'pending' : 'completed',
            creditReserved: false,
          };

          if (participant.type === 'avaliador' && participant.avaliadoId) {
            updateData['avaliadoId'] = participant.avaliadoId;
          }

          if (isPending && !existingData['nextReminderAt'] && reminderSettings) {
            const nextAt = this.computeNextReminderAt(
              reminderSettings.startDate,
                reminderSettings.intervalDays,
                reminderSettings.sendTime,
                reminderSettings.timezone,
                reminderSettings.weekdays,
              );
            updateData['nextReminderAt'] = Timestamp.fromDate(nextAt);
          }

          await updateDoc(
            doc(this.firestore, 'assessmentLinks', existingLinkDoc.id),
            updateData
          );
        }
      }

      // Marca crédito como consumido para avaliados disparados neste envio
      await this.markCreditsConsumedForDispatch();

      const msg = this.translate.instant('Links enviados para {{count}} participantes!', { count: emailCount });
      this.snackBar.open(msg, this.translate.instant('Fechar'), { duration: 3000 });
      this.dialogRef.close();
    } catch (error) {
      console.error('Erro ao enviar links:', error);
      this.snackBar.open(this.translate.instant('Erro ao enviar links.'), this.translate.instant('Fechar'), { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Ao concluir um disparo, marca creditConsumed=true em cada avaliado
   * presente nos selectedParticipants e define firstFinalDispatchAt no projeto
   * se ainda não estiver definido (gatilho R4: estorno só antes do 1º disparo).
   */
  private async markCreditsConsumedForDispatch(): Promise<void> {
    const avaliadosToConsume = this.selectedParticipants.filter(
      (p) => p.type === 'avaliado' && p.creditReserved && !p.creditConsumed
    );

    if (avaliadosToConsume.length === 0) return;

    const projectRef = doc(this.firestore, `projects/${this.data.projectId}`);
    const projectSnap = await getDoc(projectRef);
    const hasFirstDispatch = !!projectSnap.data()?.['firstFinalDispatchAt'];

    for (const p of avaliadosToConsume) {
      await this.participantCreditService.consumeParticipantCreditOnDispatch(p.id);
      p.creditConsumed = true;
    }

    if (!hasFirstDispatch) {
      await updateDoc(projectRef, { firstFinalDispatchAt: Timestamp.now() });
    }
  }

  /** Carrega as configurações de lembrete ativas para o projeto atual. */
  private async loadReminderSettings(): Promise<{
    startDate: Date;
    intervalDays: number;
    sendTime: string;
    timezone: string;
    maxReminders: number;
    weekdays: number[];
  } | null> {
    try {
      const docId = `${this.data.clientId}_${this.data.projectId}`;
      const snap = await getDoc(doc(this.firestore, 'reminderSettings', docId));
      if (!snap.exists()) return null;
      const d = snap.data();
      if (!d['enabled']) return null;

      const startDate: Date | null = d['startDate']?.toDate?.() ?? null;
      if (!startDate) return null;

      return {
        startDate,
        intervalDays: Math.max(1, Number(d['intervalDays'] || 3)),
        sendTime: String(d['sendTime'] || '09:00'),
        timezone: String(d['timezone'] || 'America/Fortaleza'),
        maxReminders: Math.max(0, Number(d['maxReminders'] || 0)),
        weekdays: this.normalizeWeekdays(d['weekdays']),
      };
    } catch {
      return null;
    }
  }

  /**
   * Calcula o próximo instante de disparo de lembrete para um participante
   * novo (sem histórico de envios).
   * Replica a lógica de ReminderSettingsComponent.computeNextReminder.
   */
  private computeNextReminderAt(
    startDate: Date,
    intervalDays: number,
    sendTime: string,
    timezone: string,
    weekdays: number[] = [],
  ): Date {
    const now = new Date();
    let next = this.buildReminderOccurrence(startDate, 0, sendTime, timezone);
    next = this.advanceToAllowedWeekday(next, timezone, weekdays);

    if (next > now) return next;

    const msPerInterval = intervalDays * 86_400_000;
    const extra = Math.ceil((now.getTime() - next.getTime()) / msPerInterval);
    next = this.buildReminderOccurrence(startDate, intervalDays * extra, sendTime, timezone);
    next = this.advanceToAllowedWeekday(next, timezone, weekdays);

    if (next <= now) {
      next = this.buildReminderOccurrence(startDate, intervalDays * (extra + 1), sendTime, timezone);
      next = this.advanceToAllowedWeekday(next, timezone, weekdays);
    }

    return next;
  }

  private advanceToAllowedWeekday(date: Date, timezone: string, weekdays: number[] = []): Date {
    const allowedWeekdays = this.normalizeWeekdays(weekdays);
    if (!allowedWeekdays.length) return date;

    for (let offset = 0; offset < 7; offset++) {
      const candidate = new Date(date.getTime() + offset * 86_400_000);
      if (allowedWeekdays.includes(this.getWeekdayInTimezone(candidate, timezone))) {
        return candidate;
      }
    }

    return date;
  }

  private getWeekdayInTimezone(date: Date, timezone: string): number {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(date).toLowerCase();
    const map: Record<string, number> = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };
    return map[weekday.slice(0, 3)] ?? date.getDay();
  }

  private normalizeWeekdays(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(
        value
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
      )
    ).sort((a, b) => a - b);
  }

  private buildReminderOccurrence(base: Date, offsetDays: number, sendTime: string, timezone: string): Date {
    const targetDay = new Date(base.getTime() + offsetDays * 86_400_000);

    const dateFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const dp = dateFmt.formatToParts(targetDay);
    const year  = dp.find(p => p.type === 'year')?.value  ?? '2000';
    const month = dp.find(p => p.type === 'month')?.value ?? '01';
    const day   = dp.find(p => p.type === 'day')?.value   ?? '01';
    const datePart = `${year}-${month}-${day}`;

    const noonUtc = new Date(`${datePart}T12:00:00Z`);
    const timeFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: false,
    });
    const tp = timeFmt.formatToParts(noonUtc);
    const tzH = Number(tp.find(p => p.type === 'hour')?.value   ?? '0');
    const tzM = Number(tp.find(p => p.type === 'minute')?.value ?? '0');
    const offsetMin = tzH * 60 + tzM - 720;

    const [sh, sm] = sendTime.split(':').map(Number);
    const utcMin = sh * 60 + sm - offsetMin;
    const dayStartUtc = new Date(`${datePart}T00:00:00Z`).getTime();
    return new Date(dayStartUtc + utcMin * 60_000);
  }

  openSendHistory(participant: UnifiedParticipant): void {
    this.dialog.open(SendHistoryDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'send-history-panel',
      data: { participant },
    });
  }

  async cancelSend(participant: UnifiedParticipant): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      type: 'warning',
      title: 'Cancelar envio',
      itemName: participant.name,
      message: 'Tem certeza que deseja cancelar o envio?',
    });
    if (!ok) return;

    // ── Atualização otimista: UI atualiza imediatamente ──────
    const prevStatus = participant.status;
    const prevSentAt = participant.sentAt;

    participant.status = 'Não Enviado';
    participant.sentAt = undefined;
    this.dataSource.data = [...this.dataSource.data];
    this.applyFilter();
    this.updateSelection();

    try {
      const linkQuery = query(
        collection(this.firestore, 'assessmentLinks'),
        where('participantId', '==', participant.id),
        where('status', '==', 'pending')
      );
      const linkSnap = await getDocs(linkQuery);
      if (linkSnap.empty) {
        participant.status = prevStatus;
        participant.sentAt = prevSentAt;
        this.dataSource.data = [...this.dataSource.data];
        this.applyFilter();
        this.snackBar.open('Nenhum envio pendente encontrado.', 'Fechar', { duration: 3000 });
        return;
      }
      const linkDoc = linkSnap.docs[0];
      const linkData = linkDoc.data();

      await updateDoc(doc(this.firestore, 'assessmentLinks', linkDoc.id), {
        status: 'cancelled',
        cancelledAt: new Date(),
        creditReserved: false,
      });

      if (linkData['creditReserved'] === true) {
        await this.participantCreditService.refundLegacyLinkCredits(
          [linkDoc],
          participant.clientId || this.data.clientId
        );
      }

      this.snackBar.open('Envio cancelado.', 'Fechar', { duration: 3000 });
    } catch (e) {
      participant.status = prevStatus;
      participant.sentAt = prevSentAt;
      this.dataSource.data = [...this.dataSource.data];
      this.applyFilter();
      console.error('Erro ao cancelar envio:', e);
      this.snackBar.open('Erro ao cancelar envio.', 'Fechar', { duration: 3000 });
    }
  }

  async deleteParticipant(participantId: string): Promise<void> {
    const participant = this.dataSource.data.find((p) => p.id === participantId);
    const nome = participant?.name || participantId;
    const confirmado = await this.confirmDialog.confirmDelete(nome);
    if (!confirmado) return;

    try {
      const linksSnap = await getDocs(query(
        collection(this.firestore, 'assessmentLinks'),
        where('participantId', '==', participantId)
      ));

      if (participant?.clientId) {
        await this.participantCreditService.refundLegacyLinkCredits(
          linksSnap.docs,
          participant.clientId
        );
      }
      await this.participantCreditService.refundParticipantReservedCredit(participantId);

      const batch = writeBatch(this.firestore);
      linksSnap.docs.forEach((linkDoc) => batch.delete(linkDoc.ref));
      batch.delete(doc(this.firestore, `participants/${participantId}`));
      await batch.commit();

      this.dataSource.data = this.dataSource.data.filter((p) => p.id !== participantId);
      this.snackBar.open(this.translate.instant('Participante excluído com sucesso.'), this.translate.instant('Fechar'), { duration: 3000 });
    } catch (error) {
      console.error('Erro ao excluir participante:', error);
      this.snackBar.open(this.translate.instant('Erro ao excluir participante.'), this.translate.instant('Fechar'), { duration: 3000 });
    }
  }

  openAddParticipantModal(): void {
    const dialogRef = this.dialog.open(AddParticipantModalComponent, {
      width: '480px',
      maxWidth: '95vw',
      panelClass: 'add-participant-dialog',
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
        this.snackBar.open(this.translate.instant('Nenhum participante válido encontrado.'), this.translate.instant('Fechar'), { duration: 3000 });
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
          },
        }
      );

      dialogRef.afterClosed().subscribe(async (result) => {
        if (!result) return;

        const projectName =
          this.projects.find((p) => p.id === result.project)?.name ||
          this.data.projectName ||
          'projeto';

        const validation = await this.participantValidationService.validateExcelParticipants(
          participants.map((p) => ({ ...p, projectId: result.project })),
          result.project,
          projectName
        );
        if (!validation.valid) {
          const msg = validation.error
            || (validation.errors[0]
              ? `O arquivo contém ${validation.errors[0].evaluateesCount} avaliados para o projeto "${projectName}". É permitido apenas um avaliado por projeto.`
              : 'Falha de validação no import.');
          this.snackBar.open(msg, 'Fechar', { duration: 6000 });
          return;
        }

        if (result) {
          const ordered = [...participants].sort((a, b) => {
            const aFirst = a.category === 'Avaliado' ? 0 : 1;
            const bFirst = b.category === 'Avaliado' ? 0 : 1;
            return aFirst - bFirst;
          });

          let avaliadoIdParaVincular: string | undefined;
          if (!ordered.some((p) => p.category === 'Avaliado')) {
            avaliadoIdParaVincular =
              (await this.participantValidationService.getProjectEvaluateeId(result.project)) || undefined;
          }

          for (const participant of ordered) {
            try {
              const baseFields = this.participantValidationService.buildParticipantWriteFields(
                participant.name,
                participant.email,
                {
                  category: participant.category,
                  type: participant.type,
                  clientId: result.client,
                  projectId: result.project,
                }
              );

              if (participant.category === 'Avaliado') {
                const evaluateeId = await this.participantCreditService.createEvaluateeWithCredit(
                  baseFields,
                  result.client,
                  result.project
                );
                if (!avaliadoIdParaVincular) {
                  avaliadoIdParaVincular = evaluateeId;
                }
              } else {
                const docData: Record<string, unknown> = {
                  ...baseFields,
                  createdAt: new Date(),
                };
                if (avaliadoIdParaVincular) {
                  docData['avaliadoId'] = avaliadoIdParaVincular;
                }
                await addDoc(collection(this.firestore, 'participants'), docData);
              }
            } catch (error: unknown) {
              console.error('Erro ao salvar participante:', error);
              const err = error as { code?: string };
              if (err.code === 'insufficient-credits') {
                this.snackBar.open('Créditos insuficientes para importar o avaliado.', 'Fechar', { duration: 6000 });
                break;
              }
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

  generateReportForParticipant(participant: UnifiedParticipant) {
    // Validar seleção de avaliação antes de prosseguir
    const selectedAssessmentId = this.assessmentFormControl.value;
    if (!selectedAssessmentId) {
      this.snackBar.open('Selecione um Formulário (Avaliação) para gerar o relatório.', 'Fechar', { duration: 3000 });
      return;
    }

    // Fechar todos os modais e navegar direto para a página de relatórios.
    // As competências são auto-selecionadas pela página de relatórios.
    this.dialog.closeAll();

    this.router.navigate(['/reports'], {
      queryParams: {
        mode: 'individual',
        clientId: participant.clientId || this.data.clientId,
        projectId: this.data.projectId,
        assessmentId: selectedAssessmentId,
        participantId: participant.id,
        participantName: participant.name,
        autoGenerate: 'true',
        aba: 'visualizar'
      }
    });
  }
}
