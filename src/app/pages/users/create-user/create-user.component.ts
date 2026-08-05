import { Component, Inject, OnInit } from '@angular/core';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
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
  arrayUnion,
  arrayRemove,
} from '@angular/fire/firestore';
import {
  Auth,
  sendPasswordResetEmail,
  ActionCodeSettings,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from '@angular/fire/auth';
import { FirebaseApp } from '@angular/fire/app';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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

  // Grupos para seleção (viewer)
  allGroups: { id: string; name: string; clientId: string; clientName: string; projectIds: string[]; projectNames: string[] }[] = [];
  filteredGroups: typeof this.allGroups = [];
  clientFilterCtrl = new FormControl('');
  derivedClientName = '';
  derivedProjectNames: string[] = [];

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
    private firebaseApp: FirebaseApp,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private router: Router,
    private authService: AuthService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadClients().then(async () => {
      const userRole = await this.getCurrentUserRole();

      // ADM Cliente não pode criar ou editar usuários — fecha o dialog imediatamente
      if (userRole === 'admin_client') {
        this.snackBar.open(
          this.translate.instant('ADM Cliente não possui permissão para criar ou editar usuários.'),
          this.translate.instant('Fechar'),
          { duration: 5000 }
        );
        this.dialogRef.close(false);
        return;
      }

      if (this.data?.user) {
        this.isEditMode = true;
        this.prefillForm(this.data.user);
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

  private groupsRequiredValidator(): ValidatorFn {
    return (ctrl: AbstractControl): ValidationErrors | null =>
      Array.isArray(ctrl.value) && ctrl.value.length > 0 ? null : { groupRequired: true };
  }

  private initializeForm(): void {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      surname: ['', Validators.required],
      email: ['', [Validators.required, Validators.email], [this.emailUniqueValidator()]],
      password: [''],
      clients: [[] as string[]],
      groups: [[] as string[]],
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

  get selectedRole(): string { return this.userForm.get('role')?.value || ''; }

  onRoleChange(role: string): void {
    const clientsCtrl = this.userForm.get('clients')!;
    const groupsCtrl = this.userForm.get('groups')!;

    clientsCtrl.clearValidators(); clientsCtrl.setValue([]);
    groupsCtrl.clearValidators(); groupsCtrl.setValue([]);
    this.derivedClientName = ''; this.derivedProjectNames = [];
    this.filteredGroups = []; this.clientFilterCtrl.setValue('');

    if (role === 'admin_client') {
      clientsCtrl.setValidators([Validators.required]);
    } else if (role === 'viewer') {
      groupsCtrl.setValidators([this.groupsRequiredValidator()]);
      this.loadAllGroups().then(() => {
        this.filteredGroups = [...this.allGroups];
      });
    }

    clientsCtrl.updateValueAndValidity();
    groupsCtrl.updateValueAndValidity();
  }

  onClientFilterChange(clientId: string): void {
    this.filteredGroups = clientId
      ? this.allGroups.filter(g => g.clientId === clientId)
      : [...this.allGroups];
    // Limpa grupos selecionados se não pertencem mais ao filtro
    const current: string[] = this.userForm.get('groups')?.value || [];
    const valid = current.filter(id => this.filteredGroups.some(g => g.id === id));
    if (valid.length !== current.length) {
      this.userForm.get('groups')?.setValue(valid);
      this.onGroupsChange(valid);
    }
  }

  onGroupsChange(groupIds: string[]): void {
    if (!groupIds?.length) {
      this.derivedClientName = ''; this.derivedProjectNames = []; return;
    }
    const selected = this.allGroups.filter(g => groupIds.includes(g.id));
    this.derivedClientName = selected[0]?.clientName || '';
    const projSet = new Set<string>();
    selected.forEach(g => g.projectNames.forEach(p => projSet.add(p)));
    this.derivedProjectNames = [...projSet];
  }

  private async prefillForm(user: any): Promise<void> {
    const existingClients: string[] = Array.isArray(user.clients)
      ? user.clients : user.client ? [user.client] : [];
    const existingGroups: string[] = Array.isArray(user.groups) ? user.groups : [];

    if (user.role) this.onRoleChange(user.role);
    if (this.allGroups.length === 0) await this.loadAllGroups();

    this.userForm.patchValue({
      name: user.name,
      surname: user.surname,
      email: user.email,
      role: user.role,
      clients: existingClients,
      groups: existingGroups,
    });

    if (existingGroups.length > 0) this.onGroupsChange(existingGroups);
  }

  private async loadClients(): Promise<void> {
    try {
      const userRole = await this.getCurrentUserRole();
      const clientsCollection = collection(this.firestore, 'clients');
      let snapshot;

      if (userRole === 'admin_client') {
        const clientIds = await this.authService.getCurrentUserClientIds();
        if (clientIds.length === 0) { this.clients = []; return; }
        snapshot = await getDocs(query(clientsCollection, where('__name__', 'in', clientIds)));
        this.clients = snapshot.docs.map(d => ({ id: d.id, name: d.data()['companyName'] || 'Sem Nome' }));
        if (this.clients.length > 0) {
          this.userForm.get('clients')?.setValue([this.clients[0].id]);
          this.userForm.get('clients')?.disable();
        }
      } else {
        snapshot = await getDocs(clientsCollection);
        this.clients = snapshot.docs
          .map(d => ({ id: d.id, name: d.data()['companyName'] || 'Sem Nome' }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open(this.translate.instant('Erro ao carregar clientes.'), this.translate.instant('Fechar'), { duration: 3000 });
    }
  }

  private async loadAllGroups(): Promise<void> {
    try {
      const userRole = await this.getCurrentUserRole();
      const groupsSnap = userRole === 'admin_client'
        ? await getDocs(query(collection(this.firestore, 'userGroups'),
            where('clientId', 'in', await this.authService.getCurrentUserClientIds())))
        : await getDocs(collection(this.firestore, 'userGroups'));

      const clientsSnap = await getDocs(collection(this.firestore, 'clients'));
      const clientMap = new Map(clientsSnap.docs.map(d => [d.id, d.data()['companyName'] || '']));

      const projectsSnap = await getDocs(collection(this.firestore, 'projects'));
      const projectMap = new Map(projectsSnap.docs.map(d => [d.id, d.data()['name'] || '']));

      this.allGroups = groupsSnap.docs.map(d => {
        const data = d.data();
        const projectIds: string[] = data['projectIds'] || [];
        return {
          id: d.id,
          name: data['name'] || '',
          clientId: data['clientId'] || '',
          clientName: clientMap.get(data['clientId']) || '',
          projectIds,
          projectNames: projectIds.map(pid => projectMap.get(pid) || pid).filter(Boolean),
        };
      }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      this.filteredGroups = [...this.allGroups];
    } catch (e) {
      console.error('Erro ao carregar grupos:', e);
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

    // Bloqueia ADM Cliente — equivalente a HTTP 403
    if (userRole === 'admin_client') {
      this.snackBar.open(
        this.translate.instant('Acesso negado (403): ADM Cliente não pode criar ou editar usuários.'),
        this.translate.instant('Fechar'),
        { duration: 5000 }
      );
      this.dialogRef.close(false);
      return;
    }

    try {
      const { name, surname, email, role } = this.userForm.value;
      const selectedGroups: string[] = this.userForm.get('groups')?.value || [];
      const emailLower = (email || '').toLowerCase().trim();

      // Derivar client e projects dos grupos selecionados
      const groupObjs = this.allGroups.filter(g => selectedGroups.includes(g.id));
      const derivedClientId = groupObjs[0]?.clientId || '';
      const derivedProjectIds = [...new Set(groupObjs.flatMap(g => g.projectIds))];
      const derivedClients = derivedClientId ? [derivedClientId] : (this.userForm.get('clients')?.value || []);

      if (this.isEditMode) {
        const usersCollection = collection(this.firestore, 'users');
        const querySnapshot = await getDocs(query(usersCollection, where('email', '==', email)));

        if (!querySnapshot.empty) {
          const userDocRef = querySnapshot.docs[0].ref;
          const userId = querySnapshot.docs[0].id;
          const oldGroups: string[] = querySnapshot.docs[0].data()['groups'] || [];

          const updateData: any = {
            name, surname, emailLower, role, updatedAt: new Date(),
            groups: selectedGroups,
            clients: derivedClients,
            client: derivedClientId || derivedClients[0] || '',
            projects: derivedProjectIds,
          };
          await updateDoc(userDocRef, updateData);

          // Sincronizar membros dos grupos
          const removed = oldGroups.filter(id => !selectedGroups.includes(id));
          const added = selectedGroups.filter(id => !oldGroups.includes(id));
          await Promise.all([
            ...removed.map(gId => updateDoc(doc(this.firestore, 'userGroups', gId), { userIds: arrayRemove(userId) })),
            ...added.map(gId => updateDoc(doc(this.firestore, 'userGroups', gId), { userIds: arrayUnion(userId) })),
          ]);

          this.snackBar.open(this.translate.instant('Usuário atualizado com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
        } else {
          this.snackBar.open(this.translate.instant('Usuário não encontrado.'), this.translate.instant('Fechar'), { duration: 3000 });
        }
      } else {
        // Verificação dupla no momento de salvar
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

        // Cria documento Firestore
        const newUserData: any = {
          name, surname, email, emailLower, role,
          clients: derivedClients,
          client: derivedClientId || derivedClients[0] || '',
          projects: derivedProjectIds,
          groups: selectedGroups,
          status: 'active',
          createdAt: new Date(),
        };
        const newDocRef = await addDoc(collection(this.firestore, 'users'), newUserData);

        // Adicionar usuário aos grupos selecionados
        await Promise.all(
          selectedGroups.map(gId => updateDoc(doc(this.firestore, 'userGroups', gId), { userIds: arrayUnion(newDocRef.id) }))
        );

        const welcomeResult = await this.createAuthAndSendWelcomeEmail(email);

        if (welcomeResult.emailSent) {
          this.snackBar.open(
            `Usuário criado! E-mail de acesso enviado para ${email}.`,
            'Fechar',
            { duration: 5000 }
          );
        } else if (welcomeResult.authCreated) {
          this.snackBar.open(
            `Usuário criado, mas o e-mail de acesso não foi enviado. Use "Enviar link" na listagem.`,
            'Fechar',
            { duration: 8000 }
          );
        } else {
          this.snackBar.open(
            `Usuário salvo no sistema, mas a conta de acesso não foi criada. Tente reenviar o link na listagem.`,
            'Fechar',
            { duration: 8000 }
          );
        }
      }

      this.dialogRef.close(true);
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      this.snackBar.open(this.translate.instant(this.isEditMode ? 'Erro ao atualizar usuário.' : 'Erro ao criar usuário.'), this.translate.instant('Fechar'), { duration: 3000 });
    }
  }

  /**
   * Cria conta Firebase Auth em um app secundário (não afeta a sessão do admin logado)
   * e dispara o e-mail de redefinição de senha que serve como link de criação de acesso.
   * O link expira conforme configurado no Firebase Console (recomendado: 48h).
   */
  private async createAuthAndSendWelcomeEmail(
    email: string
  ): Promise<{ authCreated: boolean; emailSent: boolean }> {
    const appName = `welcome_${Date.now()}`;
    const secondaryApp = initializeApp((this.firebaseApp as any).options, appName);
    const secondaryAuth = getAuth(secondaryApp);
    let authCreated = false;

    try {
      // Senha temporária aleatória — usuário nunca a usa, pois receberá o link de criação
      const tempPassword =
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).toUpperCase().slice(2) +
        '!8';

      await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
      await firebaseSignOut(secondaryAuth);
      authCreated = true;
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        authCreated = true;
      } else {
        console.error('Erro ao criar conta Auth:', err?.message);
        this.snackBar.open(
          `Erro ao criar conta de acesso: ${err?.message}`,
          this.translate.instant('Fechar'),
          { duration: 6000 }
        );
      }
    } finally {
      try { await deleteApp(secondaryApp); } catch {}
    }

    if (!authCreated) {
      return { authCreated: false, emailSent: false };
    }

    // Envia e-mail com link de criação/redefinição de senha
    try {
      const actionCodeSettings: ActionCodeSettings = {
        url: `${window.location.origin}/authentication/login`,
        handleCodeInApp: false,
      };
      await sendPasswordResetEmail(this.auth, email, actionCodeSettings);
      return { authCreated: true, emailSent: true };
    } catch (err: any) {
      console.error('Erro ao enviar e-mail de boas-vindas:', err?.code, err?.message);
      this.snackBar.open(
        `Conta criada, mas o e-mail não foi enviado: ${err?.message}`,
        this.translate.instant('Fechar'),
        { duration: 8000 }
      );
      return { authCreated: true, emailSent: false };
    }
  }
}
