import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';

interface ModalData {
  assessmentId: string;
  projectId: string | null;
  clientId: string | null; // Adicionado clientId
}

interface Participant {
  id: string;
  name: string;
  email: string;
  selected: boolean;
  status: string;
  linkSent: boolean;
  isResponded: boolean;
  overallStatus: string;
}

interface MailTemplate {
  id: string;
  name: string;
  content: string;
  emailType: string;
  subject: string;
  clientId: string; // Mantido como clientId, pois os templates são filtrados por clientId
}

@Component({
  selector: 'app-send-assessment-modal',
  standalone: true,
  imports: [MaterialModule, CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Enviar Avaliação</h2>
    <mat-dialog-content>
      <!-- Formulário para selecionar o template -->
      <form [formGroup]="sendForm">
        <mat-form-field class="w-100">
          <mat-label>Escolha um Template de Convite</mat-label>
          <mat-select formControlName="template">
            <mat-option
              *ngFor="let template of mailTemplates"
              [value]="template.id"
            >
              {{ template.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>
      </form>

      <!-- Tabela de Participantes -->
      <table
        mat-table
        [dataSource]="participants"
        class="mat-elevation-z8 w-100"
      >
        <!-- Checkbox para Seleção -->
        <ng-container matColumnDef="select">
          <th mat-header-cell *matHeaderCellDef>
            <mat-checkbox
              (change)="toggleAll($event.checked)"
              [checked]="allSelected()"
              [indeterminate]="someSelected() && !allSelected()"
              [disabled]="areAllResponded"
            >
            </mat-checkbox>
          </th>
          <td mat-cell *matCellDef="let participant">
            <mat-checkbox
              [(ngModel)]="participant.selected"
              (ngModelChange)="updateSelection()"
              [disabled]="participant.isResponded"
            >
            </mat-checkbox>
          </td>
        </ng-container>

        <!-- Nome do Participante -->
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Nome</th>
          <td mat-cell *matCellDef="let participant">{{ participant.name }}</td>
        </ng-container>

        <!-- E-mail do Participante -->
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>E-mail</th>
          <td mat-cell *matCellDef="let participant">
            {{ participant.email }}
          </td>
        </ng-container>

        <!-- Status Geral -->
        <ng-container matColumnDef="overallStatus">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td
            mat-cell
            *matCellDef="let participant"
            [ngClass]="getStatusClass(participant.overallStatus)"
          >
            {{ participant.overallStatus }}
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
      </table>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        (click)="confirm()"
        [disabled]="!sendForm.valid || selectedParticipants.length === 0"
      >
        Enviar
      </button>
      <button mat-button mat-dialog-close>Cancelar</button>
    </mat-dialog-actions>
  `,
  styleUrls: ['./send-assessment-modal.component.scss'],
})
export class SendAssessmentModalComponent implements OnInit {
  displayedColumns: string[] = ['select', 'name', 'email', 'overallStatus'];
  participants: Participant[] = [];
  selectedParticipants: Participant[] = [];
  sendForm: FormGroup;
  mailTemplates: MailTemplate[] = [];
  areAllResponded: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<SendAssessmentModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ModalData,
    private fb: FormBuilder,
    private firestore: Firestore,
    private snackBar: MatSnackBar
  ) {
    this.sendForm = this.fb.group({
      template: ['', Validators.required],
    });
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadParticipants(), this.loadMailTemplates()]);
    this.updateAreAllResponded();
  }

  async loadParticipants(): Promise<void> {
    try {
      if (!this.data.projectId) {
        this.snackBar.open('Nenhum projectId fornecido.', 'Fechar', {
          duration: 3000,
        });
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
        where('assessmentId', '==', this.data.assessmentId),
        where('participantId', 'in', participantIds)
      );
      const linksSnapshot = await getDocs(assessmentLinksQuery);

      const linkDataMap: { [participantId: string]: any } = {};
      linksSnapshot.docs.forEach((doc) => {
        linkDataMap[doc.data()['participantId']] = doc.data();
      });

      for (const doc of participantsSnapshot.docs) {
        const participantId = doc.id;
        const participantData = doc.data();
        const linkData = linkDataMap[participantId] || {};

        const isResponded = linkData['status'] === 'completed';
        const linkSent = !!linkData['sentAt'];

        const overallStatus = this.determineOverallStatus(
          linkSent,
          isResponded
        );

        const email = participantData['email'] || 'Sem e-mail';
        if (!participantsMap[email]) {
          participantsMap[email] = {
            id: participantId,
            name: participantData['name'] || 'Desconhecido',
            email: email,
            selected: !isResponded && !linkSent,
            status: linkData['status'] || 'pending',
            linkSent: linkSent,
            isResponded: isResponded,
            overallStatus: overallStatus,
          };
        }
      }

      this.participants = Object.values(participantsMap);
      this.updateSelection();
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
        where('clientId', '==', this.data.clientId) // Mantido como clientId
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

  determineOverallStatus(linkSent: boolean, isResponded: boolean): string {
    if (isResponded) return 'Concluído';
    if (linkSent) return 'Pendente de Resposta';
    if (!linkSent) return 'Pendente de Envio';
    return 'Desconhecido';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Concluído':
        return 'status-completed';
      case 'Pendente de Resposta':
        return 'status-pending-response';
      case 'Pendente de Envio':
        return 'status-pending-send';
      default:
        return '';
    }
  }

  toggleAll(checked: boolean): void {
    this.participants.forEach((participant) => {
      if (!participant.isResponded) {
        participant.selected = checked;
      }
    });
    this.updateSelection();
  }

  updateSelection(): void {
    this.selectedParticipants = this.participants.filter(
      (p) => p.selected && !p.isResponded
    );
    this.updateAreAllResponded();
  }

  updateAreAllResponded(): void {
    this.areAllResponded = this.participants.every((p) => p.isResponded);
  }

  allSelected(): boolean {
    const eligibleParticipants = this.participants.filter(
      (p) => !p.isResponded
    );
    return (
      eligibleParticipants.length > 0 &&
      eligibleParticipants.every((p) => p.selected)
    );
  }

  someSelected(): boolean {
    const eligibleParticipants = this.participants.filter(
      (p) => !p.isResponded
    );
    return eligibleParticipants.some((p) => p.selected) && !this.allSelected();
  }

  confirm(): void {
    if (this.sendForm.valid && this.selectedParticipants.length > 0) {
      this.dialogRef.close({
        selectedTemplate: this.sendForm.get('template')?.value,
        selectedParticipants: this.selectedParticipants,
      });
    }
  }
}
