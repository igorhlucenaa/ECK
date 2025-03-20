import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  FormBuilder,
  FormGroup,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  clientId: string;
}

interface ModalData {
  clients: Client[];
  projects: Project[];
}

@Component({
  selector: 'app-add-participant-modal',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>Adicionar Novo Participante</h2>
    <mat-dialog-content>
      <form [formGroup]="participantForm">
        <!-- Cliente -->
        <mat-form-field
          class="w-100 mb-3"
          appearance="outline"
          style="margin-top: 15px"
        >
          <mat-label>Cliente</mat-label>
          <mat-select
            formControlName="clientId"
            required
            (selectionChange)="onClientChange()"
          >
            <mat-option *ngFor="let client of data.clients" [value]="client.id">
              {{ client.name }}
            </mat-option>
          </mat-select>
          <mat-error
            *ngIf="participantForm.get('clientId')?.hasError('required')"
          >
            Cliente é obrigatório.
          </mat-error>
        </mat-form-field>

        <!-- Projeto -->
        <mat-form-field class="w-100 mb-3" appearance="outline">
          <mat-label>Projeto</mat-label>
          <mat-select
            formControlName="projectId"
            required
            [disabled]="!participantForm.get('clientId')?.value"
          >
            <mat-option
              *ngFor="let project of filteredProjects"
              [value]="project.id"
            >
              {{ project.name }}
            </mat-option>
          </mat-select>
          <mat-error
            *ngIf="participantForm.get('projectId')?.hasError('required')"
          >
            Projeto é obrigatório.
          </mat-error>
        </mat-form-field>

        <!-- Nome -->
        <mat-form-field class="w-100 mb-3" appearance="outline">
          <mat-label>Nome</mat-label>
          <input matInput formControlName="name" required />
          <mat-error *ngIf="participantForm.get('name')?.hasError('required')">
            Nome é obrigatório.
          </mat-error>
        </mat-form-field>

        <!-- E-mail -->
        <mat-form-field class="w-100 mb-3" appearance="outline">
          <mat-label>E-mail</mat-label>
          <input matInput formControlName="email" required type="email" />
          <mat-error *ngIf="participantForm.get('email')?.hasError('required')">
            E-mail é obrigatório.
          </mat-error>
          <mat-error *ngIf="participantForm.get('email')?.hasError('email')">
            Insira um e-mail válido.
          </mat-error>
        </mat-form-field>

        <!-- Categoria -->
        <mat-form-field class="w-100 mb-3" appearance="outline">
          <mat-label>Categoria</mat-label>
          <mat-select
            formControlName="category"
            required
            (selectionChange)="onCategoryChange()"
          >
            <mat-option value="Avaliado">Avaliado</mat-option>
            <mat-option value="Gestor">Gestor</mat-option>
            <mat-option value="Par">Par</mat-option>
            <mat-option value="Subordinado">Subordinado</mat-option>
            <mat-option value="Outros">Outros</mat-option>
          </mat-select>
          <mat-error
            *ngIf="participantForm.get('category')?.hasError('required')"
          >
            Categoria é obrigatória.
          </mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        (click)="addParticipant()"
        [disabled]="!participantForm.valid || isSaving"
      >
        <mat-spinner *ngIf="isSaving" [diameter]="20"></mat-spinner>
        <span *ngIf="isSaving">Salvando...</span>
        <span *ngIf="!isSaving">Adicionar</span>
      </button>
      <button mat-button mat-dialog-close>Cancelar</button>
    </mat-dialog-actions>
  `,
  styleUrls: ['./add-participant-modal.component.scss'],
})
export class AddParticipantModalComponent {
  participantForm: FormGroup;
  isSaving: boolean = false;
  filteredProjects: Project[] = [];

  constructor(
    public dialogRef: MatDialogRef<AddParticipantModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ModalData,
    private fb: FormBuilder,
    private firestore: Firestore,
    private snackBar: MatSnackBar
  ) {
    this.participantForm = this.fb.group({
      clientId: ['', Validators.required],
      projectId: ['', Validators.required],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      category: ['', Validators.required],
    });
  }

  onClientChange(): void {
    const clientId = this.participantForm.get('clientId')?.value;
    if (clientId) {
      this.filteredProjects = this.data.projects.filter(
        (project) => project.clientId === clientId
      );
      this.participantForm.get('projectId')?.setValue(''); // Reseta o projeto ao mudar o cliente
    } else {
      this.filteredProjects = [];
      this.participantForm.get('projectId')?.setValue('');
    }
  }

  onCategoryChange(): void {
    // Não é necessário ajustar validators, apenas determinar o tipo ao salvar
  }

  async addParticipant(): Promise<void> {
    if (this.participantForm.invalid) return;

    this.isSaving = true;
    try {
      const formValue = this.participantForm.value;
      const category = formValue.category;
      const type = category === 'Avaliado' ? 'avaliado' : 'avaliador';

      const participantData = {
        name: formValue.name,
        email: formValue.email,
        clientId: formValue.clientId,
        projectId: formValue.projectId,
        type: type,
        category: category,
        createdAt: new Date(),
      };

      await addDoc(collection(this.firestore, 'participants'), participantData);

      this.snackBar.open('Participante adicionado com sucesso!', 'Fechar', {
        duration: 3000,
      });
      this.dialogRef.close(true); // Retorna true para indicar que o participante foi adicionado
    } catch (error) {
      console.error('Erro ao adicionar participante:', error);
      this.snackBar.open('Erro ao adicionar participante.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isSaving = false;
    }
  }
}
