import { Component, OnInit, ViewChild } from '@angular/core';
import { Firestore, collection, collectionData, doc, deleteDoc } from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { RouterModule } from '@angular/router';
import { AddClientDialogComponent } from '../add-client-dialog/add-client-dialog.component';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [CommonModule, MaterialModule, RouterModule],
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit {
  displayedColumns: string[] = ['companyName', 'email', 'phone', 'sector', 'actions'];
  dataSource = new MatTableDataSource<any>(); // Usa MatTableDataSource para gerenciar dados
  searchValue = ''; // Valor da busca

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog // Para abrir o modal
  ) {}

  ngOnInit(): void {
    const clientsRef = collection(this.firestore, 'clients');
    collectionData(clientsRef, { idField: 'id' }).subscribe((data) => {
      console.log('data ===========> ', data)
      this.dataSource.data = data; // Atualiza a tabela com os dados recebidos
      this.dataSource.paginator = this.paginator; // Configura a paginação
      this.dataSource.sort = this.sort; // Configura a ordenação
    });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  deleteClient(id: string) {
    const clientDocRef = doc(this.firestore, `clients/${id}`);
    deleteDoc(clientDocRef)
      .then(() => {
        this.snackBar.open('Cliente excluído com sucesso.', 'Fechar', { duration: 3000 });
      })
      .catch((error) => {
        this.snackBar.open('Erro ao excluir cliente. Tente novamente.', 'Fechar', { duration: 3000 });
        console.error('Erro ao excluir cliente:', error);
      });
  }

  openAddClientDialog() {
    const dialogRef = this.dialog.open(AddClientDialogComponent, {
      width: '500px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.snackBar.open('Cliente adicionado com sucesso!', 'Fechar', {
          duration: 3000,
        });
      }
    });
  }
}
