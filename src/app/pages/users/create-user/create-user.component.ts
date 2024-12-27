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
  doc,
  updateDoc,
} from '@angular/fire/firestore';
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';

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
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadClients().then(() => {
      if (this.data?.user) {
        this.isEditMode = true;
        this.prefillForm(this.data.user); // Agora carrega os valores do cliente, projeto e grupo
      }
    });
  }

  private initializeForm(): void {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      surname: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: [''],
      client: ['', Validators.required],
      project: ['', Validators.required],
      group: ['', Validators.required],
      role: ['', Validators.required],
    });
  }

  private async prefillForm(user: any): Promise<void> {
    console.log(user)
    if (user.client) {
      console.log(user.client);
      // Carregar projetos e grupos relacionados ao cliente antes de preencher os valores
      await this.onClientChange(user.client);
    }

    this.userForm.patchValue({
      name: user.name,
      surname: user.surname,
      email: user.email,
      client: user.client,
      project: user.project,
      group: user.group,
      role: user.role,
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

  async onClientChange(clientId: string): Promise<void> {
    this.projects = [];
    this.groups = [];
    this.userForm.patchValue({ project: '', group: '' });

    try {
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

    try {
      const { name, surname, email, password, client, project, group, role } =
        this.userForm.value;

      if (this.isEditMode) {
        const userDoc = doc(this.firestore, `users/${this.data.user.id}`);
        await updateDoc(userDoc, {
          name,
          surname,
          email,
          client,
          project,
          group,
          role,
        });
        this.snackBar.open('Usuário atualizado com sucesso!', 'Fechar', {
          duration: 3000,
        });
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          this.auth,
          email,
          '123@qwe'
        );

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
          uid: userCredential.user.uid,
        });

        this.snackBar.open('Usuário criado com sucesso!', 'Fechar', {
          duration: 3000,
        });
      }

      this.dialogRef.close(true);
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      this.snackBar.open(
        this.isEditMode
          ? 'Erro ao atualizar usuário.'
          : 'Erro ao criar usuário.',
        'Fechar',
        {
          duration: 3000,
        }
      );
    }
  }
}
