import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  Firestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from '@angular/fire/firestore';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';

export interface Order {
  id: string;
  clientName: string;
  openingBalance: number; // Créditos iniciais
  usedBalance: number; // Créditos utilizados
  remainingBalance: number; // Créditos restantes
  daysRemaining: number; // Dias até expiração
  status: 'Pendente' | 'Aprovado' | 'Rejeitado' | 'Expirado';
  createdAt: Date;
}

@Component({
  selector: 'app-credit-orders',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatSnackBarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatDatepickerModule,
    MatNativeDateModule,
    RouterModule,
    FormsModule,
  ],
  templateUrl: './credit-orders.component.html',
  styleUrls: ['./credit-orders.component.scss'],
})
export class CreditOrdersComponent implements OnInit {
  displayedColumns: string[] = [
    'id',
    'clientName',
    'openingBalance',
    'usedBalance',
    'remainingBalance',
    'daysRemaining',
    'status',
    'actions',
  ];
  dataSource = new MatTableDataSource<Order>();

  startDate: Date | null = null;
  endDate: Date | null = null;
  selectedStatus: string = '';
  originalData: Order[] = []; // Dados originais para filtro

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadOrders();
    this.expireOrders(); // Processa pedidos expirados na inicialização
  }

  private async loadOrders(): Promise<void> {
    try {
      const ordersCollection = collection(this.firestore, 'creditOrders');
      const ordersSnapshot = await getDocs(ordersCollection);
      const clientsCollection = collection(this.firestore, 'clients');
      const clientsSnapshot = await getDocs(clientsCollection);

      const clientsMap: Record<string, string> = clientsSnapshot.docs.reduce(
        (acc, doc) => ({
          ...acc,
          [doc.id]: doc.data()['name'] || 'Não identificado',
        }),
        {}
      );

      const orders = ordersSnapshot.docs.map((doc) => {
        const data = doc.data();
        const validityDate = data['validityDate']?.toDate();
        const daysRemaining = validityDate
          ? Math.max(
              0,
              Math.ceil(
                (validityDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              )
            )
          : 0;

        const openingBalance = data['credits'] || 0;
        const remainingBalance = data['remainingCredits'] ?? openingBalance; // Se não houver remainingCredits, assume o valor inicial de credits
        const usedBalance = openingBalance - remainingBalance; // Calcula o saldo utilizado corretamente

        return {
          id: doc.id,
          clientName: clientsMap[data['clientId']] || 'Não identificado',
          openingBalance,
          usedBalance,
          remainingBalance,
          daysRemaining,
          status: data['status'],
          createdAt: data['createdAt']?.toDate(),
        } as Order;
      });

      this.originalData = orders;
      this.dataSource.data = orders;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      this.snackBar.open('Erro ao carregar pedidos.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  applyFilter(): void {
    const filteredData = this.originalData.filter((order) => {
      const matchesStatus =
        !this.selectedStatus || order.status === this.selectedStatus;

      const matchesDate =
        (!this.startDate || order.createdAt >= this.startDate) &&
        (!this.endDate || order.createdAt <= this.endDate);

      return matchesStatus && matchesDate;
    });

    this.dataSource.data = filteredData;

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  applyTextFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value
      .trim()
      .toLowerCase();
    this.dataSource.filter = filterValue;
  }

  resetFilters(): void {
    this.startDate = null;
    this.endDate = null;
    this.selectedStatus = '';
    this.dataSource.data = [...this.originalData];
    this.dataSource.paginator?.firstPage();
  }

  async approveOrder(orderId: string): Promise<void> {
    try {
      const orderDoc = doc(this.firestore, `creditOrders/${orderId}`);
      const orderSnapshot = await getDoc(orderDoc);


      const orderData = orderSnapshot.data();

      if (!orderData) {
        throw new Error('Pedido não encontrado.');
      }

      const clientId = orderData['clientId'];
      const creditsToAdd = orderData['credits'];

      // Atualiza o status do pedido
      await updateDoc(orderDoc, { status: 'Aprovado' });

      // Atualiza o saldo do cliente
      const clientDoc = doc(this.firestore, `clients/${clientId}`);
      const clientSnapshot = await getDoc(clientDoc);
      const clientData = clientSnapshot.data();

      if (!clientData) {
        throw new Error('Cliente não encontrado.');
      }

      const currentCredits = clientData['credits'] || 0;
      await updateDoc(clientDoc, { credits: currentCredits + creditsToAdd });

      // Atualiza a tabela localmente
      this.dataSource.data = this.dataSource.data.map((order) =>
        order.id === orderId ? { ...order, status: 'Aprovado' } : order
      );

      this.snackBar.open(
        'Pedido aprovado com sucesso e créditos atualizados!',
        'Fechar',
        {
          duration: 3000,
        }
      );
    } catch (error) {
      console.error('Erro ao aprovar pedido:', error);
      this.snackBar.open('Erro ao aprovar pedido.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async rejectOrder(orderId: string): Promise<void> {
    try {
      const orderDoc = doc(this.firestore, `creditOrders/${orderId}`);
      await updateDoc(orderDoc, { status: 'Rejeitado' });

      this.dataSource.data = this.dataSource.data.map((order) =>
        order.id === orderId ? { ...order, status: 'Rejeitado' } : order
      );

      this.snackBar.open('Pedido rejeitado com sucesso!', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao rejeitar pedido:', error);
      this.snackBar.open('Erro ao rejeitar pedido.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async deleteOrder(orderId: string): Promise<void> {
    try {
      const orderDoc = doc(this.firestore, `creditOrders/${orderId}`);
      await deleteDoc(orderDoc);

      this.dataSource.data = this.dataSource.data.filter(
        (order) => order.id !== orderId
      );

      this.snackBar.open('Pedido excluído com sucesso!', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao excluir pedido:', error);
      this.snackBar.open('Erro ao excluir pedido.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  private async expireOrders(): Promise<void> {
    try {
      const ordersCollection = collection(this.firestore, 'creditOrders');
      const ordersSnapshot = await getDocs(ordersCollection);

      const now = new Date();
      const expiredOrders: {
        orderId: string;
        clientId: string;
        creditsToDeduct: number;
      }[] = [];

      // Filtra pedidos expirados
      ordersSnapshot.docs.forEach((doc) => {
        const orderData = doc.data();
        const validityDate = orderData['validityDate']?.toDate();

        if (
          validityDate &&
          validityDate < now &&
          orderData['status'] === 'Aprovado'
        ) {
          expiredOrders.push({
            orderId: doc.id,
            clientId: orderData['clientId'],
            creditsToDeduct: orderData['remainingCredits'] || 0,
          });
        }
      });

      // Atualiza pedidos e clientes
      for (const { orderId, clientId, creditsToDeduct } of expiredOrders) {
        const orderDoc = doc(this.firestore, `creditOrders/${orderId}`);
        const clientDoc = doc(this.firestore, `clients/${clientId}`);

        // Atualiza status do pedido
        await updateDoc(orderDoc, { status: 'Expirado', remainingCredits: 0 });

        // Deduz créditos do cliente
        const clientSnapshot = await getDoc(clientDoc);
        const clientData = clientSnapshot.data();

        if (clientData) {
          const currentCredits = clientData['credits'] || 0;
          await updateDoc(clientDoc, {
            credits: Math.max(0, currentCredits - creditsToDeduct),
          });
        }
      }

      this.snackBar.open(
        'Pedidos expirados processados com sucesso!',
        'Fechar',
        {
          duration: 3000,
        }
      );
    } catch (error) {
      console.error('Erro ao processar pedidos expirados:', error);
      this.snackBar.open('Erro ao processar pedidos expirados.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  openNewOrderForm(): void {
    this.router.navigate(['/orders/new']);
  }
}
