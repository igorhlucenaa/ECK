import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  FormBuilder,
  FormGroup,
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
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ViewChild } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { Timestamp } from '@angular/fire/firestore';

interface ModalData {
  projectId: string;
  clientId: string;
}

interface Participant {
  id: string;
  name: string;
  email: string;
  assessmentId?: string;
  sentAt?: Date;
  completedAt?: Date;
  status: string;
  selected: boolean;
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
  selector: 'app-resend-assessment-modal',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>Reenviar Link para Respondentes</h2>
    <mat-dialog-content>
      <!-- Campo de Seleção de Template -->
      <mat-form-field
        class="w-100 mb-3"
        appearance="outline"
        style="margin-top: 20px"
      >
        <mat-label>Escolha um Template de E-mail</mat-label>
        <mat-select [formControl]="templateFormControl" required>
          <mat-option
            *ngFor="let template of mailTemplates"
            [value]="template.id"
          >
            {{ template.name }}
          </mat-option>
        </mat-select>
        <mat-error *ngIf="templateFormControl.hasError('required')">
          Por favor, selecione um template.
        </mat-error>
      </mat-form-field>

      <!-- Campo de Pesquisa -->
      <mat-form-field class="w-100 mb-3" appearance="outline">
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

      <!-- Tabela de Respondentes -->
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

          <!-- Avaliação -->
          <ng-container matColumnDef="assessmentId">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Avaliação</th>
            <td mat-cell *matCellDef="let participant">
              {{ participant.assessmentId || 'N/A' }}
            </td>
          </ng-container>

          <!-- Status -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
            <td mat-cell *matCellDef="let participant">
              {{ participant.status }}
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
        [pageSize]="5"
        [pageSizeOptions]="[5, 10, 20]"
        showFirstLastButtons
      ></mat-paginator>
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
        <span *ngIf="!isLoading">Reenviar Links</span>
      </button>
      <button mat-button mat-dialog-close>Cancelar</button>
    </mat-dialog-actions>
  `,
  styleUrls: ['./resend-assessment-modal.component.scss'],
})
export class ResendAssessmentModalComponent implements OnInit {
  displayedColumns: string[] = [
    'select',
    'name',
    'email',
    'assessmentId',
    'status',
    'sentAt',
    'completedAt',
  ];
  dataSource = new MatTableDataSource<Participant>([]);
  searchValue: string = '';
  selectedParticipants: Participant[] = [];
  isLoading: boolean = false;
  mailTemplates: MailTemplate[] = [];
  templateFormControl = this.fb.control('', Validators.required); // Controle do formulário para o template

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    public dialogRef: MatDialogRef<ResendAssessmentModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ModalData,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private fb: FormBuilder // Adicionado FormBuilder
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadParticipants(), this.loadMailTemplates()]);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = (data: Participant, filter: string) => {
      const searchStr = `${data.name} ${data.email}`.toLowerCase();
      return searchStr.includes(filter);
    };
  }

  async loadParticipants(): Promise<void> {
    try {
      const assessmentsQuery = query(
        collection(this.firestore, 'assessments'),
        where('projectId', '==', this.data.projectId)
      );
      const assessmentsSnapshot = await getDocs(assessmentsQuery);
      const assessmentIds = assessmentsSnapshot.docs.map((doc) => doc.id);

      if (assessmentIds.length === 0) {
        this.snackBar.open(
          'Nenhuma avaliação associada a este projeto.',
          'Fechar',
          { duration: 3000 }
        );
        return;
      }

      const participantsQuery = query(
        collection(this.firestore, 'participants'),
        where('projectId', '==', this.data.projectId)
      );
      const participantsSnapshot = await getDocs(participantsQuery);

      const participantsMap: { [email: string]: Participant } = {};
      const participantIds = participantsSnapshot.docs.map((doc) => doc.id);

      const assessmentLinksQuery = query(
        collection(this.firestore, 'assessmentLinks'),
        where('assessmentId', 'in', assessmentIds),
        where('participantId', 'in', participantIds)
      );
      const linksSnapshot = await getDocs(assessmentLinksQuery);

      const linkDataMap: { [key: string]: any } = {};
      linksSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const key = `${data['participantId']}_${data['assessmentId']}`;
        linkDataMap[key] = data;
      });

      const participants: Participant[] = [];
      for (const doc of participantsSnapshot.docs) {
        const participantId = doc.id;
        const participantData = doc.data();
        const email = participantData['email'] || 'Sem e-mail';

        for (const assessmentId of assessmentIds) {
          const key = `${participantId}_${assessmentId}`;
          const linkData = linkDataMap[key] || {};

          const sentAt = linkData['sentAt']
            ? (linkData['sentAt'] as Timestamp).toDate()
            : undefined;
          const completedAt =
            linkData['status'] === 'completed' && linkData['completedAt']
              ? (linkData['completedAt'] as Timestamp).toDate()
              : undefined;
          const status = this.determineStatus(sentAt, completedAt);

          participants.push({
            id: participantId,
            name: participantData['name'] || 'Desconhecido',
            email: email,
            assessmentId: assessmentId,
            sentAt: sentAt,
            completedAt: completedAt,
            status: status,
            selected: false,
          });
        }
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
      console.error('Erro ao carregar templates de e-mail:', error);
      this.snackBar.open('Erro ao carregar templates de e-mail.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  determineStatus(sentAt?: Date, completedAt?: Date): string {
    if (completedAt) return 'Respondido';
    if (sentAt) return 'Enviado (Pendente)';
    return 'Não Enviado';
  }

  applyFilter(): void {
    this.dataSource.filter = this.searchValue.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
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

      for (const participant of this.selectedParticipants) {
        const emailRequest = {
          email: participant.email,
          templateId: template.id,
          participantId: participant.id,
          assessmentId: participant.assessmentId,
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
            `Erro ao reenviar e-mail para ${
              participant.email
            }: ${await response.text()}`
          );
        }

        const assessmentLinkDoc = doc(
          collection(this.firestore, 'assessmentLinks')
        );
        await setDoc(assessmentLinkDoc, {
          assessmentId: participant.assessmentId,
          participantId: participant.id,
          sentAt: new Date(),
          status: 'pending',
          emailTemplate: template.id,
          participantEmail: participant.email,
        });
      }

      this.snackBar.open(
        `Links enviados para ${this.selectedParticipants.length} respondentes!`,
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
}
