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
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  updateDoc,
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

export interface UserGroup {
  id?: string; // Opcional para suportar edição
  name: string;
  description: string;
}

@Component({
  selector: 'app-create-user-group',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    CommonModule,
  ],
  templateUrl: './create-user-group.component.html',
  styleUrls: ['./create-user-group.component.scss'],
})
export class CreateUserGroupComponent implements OnInit {
  groupForm!: FormGroup;
  isEditMode: boolean = false; // Indica se o componente está no modo de edição

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateUserGroupComponent>,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    @Inject(MAT_DIALOG_DATA) public data: UserGroup | null // Dados do grupo para edição
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    if (this.data) {
      this.isEditMode = true; // Ativa o modo de edição
      this.patchFormWithData();
    }
  }

  private initializeForm(): void {
    this.groupForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
    });
  }

  private patchFormWithData(): void {
    // Preenche o formulário com os dados existentes para edição
    this.groupForm.patchValue({
      name: this.data?.name,
      description: this.data?.description,
    });
  }

  async saveGroup(): Promise<void> {
    if (this.groupForm.invalid) {
      return;
    }

    if (this.isEditMode) {
      await this.updateGroup();
    } else {
      await this.createGroup();
    }
  }

  private async createGroup(): Promise<void> {
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
      await addDoc(groupsCollection, {
        name: this.groupForm.value.name,
        description: this.groupForm.value.description,
        createdBy: currentUser.name,
        createdByEmail: currentUser.email,
        createdAt: new Date(),
      });

      this.snackBar.open('Grupo criado com sucesso!', 'Fechar', {
        duration: 3000,
      });
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Erro ao criar grupo:', error);
      this.snackBar.open('Erro ao criar grupo.', 'Fechar', { duration: 3000 });
    }
  }

  private async updateGroup(): Promise<void> {
    try {
      const groupDocRef = doc(this.firestore, `userGroups/${this.data?.id}`);
      await updateDoc(groupDocRef, {
        name: this.groupForm.value.name,
        description: this.groupForm.value.description,
      });

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
}
