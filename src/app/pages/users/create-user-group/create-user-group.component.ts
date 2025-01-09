import { Component, OnInit, Inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
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
  addDoc,
  doc,
  updateDoc,
  query,
  where,
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

export interface UserGroup {
  id?: string;
  name: string;
  description: string;
  clientId?: string;
  projectIds?: string[];
  userIds?: string[];
}

@Component({
  selector: 'app-create-user-group',
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
  templateUrl: './create-user-group.component.html',
  styleUrls: ['./create-user-group.component.scss'],
})
export class CreateUserGroupComponent implements OnInit {
  groupForm!: FormGroup;
  clients: { id: string; name: string }[] = [];
  projects: { id: string; name: string }[] = [];
  users: { id: string; name: string }[] = [];
  isEditMode: boolean = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateUserGroupComponent>,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    @Inject(MAT_DIALOG_DATA) public data: UserGroup | null
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadClients().then(() => {
      if (this.data) {
        this.isEditMode = true;
        this.patchFormWithData()
          .then(() =>
            console.log(
              'Formulário preenchido com os dados:',
              this.groupForm.value
            )
          )
          .catch((error) =>
            console.error('Erro ao preencher o formulário:', error)
          );
      }
    });
  }

  private initializeForm(): void {
    this.groupForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      clientId: ['', Validators.required],
      // projectIds: [[]],
      userIds: [[]],
    });
  }

  private async loadClients(): Promise<void> {
    try {
      const clientsCollection = collection(this.firestore, 'clients');
      const snapshot = await getDocs(clientsCollection);
      this.clients = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['companyName'] || 'Sem Nome',
      }));
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open('Erro ao carregar clientes.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  private async loadProjects(clientId: string | null): Promise<void> {
    if (!clientId) {
      this.projects = [];
      console.log('Nenhum clientId fornecido para carregar projetos.');
      return;
    }

    try {
      const projectsCollection = collection(this.firestore, 'projects');
      const projectsQuery = query(
        projectsCollection,
        where('clientId', '==', clientId)
      );
      const snapshot = await getDocs(projectsQuery);

      this.projects = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Sem Nome',
      }));
      console.log('Projetos carregados:', this.projects);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      this.snackBar.open('Erro ao carregar projetos.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  private async loadUsers(clientId: string | null): Promise<void> {
    // if (!clientId) {
    //   this.users = [];
    //   return;
    // }

    try {
      const usersCollection = collection(this.firestore, 'users');
      const usersQuery = query(usersCollection);
      const snapshot = await getDocs(usersQuery);

      this.users = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Sem Nome',
      }));
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      this.snackBar.open('Erro ao carregar usuários.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  private async patchFormWithData(): Promise<void> {
    if (this.data) {
      console.log('Dados do grupo recebidos no patch:', this.data);
      const clientId = this.data.clientId;

      if (clientId) {
        try {
          console.log(
            'Iniciando o carregamento de projetos e usuários para clientId:',
            clientId
          );
          await Promise.all([
            this.loadProjects(clientId),
            this.loadUsers(clientId),
          ]);
          console.log('Carregamento concluído.');
        } catch (error) {
          console.error('Erro ao carregar dados associados ao cliente:', error);
        }
      }

      console.log('Dados após carregamento:', this.data);

      this.groupForm.patchValue({
        name: this.data.name,
        description: this.data.description,
        clientId: this.data.clientId, // Verifique se clientId está correto aqui
        projectIds: this.data.projectIds || [],
        userIds: this.data.userIds || [],
      });

      console.log(
        'Formulário atualizado com os valores:',
        this.groupForm.value
      );
    }
  }

  async saveGroup(): Promise<void> {
    if (this.groupForm.invalid) {
      return;
    }

    const userIds = this.groupForm.get('userIds')?.value || [];
    const clientId = this.groupForm.get('clientId')?.value;
    const projectIds = this.groupForm.get('projectIds')?.value || [];

    if (this.isEditMode) {
      // Atualizar o grupo
      await this.updateGroup(clientId, userIds, projectIds);
    } else {
      // Criar um novo grupo
      await this.createGroup(clientId, userIds, projectIds);
    }
  }

  private async createGroup(
    clientId: string,
    userIds: string[],
    projectIds: string[]
  ): Promise<void> {
    try {
      const currentUser = await this.authService.getCurrentUser();
      if (!currentUser) {
        this.snackBar.open(
          'Erro ao obter dados do usuário autenticado.',
          'Fechar',
          { duration: 3000 }
        );
        return;
      }

      const groupsCollection = collection(this.firestore, 'userGroups');
      const groupRef = await addDoc(groupsCollection, {
        ...this.groupForm.value,
        createdBy: currentUser.name,
        createdByEmail: currentUser.email,
        createdAt: new Date(),
      });

      // Atualizar os usuários e o cliente/projeto para cada usuário
      await this.updateUserDocuments(userIds, clientId, projectIds);

      this.snackBar.open('Grupo criado com sucesso!', 'Fechar', {
        duration: 3000,
      });
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Erro ao criar grupo:', error);
      this.snackBar.open('Erro ao criar grupo.', 'Fechar', { duration: 3000 });
    }
  }

  private async updateGroup(
    clientId: string,
    userIds: string[],
    projectIds: string[]
  ): Promise<void> {
    try {
      const groupDocRef = doc(this.firestore, `userGroups/${this.data?.id}`);
      await updateDoc(groupDocRef, {
        ...this.groupForm.value,
      });

      // Atualizar os usuários e o cliente/projeto para cada usuário
      await this.updateUserDocuments(userIds, clientId, projectIds);

      this.snackBar.open('Grupo atualizado com sucesso!', 'Fechar', {
        duration: 3000,
      });
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Erro ao atualizar grupo:', error);
      this.snackBar.open('Erro ao atualizar grupo.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  private async updateUserDocuments(
    userIds: string[],
    clientId: string,
    projectIds: string[]
  ): Promise<void> {
    try {
      // Atualizar cada usuário
      for (const userId of userIds) {
        const userDocRef = doc(this.firestore, `users/${userId}`);
        await updateDoc(userDocRef, {
          client: clientId,
          project: projectIds.length > 0 ? projectIds[0] : null, // Atualizando com o primeiro projeto (você pode ajustar se necessário)
        });
      }

      this.snackBar.open('Usuários atualizados com sucesso!', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao atualizar documentos dos usuários:', error);
      this.snackBar.open(
        'Erro ao atualizar documentos dos usuários.',
        'Fechar',
        { duration: 3000 }
      );
    }
  }

  onClientChange(): void {
    const clientId = this.groupForm.get('clientId')?.value;
    this.loadProjects(clientId);
    this.loadUsers(clientId);
  }
}
