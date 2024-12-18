import { CommonModule, Location } from '@angular/common';
import { Component } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  serverTimestamp,
} from '@angular/fire/firestore';
import {
  FormGroup,
  FormControl,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxMaskDirective, NgxMaskPipe } from 'ngx-mask';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-add-client-dialog',
  standalone: true,
  imports: [
    MaterialModule,
    ReactiveFormsModule,
    NgxMaskDirective,
    CommonModule,
  ],
  templateUrl: './add-client-dialog.component.html',
  styleUrls: ['./add-client-dialog.component.scss'],
})
export class AddClientDialogComponent {
  form = new FormGroup({
    // Dados da Empresa
    companyName: new FormControl('', [Validators.required]), // Nome fantasia
    corporateName: new FormControl('', [Validators.required]), // Razão social
    cnpj: new FormControl('', [
      Validators.required,
      // Validators.pattern(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\;d{2}$/), // Validação básica para CNPJ
    ]),
    email: new FormControl('', [Validators.required, Validators.email]), // E-mail da empresa
    phone: new FormControl('', [
      Validators.required,
      // Validators.pattern(/^\(\d{2}\) \d{5}-\d{4}$/),
    ]), // Telefone
    address: new FormControl(''), // Endereço
    sector: new FormControl(''), // Setor de atuação
    credits: new FormControl(0, [Validators.min(0)]), // Créditos iniciais
    notes: new FormControl(''), // Notas adicionais

    // Dados do Representante
    representativeName: new FormControl('', [Validators.required]), // Nome do representante
    representativeRole: new FormControl(''), // Função do representante
    representativeEmail: new FormControl('', [
      Validators.required,
      Validators.email,
    ]), // E-mail do representante
  });

  isSubmitting = false;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<AddClientDialogComponent>,
    private location: Location
  ) {}

  get cnpjMask() {
    return '00.000.000/0000-00'; // Máscara fixa para CNPJ
  }

  async submit() {
    if (this.form.invalid) return;

    this.isSubmitting = true;
    const formData = this.form.value;

    // Gerar senha aleatória para o representante
    const representativePassword = this.generateRandomPassword();

    const clientData = {
      ...formData,
      representative: {
        name: formData.representativeName,
        email: formData.representativeEmail,
        role: formData.representativeRole,
        password: representativePassword,
      },
      createdAt: serverTimestamp(), // Adiciona timestamp ao criar o cliente
    };

    try {
      const clientsRef = collection(this.firestore, 'clients');
      const docRef = await addDoc(clientsRef, clientData); // Cria o documento
      this.snackBar.open(`Cliente cadastrado com ID ${docRef.id}!`, 'Fechar', {
        duration: 3000,
      });
      this.dialogRef.close();
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);
      this.snackBar.open(
        'Erro ao cadastrar cliente. Tente novamente.',
        'Fechar',
        {
          duration: 3000,
        }
      );
    } finally {
      this.isSubmitting = false;
    }
  }

  close() {
    this.dialogRef.close(false); // Fecha o diálogo sem salvar
  }

  generateRandomPassword(length: number = 8): string {
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  goBack(): void {
    this.location.back();
  }
}
