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
import { MaterialModule } from 'src/app/material.module';
import { Router, RouterModule } from '@angular/router';
import { AddClientDialogComponent } from '../add-client-dialog/add-client-dialog.component';
import { PhonePipe } from 'src/app/pipe/phone.pipe';
import { CnpjPipe } from 'src/app/pipe/cnpj.pipe';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
    RouterModule,
    PhonePipe,
    CnpjPipe,
    RouterModule,
    ConfirmDialogComponent,
  ],
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit {
  displayedColumns: string[] = [
    'companyName',
    'sector',
    'cnpj',
    'credits',
    'actions',
  ];
  dataSource = new MatTableDataSource<any>();
  searchValue: string = ''; // Adicionando a propriedade searchValue

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadClients();
  }

  private async loadClients() {
    const clientsCollection = collection(this.firestore, 'clients');
    const clientsQuery = query(clientsCollection);

    try {
      const snapshot = await getDocs(clientsQuery);
      const clients = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        }))
        .sort((a, b) => {
          const nameA = a.companyName?.toLowerCase() || '';
          const nameB = b.companyName?.toLowerCase() || '';
          return nameA.localeCompare(nameB);
        });

      // Processar todos os clientes e calcular créditos
      await Promise.all(
        clients.map((client) => this.calculateCreditsForClient(client))
      );

      this.dataSource.data = clients; // Atualizar a tabela após o cálculo dos créditos
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;

      this.dataSource.filterPredicate = (data, filter) => {
        const dataStr =
          `${data.companyName} ${data.sector} ${data.cnpj} ${data.credits}`
            .toLowerCase()
            .trim();
        return dataStr.includes(filter);
      };
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open(
        'Erro ao carregar a lista de clientes. Tente novamente mais tarde.',
        'Fechar',
        { duration: 3000 }
      );
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
      let totalCredits = 0;

      ordersSnapshot.docs.forEach((orderDoc) => {
        const orderData = orderDoc.data();
        const validityDate = orderData['validityDate']?.toDate(); // Usar o campo correto
        const credits = orderData['credits'] || 0;
        const currentDate = new Date();

        if (validityDate && validityDate > currentDate) {
          totalCredits += credits; // Só conta créditos válidos
        }
      });

      // Atualiza os créditos do cliente
      client.credits = totalCredits;
    } catch (error) {
      console.error('Erro ao calcular créditos:', error);
    }
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.searchValue = filterValue; // Atualizando a propriedade searchValue
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  deleteClient(id: string) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        message: `Ao remover o cliente, todos os projetos, grupos e usuários associados também serão excluídos. Deseja continuar?`,
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
            this.snackBar.open(
              'Cliente e dados relacionados excluídos com sucesso.',
              'Fechar',
              {
                duration: 3000,
              }
            );
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
            this.snackBar.open(
              'Erro ao excluir cliente. Verifique os dados relacionados e tente novamente.',
              'Fechar',
              { duration: 3000 }
            );
          });
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
        this.snackBar.open('Lista de clientes atualizada!', 'Fechar', {
          duration: 3000,
        });
      }
    });
  }
}
