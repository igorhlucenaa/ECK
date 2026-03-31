import { Component, Inject, OnInit } from '@angular/core';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  MatDialogRef,
  MatDialogModule,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  addDoc,
} from '@angular/fire/firestore';
import {
  Auth,
  fetchSignInMethodsForEmail,
} from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { updateDoc, doc } from '@angular/fire/firestore';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, of, timer } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-create-user',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    CommonModule,
    TranslateModule,
  ],
  templateUrl: './create-user.component.html',
  styleUrls: ['./create-user.component.scss'],
})
export class CreateUserComponent implements OnInit {
  userForm!: FormGroup;
  clients: { id: string; name: string }[] = [];
  projects: { id: string; name: string }[] = [];
  groups: { id: string; name: string }[] = [];
  roles = [
    { label: 'Admin Master', value: 'admin_master' },
    { label: 'Admin Cliente', value: 'admin_client' },
    { label: 'Visualizador', value: 'viewer' },
  ];
  isEditMode = false;
  emailChecking = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateUserComponent>,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private auth: Auth,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private router: Router,
    private authService: AuthService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadClients().then(async () => {
      const userRole = await this.getCurrentUserRole();

      if (userRole === 'admin_client') {
        this.roles = this.roles.filter((role) =>
          ['admin_client', 'viewer'].includes(role.value)
        );
      }

      if (this.data?.user) {
        this.isEditMode = true;
        this.prefillForm(this.data.user); // Carrega os valores no modo de edição
      }
    });
  }

  private async getCurrentUserRole(): Promise<string | null> {
    try {
      const role = await this.authService.getCurrentUserRole();
      return role;
    } catch (error) {
      console.error('Erro ao obter role do usuário atual:', error);
      return null;
    }
  }

  private initializeForm(): void {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      surname: ['', Validators.required],
      email: ['', [Validators.required, Validators.email], [this.emailUniqueValidator()]],
      password: [''],
      client: [''],
      project: [''],
      group: [''],
      role: ['', Validators.required],
    });
  }

  // ─── Validador assíncrono de unicidade de e-mail ─────────────
  private emailUniqueValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      // Em modo de edição o e-mail não muda — sem verificação
      if (this.isEditMode) return of(null);

      const raw = (control.value || '').toString().trim();
      if (!raw || !raw.includes('@')) return of(null);

      const email = raw.toLowerCase();
      this.emailChecking = true;

      // Debounce: aguarda 600ms após parar de digitar antes de consultar
      return timer(600).pipe(
        switchMap(() => {
          const usersCol = collection(this.firestore, 'users');
          return new Observable<ValidationErrors | null>(observer => {
            const rawEmail = (control.value || '').toString().trim();
            Promise.all([
              getDocs(query(usersCol, where('emailLower', '==', email))),
              getDocs(query(usersCol, where('email', '==', rawEmail))),
            ]).then(([snapLower, snapEmail]) => {
                this.emailChecking = false;
                const found = snapLower.empty ? snapEmail : snapLower;
                if (found.empty) {
                  observer.next(null);
                } else {
                  const status = found.docs[0].data()['status'];
                  observer.next(status === 'inactive'
                    ? { emailExistsInactive: true }
                    : { emailExists: true });
                }
                observer.complete();
              })
              .catch(() => { this.emailChecking = false; observer.next(null); observer.complete(); });
          });
        }),
        catchError(() => { this.emailChecking = false; return of(null); })
      );
    };
  }

  get emailCtrl() { return this.userForm.get('email')!; }

  private async prefillForm(user: any): Promise<void> {

    // Obtém o ID do cliente correspondente ao nome (se necessário)
    const clientId = this.clients.find(
      (client) => client.name === user.client
    )?.id;

    if (clientId) {

      // Aguarda o carregamento dos projetos e grupos
      await this.onClientChange(clientId);
    }

    // Após os dados serem carregados, preenche o formulário
    this.userForm.patchValue({
      name: user.name,
      surname: user.surname,
      email: user.email,
      role: user.role,
    });

    // Habilita campos desabilitados caso já estejam preenchidos
    if (user.project) {
      this.userForm.get('project')?.enable();
    }
    if (user.group) {
      this.userForm.get('group')?.enable();
    }
  }

  private async loadClients(): Promise<void> {
    try {
      const userRole = await this.getCurrentUserRole();
      const clientId = await this.authService.getCurrentClientId();

      if (userRole === 'admin_client' && clientId) {
        this.clients = [
          {
            id: clientId,
            name: 'Seu Cliente',
          },
        ];
        this.userForm.get('client')?.setValue(clientId);
        this.userForm.get('client')?.disable(); // Desabilita a seleção do cliente
      } else if (userRole === 'admin_master') {
        const clientsCollection = collection(this.firestore, 'clients');
        const snapshot = await getDocs(clientsCollection);
        this.clients = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data()['companyName'] || 'Sem Nome',
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open(this.translate.instant('Erro ao carregar clientes.'), this.translate.instant('Fechar'), {
        duration: 3000,
      });
    }
  }

  async onClientChange(clientId: string): Promise<void> {

    if (!clientId) {
      console.warn('Nenhum cliente válido selecionado.');
      return;
    }

    // Inicializa os campos dependentes
    this.projects = [];
    this.groups = [];
    this.userForm.patchValue({ project: '', group: '' });

    try {
      // Carrega projetos relacionados ao cliente
      const projectsCollection = collection(this.firestore, 'projects');
      const projectsQuery = query(
        projectsCollection,
        where('clientId', '==', clientId)
      );
      const projectsSnapshot = await getDocs(projectsQuery);
      this.projects = projectsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Sem Nome',
      }));

      // Carrega grupos relacionados ao cliente
      const groupsCollection = collection(this.firestore, 'userGroups');
      const groupsQuery = query(
        groupsCollection,
        where('clientId', '==', clientId)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      this.groups = groupsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Sem Nome',
      }));

                } catch (error) {
      console.error('Erro ao carregar projetos ou grupos:', error);
      this.snackBar.open(this.translate.instant('Erro ao carregar projetos ou grupos.'), this.translate.instant('Fechar'), {
        duration: 3000,
      });
    }
  }

  async saveUser(): Promise<void> {
    if (this.userForm.invalid || this.userForm.pending) return;

    // Bloquear se e-mail duplicado detectado pelo validador async
    if (this.emailCtrl.hasError('emailExists') || this.emailCtrl.hasError('emailExistsInactive')) {
      this.emailCtrl.markAsTouched();
      return;
    }

    const userRole = await this.getCurrentUserRole();
    const selectedRole = this.userForm.get('role')?.value;

    if (userRole === 'admin_client' && !['viewer', 'admin_client'].includes(selectedRole)) {
      this.snackBar.open(this.translate.instant('Você não tem permissão para atribuir este papel.'), this.translate.instant('Fechar'), { duration: 3000 });
      return;
    }

    try {
      const { name, surname, email, client, project, group, role } = this.userForm.value;
      const emailLower = (email || '').toLowerCase().trim();

      if (this.isEditMode) {
        const usersCollection = collection(this.firestore, 'users');
        const userQuery = query(usersCollection, where('email', '==', email));
        const querySnapshot = await getDocs(userQuery);

        if (!querySnapshot.empty) {
          await updateDoc(querySnapshot.docs[0].ref, {
            name, surname, email, emailLower, client, project, group, role,
            updatedAt: new Date(),
          });
          this.snackBar.open(this.translate.instant('Usuário atualizado com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
        } else {
          this.snackBar.open(this.translate.instant('Usuário não encontrado.'), this.translate.instant('Fechar'), { duration: 3000 });
        }
      } else {
        // Verificação dupla no momento de salvar (segurança adicional)
        const [snapLower, snapEmail] = await Promise.all([
          getDocs(query(collection(this.firestore, 'users'), where('emailLower', '==', emailLower))),
          getDocs(query(collection(this.firestore, 'users'), where('email', '==', email))),
        ]);
        const snap = snapLower.empty ? snapEmail : snapLower;
        if (!snap.empty) {
          const status = snap.docs[0].data()['status'];
          const msg = status === 'inactive'
            ? 'Este e-mail pertence a um usuário inativo. Reative o cadastro existente ou use outro e-mail.'
            : 'Este e-mail já está cadastrado na plataforma.';
          this.snackBar.open(this.translate.instant(msg), this.translate.instant('Fechar'), { duration: 5000 });
          this.emailCtrl.setErrors({ emailExists: true });
          return;
        }

        await addDoc(collection(this.firestore, 'users'), {
          name, surname, email, emailLower, client, project, group, role,
          status: 'active',
          createdAt: new Date(),
        });
        this.snackBar.open(this.translate.instant('Usuário criado com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
      }

      this.dialogRef.close(true);
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      this.snackBar.open(this.translate.instant(this.isEditMode ? 'Erro ao atualizar usuário.' : 'Erro ao criar usuário.'), this.translate.instant('Fechar'), { duration: 3000 });
    }
  }
}
