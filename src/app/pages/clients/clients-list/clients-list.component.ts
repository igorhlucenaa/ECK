import { Component, OnInit, ViewChild } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  deleteDoc,
  getDocs,
  query,
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

  private loadClients() {
    const clientsCollection = collection(this.firestore, 'clients');
    const clientsQuery = query(clientsCollection);

    getDocs(clientsQuery)
      .then((snapshot) => {
        const clients = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...(doc.data() as any),
          }))
          .sort((a, b) => {
            const nameA = a.companyName?.toLowerCase() || '';
            const nameB = b.companyName?.toLowerCase() || '';
            return nameA.localeCompare(nameB); // Ordena alfabeticamente
          });

        this.dataSource.data = clients;
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;

        this.dataSource.filterPredicate = (data, filter) => {
          const dataStr =
            `${data.companyName} ${data.sector} ${data.cnpj} ${data.credits}`
              .toLowerCase()
              .trim();
          return dataStr.includes(filter);
        };
      })
      .catch((error) => {
        console.error('Erro ao carregar clientes:', error);
        this.snackBar.open(
          'Erro ao carregar a lista de clientes. Tente novamente mais tarde.',
          'Fechar',
          { duration: 3000 }
        );
      });
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
    const clientDocRef = doc(this.firestore, `clients/${id}`);
    deleteDoc(clientDocRef)
      .then(() => {
        this.snackBar.open('Cliente excluído com sucesso.', 'Fechar', {
          duration: 3000,
        });
        this.dataSource.data = this.dataSource.data.filter(
          (client) => client.id !== id
        );
      })
      .catch((error) => {
        this.snackBar.open(
          'Erro ao excluir cliente. Tente novamente.',
          'Fechar',
          { duration: 3000 }
        );
        console.error('Erro ao excluir cliente:', error);
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
