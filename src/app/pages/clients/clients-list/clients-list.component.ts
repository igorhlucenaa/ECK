import { Component, OnInit, ViewChild } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  getDocs,
  where,
  Timestamp,
  deleteDoc,
  doc,
  writeBatch,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { Router, RouterModule } from '@angular/router';
import { AddClientDialogComponent } from '../add-client-dialog/add-client-dialog.component';
import { PhonePipe } from 'src/app/pipe/phone.pipe';
import { CnpjPipe } from 'src/app/pipe/cnpj.pipe';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';
import { ToastService } from 'src/app/services/toast.service';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    RouterModule,
    CnpjPipe,
    TranslateModule,
    AppPageHeaderComponent,
  ],
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit {
  displayedColumns: string[] = [
    'select',
    'companyName',
    'sector',
    'cnpj',
    'credits',
    'actions',
  ];
  dataSource = new MatTableDataSource<any>();
  searchValue: string = '';
  cnpjFilter: string = '';
  sectorFilter: string = '';
  sectors: string[] = [];
  selectedClientIds = new Set<string>();
  isAdminMaster = true;
  userClientIds: string[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private router: Router,
    private translate: TranslateService,
    private toast: ToastService,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    const role = await this.authService.getCurrentUserRole();
    this.isAdminMaster = role === 'admin_master';
    this.userClientIds = await this.authService.getCurrentUserClientIds();
    if (!this.isAdminMaster) {
      this.displayedColumns = ['companyName', 'sector', 'cnpj', 'credits'];
    }
    this.loadClients();
  }

  private async loadClients() {
    try {
      let allDocs: any[] = [];

      if (this.isAdminMaster) {
        const snapshot = await getDocs(collection(this.firestore, 'clients'));
        allDocs = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      } else {
        // admin_client: carrega apenas os clientes vinculados
        const snaps = await Promise.all(
          this.userClientIds.map(id => getDocs(query(collection(this.firestore, 'clients'), where('__name__', '==', id))))
        );
        allDocs = snaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      }

      const clients = allDocs.sort((a, b) => {
          const nameA = a.companyName?.toLowerCase() || '';
          const nameB = b.companyName?.toLowerCase() || '';
          return nameA.localeCompare(nameB);
        });

      // Processar todos os clientes e calcular créditos
      await Promise.all(
        clients.map((client) => this.calculateCreditsForClient(client))
      );


      this.dataSource.data = clients;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;

      // Extrair setores únicos para o filtro dropdown
      this.sectors = [...new Set(
        clients.map(c => c.sector).filter(s => s && s.trim() !== '')
      )].sort();

      this.dataSource.filterPredicate = (data, filter) => {
        const f = JSON.parse(filter || '{}');
        const nameMatch = !f.name || (data.companyName || '').toLowerCase().includes(f.name);
        const cnpjMatch = !f.cnpj || (data.cnpj || '').replace(/\D/g, '').includes(f.cnpj);
        const sectorMatch = !f.sector || data.sector === f.sector;
        return nameMatch && cnpjMatch && sectorMatch;
      };

      this.applyFilters();
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.toast.error(this.translate.instant('Erro ao carregar a lista de clientes. Tente novamente mais tarde.'));
    }
  }

  private async calculateCreditsForClient(client: any) {
    const ordersCollection = collection(this.firestore, 'creditOrders');
    const ordersQuery = query(
      ordersCollection,
      where('clientId', '==', client.id),
      where('status', '==', 'Aprovado')
    );

    try {
      const ordersSnapshot = await getDocs(ordersQuery);
      const currentDate = new Date();
      let creditsPurchased = 0;

      ordersSnapshot.docs.forEach((orderDoc) => {
        const orderData = orderDoc.data();
        const validityDate = orderData['validityDate']?.toDate();
        const credits = orderData['credits'] || 0;
        // Comprados = soma de pedidos aprovados ainda válidos
        if (validityDate && validityDate > currentDate) {
          creditsPurchased += credits;
        }
      });

      client.creditsPurchased = creditsPurchased;
      // creditsUsed e credits (disponíveis) vêm diretamente do doc do cliente no Firestore
      // — são mantidos incrementalmente pelo sistema (respostas, aprovações, expirações)
      client.creditsUsed = client.creditsUsed || 0;
      client.creditsAvailable = client.credits || 0;
    } catch (error) {
      console.error('Erro ao calcular créditos:', error);
    }
  }

  applyFilter(event: Event) {
    this.searchValue = (event.target as HTMLInputElement).value;
    this.applyFilters();
  }

  applyFilters() {
    const filterObj = {
      name: this.searchValue.trim().toLowerCase(),
      cnpj: this.cnpjFilter.trim().replace(/\D/g, ''),
      sector: this.sectorFilter
    };
    this.dataSource.filter = JSON.stringify(filterObj);
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  clearFilters() {
    this.searchValue = '';
    this.cnpjFilter = '';
    this.sectorFilter = '';
    this.applyFilters();
  }

  deleteClient(id: string) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        message: this.translate.instant('Ao remover o cliente, todos os projetos, grupos e usuários associados também serão excluídos. Deseja continuar?'),
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        // Referências às coleções relacionadas
        const projectsCollection = collection(this.firestore, 'projects');
        const userGroupsCollection = collection(this.firestore, 'userGroups');
        const usersCollection = collection(this.firestore, 'users');

        // Queries para localizar documentos relacionados
        const projectsQuery = query(
          projectsCollection,
          where('clientId', '==', id)
        );
        const userGroupsQuery = query(
          userGroupsCollection,
          where('clientId', '==', id)
        );
        const usersQuery = query(usersCollection, where('client', '==', id));

        // Função auxiliar para deletar documentos de uma query
        const deleteDocuments = async (querySnapshot: any) => {
          const batch = writeBatch(this.firestore);
          querySnapshot.forEach((doc: any) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        };

        // Deletar cliente e seus relacionados
        Promise.all([
          getDocs(projectsQuery).then(deleteDocuments),
          getDocs(userGroupsQuery).then(deleteDocuments),
          getDocs(usersQuery).then(deleteDocuments),
        ])
          .then(() => {
            // Após excluir documentos relacionados, exclua o cliente
            const clientDocRef = doc(this.firestore, `clients/${id}`);
            return deleteDoc(clientDocRef);
          })
          .then(() => {
            this.toast.success(this.translate.instant('Cliente e dados relacionados excluídos com sucesso.'));
            // Atualizar tabela
            this.dataSource.data = this.dataSource.data.filter(
              (client) => client.id !== id
            );
          })
          .catch((error) => {
            console.error(
              'Erro ao excluir cliente e dados relacionados:',
              error
            );
            this.toast.error(this.translate.instant('Erro ao excluir cliente. Verifique os dados relacionados e tente novamente.'));
          });
      }
    });
  }

  // ─── Seleção em massa ────────────────────────────────────────
  isAllClientsSelected(): boolean {
    const visible = this.dataSource.filteredData;
    return visible.length > 0 && visible.every(c => this.selectedClientIds.has(c.id));
  }

  isSomeClientsSelected(): boolean {
    return this.dataSource.filteredData.some(c => this.selectedClientIds.has(c.id));
  }

  toggleAllClients(checked: boolean): void {
    if (checked) {
      this.dataSource.filteredData.forEach(c => this.selectedClientIds.add(c.id));
    } else {
      this.dataSource.filteredData.forEach(c => this.selectedClientIds.delete(c.id));
    }
  }

  toggleClientSelect(id: string): void {
    if (this.selectedClientIds.has(id)) {
      this.selectedClientIds.delete(id);
    } else {
      this.selectedClientIds.add(id);
    }
  }

  deleteSelectedClients(): void {
    const count = this.selectedClientIds.size;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        message: this.translate.instant(`Ao remover ${count} cliente(s), todos os projetos, grupos e usuários associados também serão excluídos. Deseja continuar?`),
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      const ids = Array.from(this.selectedClientIds);
      const projectsCol = collection(this.firestore, 'projects');
      const groupsCol   = collection(this.firestore, 'userGroups');
      const usersCol    = collection(this.firestore, 'users');

      const deleteByQuery = async (q: any) => {
        const snap = await getDocs(q);
        if (snap.empty) return;
        const batch = writeBatch(this.firestore);
        snap.forEach((d: any) => batch.delete(d.ref));
        await batch.commit();
      };

      try {
        for (const id of ids) {
          await Promise.all([
            deleteByQuery(query(projectsCol, where('clientId', '==', id))),
            deleteByQuery(query(groupsCol,   where('clientId', '==', id))),
            deleteByQuery(query(usersCol,    where('client',   '==', id))),
          ]);
          await deleteDoc(doc(this.firestore, `clients/${id}`));
        }
        this.dataSource.data = this.dataSource.data.filter(c => !this.selectedClientIds.has(c.id));
        this.selectedClientIds.clear();
        this.toast.success(this.translate.instant('Clientes excluídos com sucesso.'));
      } catch (error) {
        console.error('Erro ao excluir clientes em massa:', error);
        this.toast.error(this.translate.instant('Erro ao excluir clientes. Tente novamente.'));
      }
    });
  }

  openAddClientDialog(client?: any) {
    const dialogRef = this.dialog.open(AddClientDialogComponent, {
      width: '500px',
      data: { client }, // Passa os dados do cliente, se houver
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadClients();
        this.toast.success(this.translate.instant('Lista de clientes atualizada!'));
      }
    });
  }
}
