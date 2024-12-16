import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import {
  FormControl,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule, RouterModule, CommonModule],
  templateUrl: './client-detail.component.html',
  styleUrls: ['./client-detail.component.scss'],
})
export class ClientDetailComponent implements OnInit {
  clientId!: string; // ID do cliente (definido pela rota)
  clientForm!: FormGroup; // Formulário reativo
  isLoading = true; // Indicador de carregamento

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get('id')!; // Obtém o ID do cliente da rota
    this.loadClient(); // Carrega os dados do cliente
  }

  async loadClient() {
    const clientDocRef = doc(this.firestore, 'clients', this.clientId);

    try {
      const docSnap = await getDoc(clientDocRef);
      if (docSnap.exists()) {
        this.initForm(docSnap.data());
      } else {
        this.snackBar.open('Cliente não encontrado.', 'Fechar', {
          duration: 3000,
        });
        this.router.navigate(['/clients']);
      }
    } catch (error) {
      console.error('Erro ao carregar cliente:', error);
      this.snackBar.open('Erro ao carregar os dados do cliente.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isLoading = false;
    }
  }

  initForm(clientData: any) {
    this.clientForm = new FormGroup({
      companyName: new FormControl(clientData.companyName, [
        Validators.required,
      ]),
      email: new FormControl(clientData.email, [
        Validators.required,
        Validators.email,
      ]),
      phone: new FormControl(clientData.phone, [Validators.required]),
      sector: new FormControl(clientData.sector),
      cnpj: new FormControl(clientData.cnpj, [Validators.required]),
      notes: new FormControl(clientData.notes),
      representativeName: new FormControl(clientData.representative?.name, [
        Validators.required,
      ]),
      representativeEmail: new FormControl(clientData.representative?.email, [
        Validators.required,
        Validators.email,
      ]),
      representativeRole: new FormControl(clientData.representative?.role),
    });
  }

  async saveChanges() {
    if (this.clientForm.invalid) return;

    const updatedClientData = {
      ...this.clientForm.value,
      representative: {
        name: this.clientForm.value.representativeName,
        email: this.clientForm.value.representativeEmail,
        role: this.clientForm.value.representativeRole,
      },
    };

    const clientDocRef = doc(this.firestore, 'clients', this.clientId);

    try {
      await updateDoc(clientDocRef, updatedClientData);
      this.snackBar.open('Cliente atualizado com sucesso!', 'Fechar', {
        duration: 3000,
      });
      this.router.navigate(['/clients']); // Redireciona para a lista de clientes
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      this.snackBar.open('Erro ao salvar alterações.', 'Fechar', {
        duration: 3000,
      });
    }
  }
}
