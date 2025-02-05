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

@Component({
  selector: 'app-email-selection-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './email-selection-dialog.component.html',
  styleUrls: ['./email-selection-dialog.component.scss'],
})
export class EmailSelectionDialogComponent implements OnInit {
  emailType: 'convite' | 'lembrete' | null = null;
  dataSource = new MatTableDataSource<any>([]);
  selectedParticipants = new Set<string>();
  isLoading = signal(false);
  searchValue = signal('');

  displayedColumns: string[] = ['select', 'name', 'email', 'category'];

  constructor(
    private dialogRef: MatDialogRef<EmailSelectionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { projectId: string },
    private firestore: Firestore,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadParticipants();
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

    // Simulação de envio de e-mails
    this.snackBar.open('E-mails enviados com sucesso!', 'Fechar', {
      duration: 3000,
    });
    this.dialogRef.close();
  }

  close() {
    this.dialogRef.close();
  }
}
