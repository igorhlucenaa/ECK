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
  query,
  orderBy,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { TranslateModule } from '@ngx-translate/core';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';

export interface Order {
  id: string;
  clientName: string;
  openingBalance: number; // Créditos iniciais
  usedBalance: number; // Créditos utilizados
  remainingBalance: number; // Créditos restantes
  daysRemaining: number; // Dias até expiração
  status: 'Pendente' | 'Aprovado' | 'Rejeitado' | 'Expirado';
  createdAt: Date;
  expirationDate: Date; // Data de expiração
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
    MatTooltipModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    AppPageHeaderComponent,
  ],
  templateUrl: './credit-orders.component.html',
  styleUrls: ['./credit-orders.component.scss'],
})
export class CreditOrdersComponent implements OnInit {
  displayedColumns: string[] = [
    'clientName',
    'status',
    'openingBalance',
    'usedBalance',
    'remainingBalance',
    'expirationDate',
    'daysRemaining',
    'createdAt',
    'actions',
  ];

  userRole: any;
  dataSource = new MatTableDataSource<Order>();

  startDate: Date | null = null;
  endDate: Date | null = null;
  selectedStatus: string = '';
  originalData: Order[] = [];
  clientsList: { id: string; name: string }[] = [];
  clientsFiltered: { id: string; name: string }[] = [];
  clientSearchCtrl = new FormControl('');
  selectedClient: string = '';

  editingExpirationId: string | null = null;
  editingExpirationDate: Date | null = null;
  editingExpirationDateStr: string = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  private getStatusPriority(status: string): number {
    // Define a prioridade para cada status
    switch (status) {
      case 'Pendente':
        return 1;
      case 'Aprovado':
        return 2;
      case 'Rejeitado':
        return 3;
      case 'Expirado':
        return 4;
      default:
        return 5; // Prioridade mais baixa para status desconhecidos
    }
  }

  private async loadOrders(): Promise<void> {
    try {
      this.userRole = await this.authService.getCurrentUserRole();
      const userClientIds = await this.authService.getCurrentUserClientIds();
      const clientId = userClientIds.length > 0 ? userClientIds[0] : null;

      const clientsCollection = collection(this.firestore, 'clients');
      let clientsSnapshot;

      if (this.userRole === 'admin_master') {
        // Admin_master vê todos os clientes
        clientsSnapshot = await getDocs(clientsCollection);
      } else if (userClientIds.length > 0) {
        // Admin_client vê apenas seus clientes vinculados
        clientsSnapshot = await getDocs(query(clientsCollection, where('__name__', 'in', userClientIds)));
      } else {
        clientsSnapshot = await getDocs(query(clientsCollection, where('__name__', '==', 'nonexistent')));
      }

      this.clientsList = clientsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['companyName'] || 'Não identificado',
      }));
      this.clientsFiltered = [...this.clientsList];
      this.clientSearchCtrl.valueChanges.subscribe(s => {
        const q = (s || '').toLowerCase();
        this.clientsFiltered = this.clientsList.filter(c => c.name.toLowerCase().includes(q));
      });

      if (this.userRole === 'admin_master') {
        await this.expireOrders();
        await this.sincronizarCreditosClientes();
      }

      const ordersCollection = collection(this.firestore, 'creditOrders');
      let queryConstraint = query(ordersCollection);

      if (this.userRole === 'admin_client' && userClientIds.length > 0) {
        queryConstraint = query(
          ordersCollection,
          where('clientId', 'in', userClientIds)
        );
      }

      const ordersSnapshot = await getDocs(queryConstraint);

      const clientsMap: Record<string, string> = this.clientsList.reduce(
        (acc: any, client) => {
          acc[client.id] = client.name;
          return acc;
        },
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

        const totalCredits = data['credits'] || 0;
        // FIFO: cada pedido rastreia seu próprio remainingCredits
        // remainingCredits é inicializado = credits quando aprovado e decrementado a cada uso
        const orderRemaining: number = data['remainingCredits'] ?? (data['status'] === 'Aprovado' ? totalCredits : 0);
        const usedBalance = data['status'] === 'Aprovado' ? totalCredits - orderRemaining : 0;
        const remainingBalance = data['status'] === 'Aprovado' ? orderRemaining : 0;

        return {
          id: doc.id,
          clientId: data['clientId'],
          clientName: clientsMap[data['clientId']] || 'Não identificado',
          openingBalance: totalCredits,
          usedBalance,
          remainingBalance,
          daysRemaining,
          expirationDate: validityDate,
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

  resetClientSearch(): void {
    this.clientSearchCtrl.setValue('', { emitEvent: false });
    this.clientsFiltered = [...this.clientsList];
  }

  applyFilter(): void {
    if (this.startDate && this.endDate && this.startDate > this.endDate) {
      this.snackBar.open(
        'A data inicial não pode ser maior que a data final.',
        'Fechar',
        { duration: 3000 }
      );
      return;
    }

    const filteredData = this.originalData.filter((order: any) => {
      const matchesStatus =
        !this.selectedStatus || order.status === this.selectedStatus;
      const matchesClient =
        !this.selectedClient || order.clientId === this.selectedClient;
      const matchesDate =
        (!this.startDate || order.createdAt >= this.startDate) &&
        (!this.endDate || order.createdAt <= this.endDate);

      return matchesStatus && matchesClient && matchesDate;
    });

    this.dataSource.data = filteredData;
    this.dataSource.paginator?.firstPage();
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
    this.selectedClient = '';

    this.loadOrders();
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

      // Atualiza o status do pedido para "Aprovado" e inicializa remainingCredits
      await updateDoc(orderDoc, { status: 'Aprovado', remainingCredits: creditsToAdd });

      // Atualiza os créditos remanescentes do cliente
      const clientDoc = doc(this.firestore, `clients/${clientId}`);
      const clientSnapshot = await getDoc(clientDoc);
      const clientData = clientSnapshot.data();

      if (!clientData) {
        throw new Error('Cliente não encontrado.');
      }

      const currentCredits = clientData['credits'] || 0;

      await updateDoc(clientDoc, {
        credits: currentCredits + creditsToAdd,
      });

      this.snackBar.open(
        'Pedido aprovado com sucesso e créditos adicionados!',
        'Fechar',
        { duration: 3000 }
      );

      await this.loadOrders();
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

      // Atualiza o status do pedido para "Rejeitado"
      await updateDoc(orderDoc, { status: 'Rejeitado' });

      this.snackBar.open('Pedido rejeitado com sucesso!', 'Fechar', {
        duration: 3000,
      });

      await this.loadOrders();
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
      const orderSnapshot = await getDoc(orderDoc);
      const orderData = orderSnapshot.data();

      if (!orderData) {
        throw new Error('Pedido não encontrado.');
      }

      const clientId: string = orderData['clientId'];

      // Exclui o pedido
      await deleteDoc(orderDoc);

      // Atualiza a tabela localmente
      this.dataSource.data = this.dataSource.data.filter(
        (order) => order.id !== orderId
      );

      // Recalcula credits/creditsUsed/reservedCredits a partir dos dados reais
      // (inclui FIFO + reservas ativas) — não usa o valor bruto do pedido excluído
      await this.sincronizarCreditosCliente(clientId);

      this.snackBar.open(
        'Pedido excluído e créditos atualizados com sucesso!',
        'Fechar',
        { duration: 3000 }
      );
    } catch (error) {
      console.error('Erro ao excluir pedido:', error);
      this.snackBar.open('Erro ao excluir pedido.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  /**
   * Sincroniza créditos de UM único cliente a partir das fontes de verdade.
   * Usado pelo deleteOrder e pela Cloud Function onAssessmentCompleted.
   * Para sincronização de todos os clientes use sincronizarCreditosClientes().
   */
  private async sincronizarCreditosCliente(clientId: string): Promise<void> {
    try {
      const now = new Date();

      // 1. Pedidos aprovados válidos para este cliente, ordenados FIFO
      const ordersSnap = await getDocs(
        query(
          collection(this.firestore, 'creditOrders'),
          where('clientId', '==', clientId),
          where('status', '==', 'Aprovado')
        )
      );
      const orders = ordersSnap.docs
        .filter(d => {
          const v = d.data()['validityDate']?.toDate();
          return !v || v >= now;
        })
        .sort((a, b) =>
          (a.data()['createdAt']?.toMillis?.() ?? 0) -
          (b.data()['createdAt']?.toMillis?.() ?? 0)
        )
        .map(d => ({ id: d.id, credits: (d.data()['credits'] as number) || 0 }));

      // 2. Links concluídos deste cliente (clientId armazenado no link)
      const completedSnap = await getDocs(
        query(
          collection(this.firestore, 'assessmentLinks'),
          where('clientId', '==', clientId),
          where('status', '==', 'completed')
        )
      );
      const used = completedSnap.size;

      // 3. Links pendentes com crédito reservado deste cliente
      const reservedSnap = await getDocs(
        query(
          collection(this.firestore, 'assessmentLinks'),
          where('clientId', '==', clientId),
          where('creditReserved', '==', true),
          where('status', '==', 'pending')
        )
      );
      const reserved = reservedSnap.size;

      // 4. FIFO: atualiza remainingCredits por pedido
      let toDeduct = used;
      for (const order of orders) {
        const consumed = Math.min(toDeduct, order.credits);
        const remaining = order.credits - consumed;
        toDeduct -= consumed;
        await updateDoc(doc(this.firestore, `creditOrders/${order.id}`), {
          remainingCredits: remaining,
        });
      }

      // 5. Atualiza o cliente com os três campos
      const purchased = orders.reduce((s, o) => s + o.credits, 0);
      const available = Math.max(0, purchased - used - reserved);
      await updateDoc(doc(this.firestore, `clients/${clientId}`), {
        credits: available,
        creditsUsed: used,
        reservedCredits: reserved,
      });
    } catch (error) {
      console.error(`Erro ao sincronizar créditos do cliente ${clientId}:`, error);
    }
  }

  private async expireOrders(): Promise<void> {
    try {
      const ordersCollection = collection(this.firestore, 'creditOrders');
      const ordersSnapshot = await getDocs(ordersCollection);

      const now = new Date();
      const expiredOrders: { orderId: string; clientId: string }[] = [];

      ordersSnapshot.docs.forEach((d) => {
        const orderData = d.data();
        const validityDate = orderData['validityDate']?.toDate();
        if (validityDate && validityDate < now && orderData['status'] === 'Aprovado') {
          expiredOrders.push({ orderId: d.id, clientId: orderData['clientId'] });
        }
      });

      if (expiredOrders.length === 0) return;

      // ── Batch 1: marca pedidos como Expirado ────────────────────────────
      const orderBatch = writeBatch(this.firestore);
      for (const { orderId } of expiredOrders) {
        orderBatch.update(doc(this.firestore, `creditOrders/${orderId}`), {
          status: 'Expirado',
          remainingCredits: 0,
        });
      }
      await orderBatch.commit();

      // ── Por cliente afetado: cancela links pendentes reservados ─────────
      const affectedClientIds = new Set(
        expiredOrders.map(o => o.clientId).filter(Boolean)
      );

      for (const clientId of affectedClientIds) {
        // Busca links pending com creditReserved=true para este cliente
        const pendingSnap = await getDocs(
          query(
            collection(this.firestore, 'assessmentLinks'),
            where('clientId', '==', clientId),
            where('status', '==', 'pending'),
            where('creditReserved', '==', true)
          )
        );

        if (pendingSnap.empty) continue;

        // Batch 2: cancela cada link reservado
        const linkBatch = writeBatch(this.firestore);
        for (const linkDoc of pendingSnap.docs) {
          linkBatch.update(doc(this.firestore, 'assessmentLinks', linkDoc.id), {
            status: 'expired',
            creditReserved: false,
            expiredAt: new Date(),
          });
        }
        await linkBatch.commit();

        // Devolve os créditos reservados ao cliente imediatamente
        // (sincronizarCreditosClientes vai confirmar os valores exatos depois)
        const expiredCount = pendingSnap.size;
        const clientDocRef = doc(this.firestore, `clients/${clientId}`);
        const clientSnap = await getDoc(clientDocRef);
        if (clientSnap.exists()) {
          const d = clientSnap.data();
          await updateDoc(clientDocRef, {
            credits:        (d['credits']        || 0) + expiredCount,
            reservedCredits: Math.max(0, (d['reservedCredits'] || 0) - expiredCount),
          });
        }
      }
    } catch (error) {
      console.error('Erro ao processar pedidos expirados:', error);
    }
  }

  openNewOrderForm(): void {
    this.router.navigate(['/orders/new']);
  }

  startEditExpiration(orderId: string, currentDate: Date): void {
    this.editingExpirationId = orderId;
    const d = currentDate ? new Date(currentDate) : new Date();
    this.editingExpirationDate = d;
    this.editingExpirationDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  setEditingDate(value: string): void {
    this.editingExpirationDateStr = value;
    this.editingExpirationDate = value ? new Date(value + 'T12:00:00') : null;
  }

  cancelEditExpiration(): void {
    this.editingExpirationId = null;
    this.editingExpirationDate = null;
  }

  async saveExpirationDate(orderId: string): Promise<void> {
    if (!this.editingExpirationDate) return;
    try {
      const orderRef = doc(this.firestore, `creditOrders/${orderId}`);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) return;

      const orderData = orderSnap.data();
      const currentStatus: string = orderData['status'];
      const now = new Date();
      const newDate = this.editingExpirationDate;

      const update: Record<string, any> = { validityDate: newDate };

      // Expirado + nova data futura → reativa como Aprovado
      // remainingCredits = credits total (sincronizarCreditosClientes vai recalcular FIFO)
      if (currentStatus === 'Expirado' && newDate > now) {
        update['status'] = 'Aprovado';
        update['remainingCredits'] = orderData['credits'] || 0;
      }
      // Aprovado + nova data passada → expira imediatamente
      else if (currentStatus === 'Aprovado' && newDate <= now) {
        update['status'] = 'Expirado';
        update['remainingCredits'] = 0;
      }
      // Pendente / Rejeitado → apenas atualiza a data, sem alterar status

      await updateDoc(orderRef, update);
      this.cancelEditExpiration();
      this.snackBar.open('Data de expiração atualizada!', 'Fechar', { duration: 3000 });
      await this.loadOrders(); // executa expireOrders + sincronizarCreditosClientes
    } catch (error) {
      console.error('Erro ao atualizar data de expiração:', error);
      this.snackBar.open('Erro ao atualizar data de expiração.', 'Fechar', { duration: 3000 });
    }
  }

  private async sincronizarCreditosClientes(): Promise<void> {
    try {
      const now = new Date();

      // 1. Pedidos aprovados — sem orderBy para incluir docs sem createdAt indexado
      const ordersSnap = await getDocs(
        query(collection(this.firestore, 'creditOrders'), where('status', '==', 'Aprovado'))
      );

      // Agrupa pedidos válidos por cliente, ordenados por createdAt ASC (FIFO)
      const ordersByClient = new Map<string, { id: string; credits: number }[]>();
      const sortedOrderDocs = ordersSnap.docs.slice().sort((a, b) => {
        const tA = a.data()['createdAt']?.toMillis?.() ?? 0;
        const tB = b.data()['createdAt']?.toMillis?.() ?? 0;
        return tA - tB;
      });
      sortedOrderDocs.forEach(d => {
        const data = d.data();
        const validityDate = data['validityDate']?.toDate();
        if (validityDate && validityDate < now) return;
        const clientId = data['clientId'];
        if (!clientId) return;
        if (!ordersByClient.has(clientId)) ordersByClient.set(clientId, []);
        ordersByClient.get(clientId)!.push({ id: d.id, credits: data['credits'] || 0 });
      });

      // 2. Créditos usados: assessmentLinks completed por cliente
      //    Links recentes têm clientId direto; legados resolvem via participante.
      const completedLinksSnap = await getDocs(
        query(collection(this.firestore, 'assessmentLinks'), where('status', '==', 'completed'))
      );
      const usedByClient = new Map<string, number>();
      const participantClientCache = new Map<string, string>();

      for (const linkDoc of completedLinksSnap.docs) {
        const linkData = linkDoc.data();
        let clientId: string | undefined = linkData['clientId'];

        if (!clientId) {
          // Fallback para links legados sem clientId armazenado
          const participantId = linkData['participantId'];
          if (!participantId) continue;
          clientId = participantClientCache.get(participantId);
          if (!clientId) {
            const pSnap = await getDoc(doc(this.firestore, `participants/${participantId}`));
            clientId = pSnap.exists() ? pSnap.data()['clientId'] : undefined;
            if (clientId) participantClientCache.set(participantId, clientId);
          }
        }
        if (!clientId) continue;
        usedByClient.set(clientId, (usedByClient.get(clientId) || 0) + 1);
      }

      // 3. Créditos reservados: assessmentLinks pending com creditReserved=true por cliente
      const reservedLinksSnap = await getDocs(
        query(
          collection(this.firestore, 'assessmentLinks'),
          where('creditReserved', '==', true),
          where('status', '==', 'pending')
        )
      );
      const reservedByClient = new Map<string, number>();
      reservedLinksSnap.docs.forEach(d => {
        const clientId = d.data()['clientId'] as string;
        if (!clientId) return;
        reservedByClient.set(clientId, (reservedByClient.get(clientId) || 0) + 1);
      });

      // 4. FIFO: distribui créditos usados nos pedidos e atualiza remainingCredits
      for (const [clientId, orders] of ordersByClient.entries()) {
        let toDeduct = usedByClient.get(clientId) || 0;
        for (const order of orders) {
          const consumed = Math.min(toDeduct, order.credits);
          const remaining = order.credits - consumed;
          toDeduct -= consumed;
          await updateDoc(doc(this.firestore, `creditOrders/${order.id}`), {
            remainingCredits: remaining,
          });
        }
      }

      // 5. Atualiza cada cliente: credits = comprado − usado − reservado
      const allClientIds = new Set([
        ...ordersByClient.keys(),
        ...usedByClient.keys(),
        ...reservedByClient.keys(),
      ]);
      for (const clientId of allClientIds) {
        const orders   = ordersByClient.get(clientId)  || [];
        const purchased = orders.reduce((sum, o) => sum + o.credits, 0);
        const used      = usedByClient.get(clientId)    || 0;
        const reserved  = reservedByClient.get(clientId) || 0;
        const available = Math.max(0, purchased - used - reserved);
        await updateDoc(doc(this.firestore, `clients/${clientId}`), {
          credits: available,
          creditsUsed: used,
          reservedCredits: reserved,
        });
      }
    } catch (error) {
      console.error('Erro ao sincronizar créditos:', error);
    }
  }
}
