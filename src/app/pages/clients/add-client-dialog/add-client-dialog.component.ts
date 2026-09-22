import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ClientCreditValiditySummary } from 'src/app/utils/credit-validity.util';
import {
  formatDatePtBr,
  loadClientCreditValiditySummary,
} from 'src/app/utils/client-credit-summary.util';

@Component({
  selector: 'app-add-client-dialog',
  standalone: true,
  imports: [
    MaterialModule,
    ReactiveFormsModule,
    NgxMaskDirective,
    CommonModule,
    TranslateModule,
  ],
  templateUrl: './add-client-dialog.component.html',
  styleUrls: ['./add-client-dialog.component.scss'],
})
export class AddClientDialogComponent implements OnInit {
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
  creditSummaryLoading = false;
  creditSummary: ClientCreditValiditySummary = {
    creditsAvailable: 0,
    nearestValidity: null,
    nearestOrderStatus: null,
    daysRemaining: null,
  };
  formatDatePtBr = formatDatePtBr;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<AddClientDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private translate: TranslateService,
    private router: Router
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

  ngOnInit(): void {
    void this.loadCreditSummaryIfEditing();
  }

  private async loadCreditSummaryIfEditing(): Promise<void> {
    if (!this.isEditing || !this.clientId || !this.data?.client) {
      return;
    }
    this.creditSummaryLoading = true;
    try {
      this.creditSummary = await loadClientCreditValiditySummary(
        this.firestore,
        this.clientId,
        this.data.client as Record<string, unknown>
      );
    } finally {
      this.creditSummaryLoading = false;
    }
  }

  openCreditOrders(): void {
    if (!this.clientId) return;
    this.dialogRef.close(false);
    void this.router.navigate(['/orders'], { queryParams: { clientId: this.clientId } });
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
        this.snackBar.open(this.translate.instant('Cliente atualizado com sucesso!'), this.translate.instant('Fechar'), {
          duration: 3000,
        });
      } else {
        const clientsRef = collection(this.firestore, 'clients');
        const docRef = await addDoc(clientsRef, {
          ...formData,
          createdAt: serverTimestamp(),
        }); // Adiciona novo cliente
        this.snackBar.open(this.translate.instant('Cliente cadastrado com ID {{id}}!', { id: docRef.id }), this.translate.instant('Fechar'), { duration: 3000 });
      }
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      this.snackBar.open(this.translate.instant('Erro ao salvar cliente. Tente novamente.'), this.translate.instant('Fechar'), {
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
