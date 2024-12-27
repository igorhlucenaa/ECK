import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  Firestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface Order {
  id: string;
  clientId: string;
  clientName?: string;
  totalAmount: number;
  status: 'Pendente' | 'Aprovado' | 'Rejeitado';
  createdAt: Date;
}

@Component({
  selector: 'app-credit-orders',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule],
  templateUrl: './credit-orders.component.html',
  styleUrls: ['./credit-orders.component.scss'],
})
export class CreditOrdersComponent implements OnInit {
  displayedColumns: string[] = [
    'id',
    'clientName',
    'totalAmount',
    'status',
    'createdAt',
    'actions',
  ];
  dataSource = new MatTableDataSource<Order>();

  startDate: Date | null = null;
  endDate: Date | null = null;
  selectedStatus: string = '';
  originalData: Order[] = []; // Adicione esta propriedade

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  private async loadOrders(): Promise<void> {
    try {
      const ordersCollection = collection(this.firestore, 'creditOrders');
      const ordersSnapshot = await getDocs(ordersCollection);
      const orders = ordersSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data['createdAt']?.toDate(), // Converte Timestamp para Date
        };
      }) as Order[];

      const clientsCollection = collection(this.firestore, 'clients');
      const clientsSnapshot = await getDocs(clientsCollection);
      const clientsMap: Record<string, string> = clientsSnapshot.docs.reduce(
        (acc, doc) => ({
          ...acc,
          [doc.id]: doc.data()['name'] || 'Cliente não identificado',
        }),
        {}
      );

      this.originalData = orders.map((order) => ({
        ...order,
        clientName: clientsMap[order.clientId] || 'Cliente não identificado',
      })); // Armazena os dados originais

      this.dataSource.data = [...this.originalData]; // Atualiza o dataSource com os dados originais

      console.log('Pedidos carregados:', this.dataSource.data);

      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      this.snackBar.open('Erro ao carregar pedidos.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  openNewOrderForm(): void {
    this.router.navigate(['/orders/new']);
  }

  async deleteOrder(orderId: string): Promise<void> {
    try {
      const orderDocRef = doc(this.firestore, `creditOrders/${orderId}`);
      await deleteDoc(orderDocRef);

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

  applyFilter(): void {
    const filteredData = this.originalData.filter((order) => {
      const matchesStatus =
        !this.selectedStatus || order.status === this.selectedStatus;

      const matchesDate =
        (!this.startDate || order.createdAt >= this.startDate) &&
        (!this.endDate || order.createdAt <= this.endDate);

      return matchesStatus && matchesDate;
    });

    console.log('Dados filtrados:', filteredData);

    this.dataSource.data = filteredData; // Atualiza apenas o dataSource

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  resetFilters(): void {
    this.startDate = null;
    this.endDate = null;
    this.selectedStatus = '';
    this.dataSource.data = [...this.originalData]; // Restaura os dados originais
    this.dataSource.paginator?.firstPage();
  }

  async approveOrder(orderId: string): Promise<void> {
    try {
      const orderDoc = doc(this.firestore, `creditOrders/${orderId}`);
      await updateDoc(orderDoc, { status: 'Aprovado' });

      this.dataSource.data = this.dataSource.data.map((order) =>
        order.id === orderId ? { ...order, status: 'Aprovado' } : order
      );

      this.snackBar.open('Pedido aprovado com sucesso!', 'Fechar', {
        duration: 3000,
      });
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
}
