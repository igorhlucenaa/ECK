import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  Firestore,
  collection,
  addDoc,
  getDocs,
} from '@angular/fire/firestore';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-new-credit-order',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatCardModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    RouterModule,
  ],
  templateUrl: './new-credit-order.component.html',
  styleUrls: ['./new-credit-order.component.scss'],
})
export class NewCreditOrderComponent implements OnInit {
  orderForm!: FormGroup;
  clients: Array<{ id: string; name: string }> = [];

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadClients();
  }

  private initializeForm(): void {
    this.orderForm = this.fb.group({
      clientId: ['', Validators.required],
      credits: [null, [Validators.required, Validators.min(1)]],
      totalAmount: [null, [Validators.required, Validators.min(0)]],
      startDate: [null, Validators.required],
      validityDate: [null, Validators.required],
      notes: [''],
    });
  }

  private async loadClients(): Promise<void> {
    try {
      const clientsCollection = collection(this.firestore, 'clients');
      const clientsSnapshot = await getDocs(clientsCollection);
      this.clients = clientsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Cliente sem nome',
      }));
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open('Erro ao carregar clientes.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async createOrder(): Promise<void> {
    if (this.orderForm.invalid) {
      this.snackBar.open(
        'Preencha os campos obrigatórios corretamente.',
        'Fechar',
        {
          duration: 3000,
        }
      );
      return;
    }

    const { clientId, credits, totalAmount, startDate, validityDate, notes } =
      this.orderForm.value;

    try {
      const ordersCollection = collection(this.firestore, 'creditOrders');
      await addDoc(ordersCollection, {
        clientId,
        credits,
        totalAmount,
        startDate,
        validityDate,
        notes: notes || '',
        status: 'Pendente',
        createdAt: new Date(),
      });

      this.snackBar.open('Pedido criado com sucesso!', 'Fechar', {
        duration: 3000,
      });
      this.router.navigate(['/orders']);
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      this.snackBar.open('Erro ao criar pedido.', 'Fechar', { duration: 3000 });
    }
  }

  cancel(): void {
    this.router.navigate(['/orders']);
  }
}
