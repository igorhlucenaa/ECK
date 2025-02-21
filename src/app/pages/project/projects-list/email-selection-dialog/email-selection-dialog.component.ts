import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { MatTableDataSource } from '@angular/material/table';
import { EmailService } from './email.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-email-selection-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: './email-selection-dialog.component.html',
  styleUrls: ['./email-selection-dialog.component.scss'],
})
export class EmailSelectionDialogComponent implements OnInit {
  emailType: any;
  selectedAssessmentId: string | any = null; // Armazenar o ID da avaliação selecionada
  assessments: any[] = []; // Array para armazenar as avaliações disponíveis
  dataSource = new MatTableDataSource<any>([]);
  selectedParticipants = new Set<string>();
  isLoading = signal(false);
  searchValue = signal('');

  displayedColumns: string[] = ['select', 'name', 'email', 'category'];

  constructor(
    private dialogRef: MatDialogRef<EmailSelectionDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: { projectId: string; templateId: string; emailType: string },
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private emailService: EmailService // Injetando o EmailService
  ) {}

  ngOnInit(): void {
    this.emailType = this.data.emailType;
    this.loadParticipants();
    this.loadAssessments(); // Carregar as avaliações disponíveis
    console.log('data =====> ', this.data);
  }

  async loadParticipants() {
    this.isLoading.set(true);
    this.dataSource.data = [];

    const participantsCollection = collection(this.firestore, 'participants');
    const snapshot = await getDocs(participantsCollection);

    const participants = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data()['name'],
      email: doc.data()['email'],
      category: doc.data()['category'],
      selected: false, // Para controle de seleção
    }));

    this.dataSource.data = participants;
    this.isLoading.set(false);
  }

  async loadAssessments() {
    const assessmentsCollection = collection(this.firestore, 'assessments');
    const snapshot = await getDocs(assessmentsCollection);

    this.assessments = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data()['name'], // Supondo que cada avaliação tenha um campo "name"
    }));
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value
      .trim()
      .toLowerCase();
    this.searchValue.set(filterValue);
    this.dataSource.filter = filterValue;
  }

  toggleSelection(participant: any) {
    if (this.selectedParticipants.has(participant.email)) {
      this.selectedParticipants.delete(participant.email);
    } else {
      this.selectedParticipants.add(participant.email);
    }
  }

  selectAll(event: any) {
    if (event.checked) {
      this.selectedParticipants = new Set(
        this.dataSource.data.map((p) => p.email)
      );
    } else {
      this.selectedParticipants.clear();
    }
  }

  sendEmails() {
    if (this.selectedParticipants.size === 0) {
      this.snackBar.open('Selecione ao menos um destinatário.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    if (!this.selectedAssessmentId) {
      this.snackBar.open('Selecione uma avaliação.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    // Enviar e-mails para os participantes selecionados
    this.selectedParticipants.forEach((email) => {
      const participant = this.dataSource.data.find((p) => p.email === email);
      if (participant) {
        // Enviar e-mail usando o serviço
        this.emailService
          .sendEmail(
            participant.email,
            this.data.templateId,
            participant.id,
            this.selectedAssessmentId // Passando o ID da avaliação selecionada
          )
          .subscribe({
            next: () => {
              this.snackBar.open(
                'E-mail enviado para ' + participant.name,
                'Fechar',
                {
                  duration: 3000,
                }
              );
            },
            error: (err) => {
              console.error('Erro ao enviar e-mail:', err);
              this.snackBar.open('Erro ao enviar e-mail.', 'Fechar', {
                duration: 3000,
              });
            },
          });
      }
    });

    this.dialogRef.close();
  }

  close() {
    this.dialogRef.close();
  }
}
