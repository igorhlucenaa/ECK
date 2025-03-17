import { Component, Inject, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
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
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
} from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { updateDoc, doc } from '@angular/fire/firestore';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

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
    MatSnackBarModule,
    CommonModule,
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

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateUserComponent>,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private auth: Auth,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private router: Router,
    private authService: AuthService
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
      email: ['', [Validators.required, Validators.email]],
      password: [''],
      client: [''],
      project: [''],
      group: [''],
      role: ['', Validators.required],
    });
  }

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
      this.snackBar.open('Erro ao carregar clientes.', 'Fechar', {
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
      this.snackBar.open('Erro ao carregar projetos ou grupos.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async saveUser(): Promise<void> {
    if (this.userForm.invalid) {
      return;
    }

    const userRole = await this.getCurrentUserRole();
    const selectedRole = this.userForm.get('role')?.value;

    if (
      userRole === 'admin_client' &&
      !['viewer', 'admin_client'].includes(selectedRole)
    ) {
      this.snackBar.open(
        'Você não tem permissão para atribuir este papel.',
        'Fechar',
        {
          duration: 3000,
        }
      );
      return;
    }

    try {
      const { name, surname, email, password, client, project, group, role } =
        this.userForm.value;

      const currentUser = this.auth.currentUser;
      const currentEmail = currentUser?.email;

      // Se estiver editando, ignore a verificação do e-mail
      if (this.isEditMode) {
        const usersCollection = collection(this.firestore, 'users');
        const userQuery = query(usersCollection, where('email', '==', email));
        const querySnapshot = await getDocs(userQuery);

        if (!querySnapshot.empty) {
          // Pega o primeiro documento
          const userDoc = querySnapshot.docs[0];

          // Atualiza o documento do usuário
          await updateDoc(userDoc.ref, {
            name,
            surname,
            email,
            client,
            project,
            group,
            role,
            updatedAt: new Date(),
          });

          this.snackBar.open('Usuário atualizado com sucesso!', 'Fechar', {
            duration: 3000,
          });
        } else {
          this.snackBar.open('Usuário não encontrado.', 'Fechar', {
            duration: 3000,
          });
        }
      } else {
        // Se não estiver editando, crie um novo usuário
        const signInMethods = await fetchSignInMethodsForEmail(
          this.auth,
          email
        );

        if (signInMethods.length > 0) {
          this.snackBar.open('O usuário já existe no sistema!', 'Fechar', {
            duration: 3000,
          });
        } else {
          // Adicione o usuário ao Firestore
          const usersCollection = collection(this.firestore, 'users');
          await addDoc(usersCollection, {
            name,
            surname,
            email,
            client,
            project,
            group,
            role,
            createdAt: new Date(),
          });

          this.snackBar.open('Usuário criado com sucesso!', 'Fechar', {
            duration: 3000,
          });
        }
      }

      // Fecha o diálogo
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      this.snackBar.open(
        this.isEditMode
          ? 'Erro ao atualizar usuário.'
          : 'Erro ao criar usuário.',
        'Fechar',
        { duration: 3000 }
      );
    }
  }
}
