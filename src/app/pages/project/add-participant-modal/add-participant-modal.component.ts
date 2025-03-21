import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
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
  getDocs,
  getDoc,
  doc,
  addDoc,
} from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { debounceTime, Subject } from 'rxjs';

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
  clientId?: string;
  projectId?: string;
  clients?: Client[];
  projects?: Project[];
}

@Component({
  selector: 'app-add-participant-modal',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>Adicionar Novo Participante</h2>
    <mat-dialog-content>
      <!-- Exibir estado de carregamento -->
      <div *ngIf="isLoading" class="text-center my-4">
        <mat-spinner [diameter]="40"></mat-spinner>
        <p>Carregando dados...</p>
      </div>

      <!-- Exibir mensagem de erro se não houver clientes -->
      <div *ngIf="!isLoading && !hasClients" class="text-center my-4">
        <p>Nenhum cliente disponível. Por favor, tente novamente mais tarde.</p>
      </div>

      <!-- Exibir formulário quando os dados estiverem carregados -->
      <form [formGroup]="participantForm" *ngIf="!isLoading && hasClients">
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
            [disabled]="isClientDisabled"
          >
            <mat-option *ngFor="let client of clients" [value]="client.id">
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
            [disabled]="
              isProjectDisabled || !participantForm.get('clientId')?.value
            "
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
        (click)="onAddParticipantClick()"
        [disabled]="
          !participantForm.valid || isSaving || isLoading || !hasClients
        "
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
export class AddParticipantModalComponent implements OnInit {
  participantForm: FormGroup;
  isSaving: boolean = false;
  isLoading: boolean = true;
  clients: Client[] = [];
  projects: Project[] = [];
  filteredProjects: Project[] = [];
  isClientDisabled: boolean = false;
  isProjectDisabled: boolean = false;
  hasClients: boolean = false;

  // Subject para debounce do clique
  private addParticipantSubject = new Subject<void>();

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

    // Configurar debounce para o evento de clique
    this.addParticipantSubject.pipe(debounceTime(300)).subscribe(() => {
      this.addParticipant();
    });
  }

  async ngOnInit(): Promise<void> {
    this.isLoading = true;
    try {
      // Se clientId e projectId foram passados via data, usamos eles e desabilitamos os campos
      if (this.data?.clientId && this.data?.projectId) {
        // Verificar se data.clients e data.projects foram fornecidos
        if (this.data.clients && this.data.projects) {
          this.clients = this.data.clients;
          this.projects = this.data.projects;
        } else {
          // Caso contrário, buscar apenas o cliente e projeto específicos
          await this.loadClientAndProjectNames();
        }

        this.participantForm.patchValue({
          clientId: this.data.clientId,
          projectId: this.data.projectId,
        });
        this.isClientDisabled = true;
        this.isProjectDisabled = true;
        this.filteredProjects = this.projects.filter(
          (project) => project.id === this.data.projectId
        );
      } else {
        // Caso contrário, buscamos os dados do Firestore
        if (this.data?.clients && this.data?.projects) {
          this.clients = this.data.clients;
          this.projects = this.data.projects;
        } else {
          await Promise.all([this.loadClients(), this.loadProjects()]);
        }
        this.onClientChange(); // Inicializar filteredProjects com base no clientId selecionado
      }
      this.hasClients = this.clients.length > 0;
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.snackBar.open('Erro ao carregar dados.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isLoading = false;
    }
  }

  async loadClientAndProjectNames(): Promise<void> {
    try {
      // Buscar o nome do cliente
      const clientDoc = await getDoc(
        doc(this.firestore, 'clients', this.data.clientId!)
      );
      if (clientDoc.exists()) {
        this.clients = [
          {
            id: this.data.clientId!,
            name: clientDoc.data()['companyName'] || 'Cliente Sem Nome',
          },
        ];
      } else {
        this.clients = [
          {
            id: this.data.clientId!,
            name: 'Cliente Desconhecido',
          },
        ];
      }

      // Buscar o nome do projeto
      const projectDoc = await getDoc(
        doc(this.firestore, 'projects', this.data.projectId!)
      );
      if (projectDoc.exists()) {
        this.projects = [
          {
            id: this.data.projectId!,
            name: projectDoc.data()['name'] || 'Projeto Sem Nome',
            clientId: this.data.clientId!,
          },
        ];
      } else {
        this.projects = [
          {
            id: this.data.projectId!,
            name: 'Projeto Desconhecido',
            clientId: this.data.clientId!,
          },
        ];
      }
    } catch (error) {
      console.error('Erro ao carregar nomes do cliente e projeto:', error);
      this.snackBar.open('Erro ao carregar cliente ou projeto.', 'Fechar', {
        duration: 3000,
      });
      throw error;
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
      console.log('Clientes carregados no modal:', this.clients);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      throw error;
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
      console.log('Projetos carregados no modal:', this.projects);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      throw error;
    }
  }

  onClientChange(): void {
    const clientId = this.participantForm.get('clientId')?.value;
    if (clientId) {
      this.filteredProjects = this.projects.filter(
        (project) => project.clientId === clientId
      );
      // Só resetar o projectId se o campo de cliente não estiver desabilitado
      if (!this.isClientDisabled) {
        this.participantForm.get('projectId')?.setValue('');
      }
    } else {
      this.filteredProjects = [];
      this.participantForm.get('projectId')?.setValue('');
    }
  }

  onCategoryChange(): void {
    // Não é necessário ajustar validators, apenas determinar o tipo ao salvar
  }

  // Método chamado pelo botão "Adicionar"
  onAddParticipantClick(): void {
    console.log('Botão Adicionar clicado');
    this.addParticipantSubject.next();
  }

  async addParticipant(): Promise<void> {
    if (this.participantForm.invalid || this.isSaving) {
      console.log('Formulário inválido ou salvamento em andamento');
      return;
    }

    this.isSaving = true;
    console.log('Iniciando salvamento do participante...');

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

      console.log('Dados do participante a serem salvos:', participantData);

      const docRef = await addDoc(
        collection(this.firestore, 'participants'),
        participantData
      );
      console.log('Participante salvo com ID:', docRef.id);

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
      console.log('Salvamento concluído');
    }
  }
}
