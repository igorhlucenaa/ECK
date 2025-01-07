import { CommonModule, Location } from '@angular/common';
import { Component, Inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from '@angular/fire/firestore';
import {
  FormGroup,
  FormControl,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
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
    companyName: new FormControl('', [Validators.required]), // Nome do Cliente
    sector: new FormControl(''), // Setor
    cnpj: new FormControl(''), // CNPJ
    credits: new FormControl(0), // Créditos
    logo: new FormControl(), // Logo em Base64
  });
  logoPreview: string | null = null;
  isSubmitting = false;
  isEditing = false; // Flag para edição
  clientId: string | null = null; // ID do cliente, se for edição

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<AddClientDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data?.client) {
      this.isEditing = true;
      this.clientId = data.client.id;
      this.form.patchValue({
        companyName: data.client.companyName,
        sector: data.client.sector,
        cnpj: data.client.cnpj,
        credits: data.client.credits,
        logo: data.client.logo,
      });
      this.logoPreview = data.client.logo; // Pré-visualização da logo existente
    }
  }

  onFileSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];

      const reader = new FileReader();
      reader.onload = () => {
        const base64Logo = reader.result as string;
        this.form.patchValue({ logo: base64Logo });
        this.logoPreview = base64Logo;
      };
      reader.readAsDataURL(file);
    }
  }

  async submit() {
    if (this.form.invalid) return;

    this.isSubmitting = true;
    const formData = this.form.value;

    try {
      if (this.isEditing && this.clientId) {
        const clientDocRef = doc(this.firestore, `clients/${this.clientId}`);
        await updateDoc(clientDocRef, formData); // Atualiza o cliente
        this.snackBar.open('Cliente atualizado com sucesso!', 'Fechar', {
          duration: 3000,
        });
      } else {
        const clientsRef = collection(this.firestore, 'clients');
        const docRef = await addDoc(clientsRef, {
          ...formData,
          createdAt: serverTimestamp(),
        }); // Adiciona novo cliente
        this.snackBar.open(
          `Cliente cadastrado com ID ${docRef.id}!`,
          'Fechar',
          {
            duration: 3000,
          }
        );
      }
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      this.snackBar.open('Erro ao salvar cliente. Tente novamente.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isSubmitting = false;
    }
  }

  close() {
    this.dialogRef.close(false);
  }
}
