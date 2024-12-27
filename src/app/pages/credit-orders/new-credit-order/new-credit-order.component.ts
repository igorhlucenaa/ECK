import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  Firestore,
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
} from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-new-credit-order',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './new-credit-order.component.html',
  styleUrls: ['./new-credit-order.component.scss'],
})
export class NewCreditOrderComponent implements OnInit {
  orderForm: FormGroup;
  clients: any[] = []; // Lista de clientes

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private firestore: Firestore,
    private snackBar: MatSnackBar
  ) {
    this.orderForm = this.fb.group({
      clientId: ['', Validators.required], // Cliente selecionado
      credits: ['', [Validators.required, Validators.min(1)]],
      totalAmount: ['', [Validators.required, Validators.min(0)]],
      notes: [''],
    });
  }

  ngOnInit(): void {
    this.loadClients();
  }

  async loadClients(): Promise<void> {
    try {
      const clientsCollection = collection(this.firestore, 'clients');
      const snapshot = await getDocs(clientsCollection);
      this.clients = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open('Erro ao carregar lista de clientes.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async createOrder(): Promise<void> {
    if (this.orderForm.invalid) {
      this.snackBar.open('Preencha todos os campos obrigatórios.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    try {
      const data = {
        ...this.orderForm.value,
        status: 'Pendente', // Status inicial do pedido
        createdAt: serverTimestamp(),
      };

      const ordersCollection = collection(this.firestore, 'creditOrders');
      await addDoc(ordersCollection, data);

      this.snackBar.open('Pedido criado com sucesso!', 'Fechar', {
        duration: 3000,
      });

      this.router.navigate(['/orders']); // Redireciona para a lista de pedidos
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      this.snackBar.open(
        'Erro ao criar pedido. Tente novamente mais tarde.',
        'Fechar',
        {
          duration: 3000,
        }
      );
    }
  }

  cancel(): void {
    this.router.navigate(['/orders']); // Redireciona para a lista de pedidos
  }
}
