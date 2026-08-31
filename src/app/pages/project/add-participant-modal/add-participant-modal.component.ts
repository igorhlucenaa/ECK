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
  runTransaction,
  increment,
  query,
  where,
  Timestamp,
} from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { debounceTime, Subject } from 'rxjs';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { ParticipantValidationService } from 'src/app/services/participant-validation.service';

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
  imports: [MaterialModule, CommonModule, FormsModule, ReactiveFormsModule, TranslateModule],
  template: `
    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="ap-header">
      <div class="ap-header__avatar" [class.ap-header__avatar--filled]="participantForm.get('name')?.value">
        <span *ngIf="participantForm.get('name')?.value">
          {{ participantForm.get('name')?.value?.charAt(0)?.toUpperCase() }}
        </span>
        <mat-icon *ngIf="!participantForm.get('name')?.value">person_add</mat-icon>
      </div>
      <div class="ap-header__text">
        <h2 class="ap-header__title">Adicionar Participante</h2>
        <p class="ap-header__sub">
          {{ participantForm.get('name')?.value || 'Preencha os dados abaixo' }}
        </p>
      </div>
      <button mat-icon-button class="ap-header__close" (click)="dialogRef.close()">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <!-- ── Loading ────────────────────────────────────────────── -->
    <div class="ap-loading" *ngIf="isLoading">
      <mat-spinner [diameter]="36"></mat-spinner>
      <span>{{ 'Carregando dados...' | translate }}</span>
    </div>

    <!-- ── No clients ─────────────────────────────────────────── -->
    <div class="ap-empty" *ngIf="!isLoading && !hasClients">
      <mat-icon>warning_amber</mat-icon>
      <p>Nenhum cliente disponível. Tente novamente mais tarde.</p>
    </div>

    <!-- ── Form ───────────────────────────────────────────────── -->
    <mat-dialog-content class="ap-body" *ngIf="!isLoading && hasClients">
      <form [formGroup]="participantForm">

        <!-- Contexto: cliente + projeto (somente leitura quando pré-definidos) -->
        <div class="ap-context-row" *ngIf="isClientDisabled && isProjectDisabled">
          <div class="ap-context-chip">
            <mat-icon>business</mat-icon>
            <span>{{ clients[0]?.name }}</span>
          </div>
          <mat-icon class="ap-context-sep">chevron_right</mat-icon>
          <div class="ap-context-chip ap-context-chip--project">
            <mat-icon>folder_open</mat-icon>
            <span>{{ filteredProjects[0]?.name }}</span>
          </div>
        </div>

        <!-- Seletores de cliente/projeto (quando não pré-definidos) -->
        <div class="ap-fields-row" *ngIf="!isClientDisabled || !isProjectDisabled">
          <mat-form-field appearance="outline" class="ap-field" *ngIf="!isClientDisabled">
            <mat-label>Cliente</mat-label>
            <mat-icon matPrefix class="ap-prefix-icon">business</mat-icon>
            <mat-select formControlName="clientId" (selectionChange)="onClientChange()">
              <mat-option *ngFor="let client of clients" [value]="client.id">{{ client.name }}</mat-option>
            </mat-select>
            <mat-error *ngIf="participantForm.get('clientId')?.hasError('required')">Obrigatório</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="ap-field" *ngIf="!isProjectDisabled">
            <mat-label>Projeto</mat-label>
            <mat-icon matPrefix class="ap-prefix-icon">folder_open</mat-icon>
            <mat-select formControlName="projectId" [disabled]="!participantForm.get('clientId')?.value">
              <mat-option *ngFor="let project of filteredProjects" [value]="project.id">{{ project.name }}</mat-option>
            </mat-select>
            <mat-error *ngIf="participantForm.get('projectId')?.hasError('required')">Obrigatório</mat-error>
          </mat-form-field>
        </div>

        <div class="ap-divider"></div>

        <!-- Nome -->
        <mat-form-field appearance="outline" class="ap-field ap-field--full">
          <mat-label>Nome completo</mat-label>
          <mat-icon matPrefix class="ap-prefix-icon">person</mat-icon>
          <input matInput formControlName="name" placeholder="Ex: João da Silva" />
          <mat-error *ngIf="participantForm.get('name')?.hasError('required')">Nome é obrigatório</mat-error>
        </mat-form-field>

        <!-- E-mail -->
        <mat-form-field appearance="outline" class="ap-field ap-field--full">
          <mat-label>E-mail</mat-label>
          <mat-icon matPrefix class="ap-prefix-icon">email</mat-icon>
          <input matInput formControlName="email" type="email" placeholder="exemplo@empresa.com" />
          <mat-error *ngIf="participantForm.get('email')?.hasError('required')">E-mail é obrigatório</mat-error>
          <mat-error *ngIf="participantForm.get('email')?.hasError('email')">E-mail inválido</mat-error>
          <mat-error *ngIf="participantForm.get('email')?.hasError('duplicateEmail')">Este avaliador já foi adicionado ao projeto.</mat-error>
        </mat-form-field>

        <!-- Categoria -->
        <mat-form-field appearance="outline" class="ap-field ap-field--full">
          <mat-label>Categoria</mat-label>
          <mat-icon matPrefix class="ap-prefix-icon">group</mat-icon>
          <mat-select formControlName="category" (selectionChange)="onCategoryChange()">
            <mat-option value="Avaliado">
              <div class="ap-option"><span class="ap-option__dot ap-option__dot--avaliado"></span>Avaliado</div>
            </mat-option>
            <mat-option value="Gestor">
              <div class="ap-option"><span class="ap-option__dot ap-option__dot--gestor"></span>Gestor</div>
            </mat-option>
            <mat-option value="Par">
              <div class="ap-option"><span class="ap-option__dot ap-option__dot--par"></span>Par</div>
            </mat-option>
            <mat-option value="Subordinado">
              <div class="ap-option"><span class="ap-option__dot ap-option__dot--subordinado"></span>Subordinado</div>
            </mat-option>
            <mat-option value="Outros">
              <div class="ap-option"><span class="ap-option__dot ap-option__dot--outros"></span>Outros</div>
            </mat-option>
          </mat-select>
          <mat-hint *ngIf="participantForm.get('category')?.value === 'Avaliado'">Tipo: <strong>avaliado</strong></mat-hint>
          <mat-hint *ngIf="participantForm.get('category')?.value && participantForm.get('category')?.value !== 'Avaliado'">Tipo: <strong>avaliador</strong></mat-hint>
          <mat-error *ngIf="participantForm.get('category')?.hasError('required')">Categoria é obrigatória</mat-error>
        </mat-form-field>

      </form>
    </mat-dialog-content>

    <!-- ── Actions ────────────────────────────────────────────── -->
    <mat-dialog-actions class="ap-actions" *ngIf="!isLoading && hasClients">
      <button mat-button class="ap-btn-cancel" (click)="dialogRef.close()">Cancelar</button>
      <button mat-flat-button class="ap-btn-save"
        (click)="onAddParticipantClick()"
        [disabled]="!participantForm.valid || isSaving">
        <mat-spinner *ngIf="isSaving" [diameter]="18" class="ap-spinner"></mat-spinner>
        <mat-icon *ngIf="!isSaving">person_add</mat-icon>
        {{ isSaving ? 'Salvando...' : 'Adicionar Participante' }}
      </button>
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
    private snackBar: MatSnackBar,
    private participantValidationService: ParticipantValidationService,
    private translate: TranslateService
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
      this.snackBar.open(this.translate.instant('Erro ao carregar dados.'), this.translate.instant('Fechar'), {
        duration: 3000,
      });
    } finally {
      this.isLoading = false;
    }

    // Validação de e-mail duplicado em tempo real (debounce 500 ms)
    this.participantForm.get('email')!.valueChanges
      .pipe(debounceTime(500))
      .subscribe(async (email: string) => {
        const ctrl = this.participantForm.get('email')!;
        const projectId = this.participantForm.get('projectId')!.value;
        if (!email || !projectId || ctrl.hasError('email') || ctrl.hasError('required')) return;
        const emailNorm = email.trim().toLowerCase();
        const snap = await getDocs(
          query(
            collection(this.firestore, 'participants'),
            where('projectId', '==', projectId),
            where('emailLower', '==', emailNorm)
          )
        );
        if (!snap.empty) {
          ctrl.setErrors({ ...ctrl.errors, duplicateEmail: true });
        } else {
          const { duplicateEmail: _dup, ...rest } = ctrl.errors ?? {};
          ctrl.setErrors(Object.keys(rest).length ? rest : null);
        }
      });
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
      this.snackBar.open(this.translate.instant('Erro ao carregar cliente ou projeto.'), this.translate.instant('Fechar'), {
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
    if (this.participantForm.invalid || this.isSaving) return;

    this.isSaving = true;

    try {
      const formValue = this.participantForm.value;
      const category = formValue.category;
      const type = category === 'Avaliado' ? 'avaliado' : 'avaliador';
      const clientId: string = formValue.clientId;
      const projectId: string = formValue.projectId;
      const emailNorm = (formValue.email as string).trim().toLowerCase();

      // Validar se já existe avaliado no projeto (máximo 1 avaliado por projeto)
      const validation = await this.participantValidationService.validateSingleEvaluateePerProject(
        projectId,
        category
      );
      if (!validation.valid) {
        this.snackBar.open(
          `Este projeto já possui um avaliado cadastrado (${validation.existingEvaluateeName}). É permitido apenas um avaliado por projeto.`,
          'Fechar',
          { duration: 5000 }
        );
        this.isSaving = false;
        return;
      }

      const projectName =
        this.filteredProjects.find(p => p.id === projectId)?.name ||
        this.projects.find(p => p.id === projectId)?.name ||
        'projeto';

      // Avaliador exige que o projeto já tenha um avaliado definido.
      let avaliadoIdParaVincular: string | undefined;
      if (type === 'avaliador') {
        const existsCheck = await this.participantValidationService.validateAvaliadoExistsForProject(
          projectId,
          projectName
        );
        if (!existsCheck.valid) {
          this.snackBar.open(existsCheck.error || 'Cadastre o avaliado primeiro.', 'Fechar', { duration: 6000 });
          this.isSaving = false;
          return;
        }
        avaliadoIdParaVincular = existsCheck.avaliadoId;
      }

      // Verifica duplicidade de e-mail no projeto (case-insensitive)
      const dupSnap = await getDocs(
        query(
          collection(this.firestore, 'participants'),
          where('projectId', '==', projectId),
          where('emailLower', '==', emailNorm)
        )
      );
      if (!dupSnap.empty) {
        const err: any = new Error('E-mail já cadastrado neste projeto.');
        err.code = 'duplicate-email';
        throw err;
      }

      if (type === 'avaliado') {
        await this.registerEvaluateeWithCredit(formValue, clientId, projectId, emailNorm);
      } else {
        await addDoc(collection(this.firestore, 'participants'), {
          name: formValue.name,
          email: formValue.email,
          emailLower: emailNorm,
          clientId,
          projectId,
          type,
          category,
          avaliadoId: avaliadoIdParaVincular,
          createdAt: new Date(),
        });
      }

        this.snackBar.open(this.translate.instant('Participante adicionado com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
      this.dialogRef.close(true);
    } catch (error: any) {
      if (error?.code === 'duplicate-email') {
        this.snackBar.open(
          'Este avaliador já foi adicionado ao projeto.',
          'Fechar',
          { duration: 5000 }
        );
      } else if (error?.code === 'insufficient-credits') {
        this.snackBar.open(
          'Créditos insuficientes. Adquira mais créditos para continuar.',
          'Comprar Créditos',
          { duration: 8000 }
        );
      } else {
        console.error('Erro ao adicionar participante:', error);
        this.snackBar.open(this.translate.instant('Erro ao adicionar participante.'), this.translate.instant('Fechar'), { duration: 3000 });
      }
    } finally {
      this.isSaving = false;
    }
  }

  private async registerEvaluateeWithCredit(
    formValue: any,
    clientId: string,
    projectId: string,
    emailLower: string
  ): Promise<void> {
    const now = Timestamp.now();

    // FIFO: busca todos os pedidos aprovados do cliente e filtra/ordena em memória
    // (múltiplos filtros de desigualdade no Firestore exigem índice composto — evitamos aqui)
    const orderSnap = await getDocs(
      query(
        collection(this.firestore, 'creditOrders'),
        where('clientId', '==', clientId),
        where('status', '==', 'Aprovado'),
      )
    );

    const nowMs = Date.now();
    const validOrders = orderSnap.docs
      .filter(d => {
        const data = d.data();
        const validity = data['validityDate'] as Timestamp | undefined;
        const remaining = (data['remainingCredits'] as number) ?? 0;
        return remaining > 0 && (!validity || validity.toMillis() >= nowMs);
      })
      .sort((a, b) => {
        const aMs = (a.data()['createdAt'] as Timestamp)?.toMillis() ?? 0;
        const bMs = (b.data()['createdAt'] as Timestamp)?.toMillis() ?? 0;
        return aMs - bMs;
      });

    if (validOrders.length === 0) {
      const err: any = new Error('Créditos insuficientes.');
      err.code = 'insufficient-credits';
      throw err;
    }

    const orderRef = validOrders[0].ref;
    const clientRef = doc(this.firestore, `clients/${clientId}`);
    const participantRef = doc(collection(this.firestore, 'participants'));
    const txRef = doc(collection(this.firestore, 'creditTransactions'));

    await runTransaction(this.firestore, async (t) => {
      const freshClient = await t.get(clientRef);
      const freshOrder = await t.get(orderRef);

      const clientCredits: number = freshClient.data()?.['credits'] ?? 0;
      const orderRemaining: number = freshOrder.data()?.['remainingCredits'] ?? 0;
      const orderValidity: Timestamp | undefined = freshOrder.data()?.['validityDate'];

      if (clientCredits < 1 || orderRemaining < 1) {
        const err: any = new Error('Créditos insuficientes.');
        err.code = 'insufficient-credits';
        throw err;
      }

      if (orderValidity && orderValidity.toMillis() < Date.now()) {
        const err: any = new Error('Créditos insuficientes.');
        err.code = 'insufficient-credits';
        throw err;
      }

      t.set(participantRef, {
        name: formValue.name,
        email: formValue.email,
        emailLower,
        clientId,
        projectId,
        type: 'avaliado',
        category: formValue.category,
        createdAt: Timestamp.now(),
        creditReserved: true,
        creditConsumed: false,
        orderId: orderRef.id,
      });

      t.update(clientRef, {
        credits: increment(-1),
        reservedCredits: increment(1),
      });

      t.update(orderRef, {
        remainingCredits: increment(-1),
      });

      t.set(txRef, {
        type: 'reserve',
        clientId,
        projectId,
        participantId: participantRef.id,
        orderId: orderRef.id,
        createdAt: Timestamp.now(),
      });
    });
  }
}
