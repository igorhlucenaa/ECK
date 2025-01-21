import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidatorFn,
} from '@angular/forms';
import {
  Firestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
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
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

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
    private router: Router,
    private authService: AuthService // Adicionado
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadClients();
  }

  private initializeForm(): void {
    this.orderForm = this.fb.group({
      clientId: ['', Validators.required],
      credits: [null, [Validators.required, Validators.min(1)]],
      startDate: [null, Validators.required],
      validityDate: [null, Validators.required],
      notes: [''],
    });

    // Atualiza o valor mínimo para a data de validade com base na data de início
    this.orderForm.get('startDate')?.valueChanges.subscribe((startDate) => {
      const validityControl = this.orderForm.get('validityDate');
      if (startDate) {
        validityControl?.setValidators([
          Validators.required,
          this.minDateValidator(new Date(startDate)),
        ]);
        validityControl?.updateValueAndValidity();
      }
    });
  }

  private minDateValidator(minDate: Date): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      const value = control.value;
      if (!value) return null;

      const date = new Date(value);
      return date >= minDate ? null : { minDate: true };
    };
  }

  private async loadClients(): Promise<void> {
    try {
      const userRole = await this.authService.getCurrentUserRole();
      const clientId = await this.authService.getCurrentClientId();

      console.log('Role do usuário:', userRole);
      console.log('Client ID do usuário:', clientId);

      const clientsCollection = collection(this.firestore, 'clients');
      let clientsSnapshot;

      if (userRole === 'admin_client' && clientId) {
        console.log('Filtrando clientes para admin_client');
        // Filtra pelo ID do documento
        clientsSnapshot = await getDocs(
          query(clientsCollection, where('__name__', '==', clientId))
        );
      } else if (userRole === 'admin_master') {
        console.log('Carregando todos os clientes para admin_master');
        clientsSnapshot = await getDocs(clientsCollection);
      } else {
        console.warn('Usuário não tem permissão para acessar clientes.');
        this.clients = [];
        return;
      }

      console.log('Clientes retornados:', clientsSnapshot.docs);

      // Mapeia os clientes para o formulário
      this.clients = clientsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['companyName'] || 'Cliente sem nome',
      }));

      console.log('Lista de clientes carregados:', this.clients);
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

    const { clientId, credits, startDate, validityDate, notes } =
      this.orderForm.value;

    try {
      const ordersCollection = collection(this.firestore, 'creditOrders');
      await addDoc(ordersCollection, {
        clientId,
        credits,
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
