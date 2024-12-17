import { Component, Inject } from '@angular/core';
import {
  FormGroup,
  FormControl,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';

@Component({
  selector: 'app-add-user-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MaterialModule, CommonModule],
  templateUrl: './add-user-dialog.component.html',
  styleUrls: ['./add-user-dialog.component.scss'],
})
export class AddUserDialogComponent {
  form = new FormGroup({
    name: new FormControl('', [Validators.required]), // Nome do usuário
    email: new FormControl('', [Validators.required, Validators.email]), // E-mail do usuário
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
    ]), // Senha do usuário
    role: new FormControl('admin_client', [Validators.required]), // Papel (role) do usuário
  });

  isSubmitting = false;
  passwordVisible = false; // Controle da visibilidade da senha
  passwordFieldType: 'password' | 'text' = 'password'; // Tipo do campo de senha

  constructor(
    private dialogRef: MatDialogRef<AddUserDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { clientId: string }, // Dados passados para o modal
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private auth: Auth
  ) {
    console.log('Client ID recebido:', data.clientId);
  }

  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
    this.passwordFieldType = this.passwordVisible ? 'text' : 'password';
  }

  // Gerar senha aleatória curta
  generateRandomPassword() {
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const passwordLength = 8; // Define o comprimento da senha
    const randomPassword = Array.from({ length: passwordLength })
      .map(() => charset.charAt(Math.floor(Math.random() * charset.length)))
      .join('');
    this.form.get('password')?.setValue(randomPassword);
  }

  async submit() {
    if (this.form.invalid) return;

    this.isSubmitting = true;

    const { name, email, password, role } = this.form.value;

    try {
      // Criar o usuário no Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        email!,
        password!
      );

      // Obter o UID do usuário recém-criado
      const uid = userCredential.user.uid;

      // Adicionar informações adicionais no Firestore usando o UID como identificador do documento
      const userDocRef = doc(this.firestore, `users/${uid}`);
      await setDoc(userDocRef, {
        uid,
        name,
        email,
        role,
        clientId: this.data.clientId,
        createdAt: new Date(),
      });

      this.snackBar.open('Usuário adicionado com sucesso!', 'Fechar', {
        duration: 3000,
      });
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Erro ao adicionar usuário:', error);
      this.snackBar.open(
        'Erro ao adicionar usuário. Tente novamente mais tarde.',
        'Fechar',
        { duration: 3000 }
      );
    } finally {
      this.isSubmitting = false;
    }
  }

  close() {
    this.dialogRef.close(false);
  }
}
