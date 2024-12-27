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
    private auth: Auth, // Serviço para autenticação do Firebase
    @Inject(MAT_DIALOG_DATA) public data: any // Dados para edição, se houver
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadGroups();

    // Verifica se é edição
    if (this.data?.user) {
      this.isEditMode = true;
      this.prefillForm(this.data.user);
    }
  }

  private initializeForm(): void {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      surname: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: [''], // Campo adicional para senha
      group: ['', Validators.required],
      role: ['', Validators.required],
    });
  }

  private prefillForm(user: any): void {
    this.userForm.patchValue({
      name: user.name,
      surname: user.surname,
      email: user.email,
      group: user.group,
      role: user.role,
    });
  }

  private async loadGroups(): Promise<void> {
    try {
      const groupsCollection = collection(this.firestore, 'userGroups');
      const snapshot = await getDocs(groupsCollection);
      this.groups = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Sem Nome',
      }));
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
      this.snackBar.open('Erro ao carregar grupos.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async saveUser(): Promise<void> {
    if (this.userForm.invalid) {
      return;
    }

    try {
      const { name, surname, email, password, group, role } =
        this.userForm.value;

      if (this.isEditMode) {
        // Atualizar usuário existente
        const userDoc = doc(this.firestore, `users/${this.data.user.id}`);
        await updateDoc(userDoc, { name, surname, email, group, role });
        this.snackBar.open('Usuário atualizado com sucesso!', 'Fechar', {
          duration: 3000,
        });
      } else {
        // Criar novo usuário no Authentication e Firestore
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
          group,
          role,
          createdAt: new Date(),
          uid: userCredential.user.uid, // Relaciona o UID do Firebase Auth
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
