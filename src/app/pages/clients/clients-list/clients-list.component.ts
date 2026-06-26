import { Component, OnInit, ViewChild } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  getDocs,
  getDoc,
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
import { DependencyCheckService } from 'src/app/services/dependency-check.service';
import { DependencyBlockDialogComponent } from 'src/app/shared/dependency-block-dialog/dependency-block-dialog.component';

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
    private authService: AuthService,
    private dependencyCheck: DependencyCheckService
  ) {}

  async ngOnInit() {
    const role = await this.authService.getCurrentUserRole();
    this.isAdminMaster = role === 'admin_master';
    this.userClientIds = await this.authService.getCurrentUserClientIds();
    if (!this.isAdminMaster) {
      this.displayedColumns = ['companyName', 'sector', 'cnpj', 'credits', 'actions'];
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
        // Adquiridos = soma de pedidos aprovados ainda válidos
        if (validityDate && validityDate > currentDate) {
          creditsPurchased += credits;
        }
      });

      client.creditsPurchased = creditsPurchased;
      // consumedCredits e credits (disponíveis) vêm do doc do cliente no Firestore
      client.creditsUsed = client.consumedCredits ?? client.creditsUsed ?? 0;
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

  async deleteClient(id: string) {
    const clientName = this.dataSource.data.find(c => c.id === id)?.companyName || 'cliente';

    // 1. Verificação prévia de dependências
    const result = await this.dependencyCheck.checkClient(id, clientName);
    if (!result.canDelete) {
      this.dialog.open(DependencyBlockDialogComponent, {
        width: '560px',
        data: { entityLabel: result.entityLabel, blockers: result.blockers },
      });
      return;
    }

    // 2. Sem vínculos — confirmar e excluir
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Excluir cliente',
        message: this.translate.instant(`Tem certeza de que deseja excluir o cliente "${clientName}"?`),
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      try {
        await deleteDoc(doc(this.firestore, `clients/${id}`));
        this.toast.success(this.translate.instant('Cliente excluído com sucesso.'));
        this.dataSource.data = this.dataSource.data.filter((client) => client.id !== id);
      } catch (error) {
        console.error('Erro ao excluir cliente:', error);
        this.toast.error(this.translate.instant('Erro ao excluir cliente. Tente novamente.'));
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

  async deleteSelectedClients(): Promise<void> {
    const ids = Array.from(this.selectedClientIds);

    // 1. Verificação prévia: identificar clientes com vínculos
    const checks = await Promise.all(
      ids.map(async id => {
        const name = this.dataSource.data.find(c => c.id === id)?.companyName || 'cliente';
        return { id, name, result: await this.dependencyCheck.checkClient(id, name) };
      })
    );
    const blocked = checks.filter(c => !c.result.canDelete);
    const deletable = checks.filter(c => c.result.canDelete);

    // 2. Se houver bloqueados, informar e abortar (não exclui parcialmente sem avisar)
    if (blocked.length > 0) {
      const aggregated = blocked.flatMap(b =>
        b.result.blockers.map(bl => ({ ...bl, label: `${bl.label} (${b.name})` }))
      );
      this.dialog.open(DependencyBlockDialogComponent, {
        width: '560px',
        data: {
          entityLabel: blocked.length === 1
            ? blocked[0].result.entityLabel
            : `${blocked.length} clientes selecionados`,
          blockers: aggregated,
        },
      });
      return;
    }

    if (deletable.length === 0) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Excluir clientes',
        message: this.translate.instant(`Tem certeza de que deseja excluir ${deletable.length} cliente(s)?`),
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      try {
        const batch = writeBatch(this.firestore);
        deletable.forEach(c => batch.delete(doc(this.firestore, `clients/${c.id}`)));
        await batch.commit();
        const deletedIds = new Set(deletable.map(c => c.id));
        this.dataSource.data = this.dataSource.data.filter(c => !deletedIds.has(c.id));
        this.selectedClientIds.clear();
        this.toast.success(this.translate.instant('Clientes excluídos com sucesso.'));
      } catch (error) {
        console.error('Erro ao excluir clientes em massa:', error);
        this.toast.error(this.translate.instant('Erro ao excluir clientes. Tente novamente.'));
      }
    });
  }

  private async cascadeDeleteClient(clientId: string): Promise<void> {
    const BATCH_SIZE = 400;
    const db = this.firestore;

    // 1. Projetos do cliente
    const projectsSnap = await getDocs(query(collection(db, 'projects'), where('clientId', '==', clientId)));
    const projectIds = projectsSnap.docs.map(d => d.id);

    // 2. Participantes dos projetos (batches de 10 para query 'in')
    const participantRefs: any[] = [];
    const participantIds: string[] = [];
    for (let i = 0; i < projectIds.length; i += 10) {
      const chunk = projectIds.slice(i, i + 10);
      const snap = await getDocs(query(collection(db, 'participants'), where('projectId', 'in', chunk)));
      snap.docs.forEach(d => { participantRefs.push(d.ref); participantIds.push(d.id); });
    }

    // 3. AssessmentLinks dos participantes
    const linkRefs: any[] = [];
    for (let i = 0; i < participantIds.length; i += 10) {
      const chunk = participantIds.slice(i, i + 10);
      const snap = await getDocs(query(collection(db, 'assessmentLinks'), where('participantId', 'in', chunk)));
      snap.docs.forEach(d => linkRefs.push(d.ref));
    }

    // 4. ReminderSettings dos projetos (doc key = clientId_projectId)
    const reminderRefs = projectIds.map(pid => doc(db, `reminderSettings/${clientId}_${pid}`));

    // 5. Apagar links, participantes, projetos e reminderSettings em batches
    const toDelete = [...linkRefs, ...participantRefs, ...projectsSnap.docs.map(d => d.ref), ...reminderRefs];
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      toDelete.slice(i, i + BATCH_SIZE).forEach(ref => batch.delete(ref));
      await batch.commit();
    }

    // 6. Assessments, mailTemplates, creditOrders, userGroups (por clientId)
    for (const col of ['assessments', 'mailTemplates', 'creditOrders', 'userGroups']) {
      const snap = await getDocs(query(collection(db, col), where('clientId', '==', clientId)));
      for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }

    // 7. Usuários do cliente
    const usersSnap = await getDocs(query(collection(db, 'users'), where('client', '==', clientId)));
    for (let i = 0; i < usersSnap.docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      usersSnap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 8. Deletar o cliente
    await deleteDoc(doc(db, `clients/${clientId}`));
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
