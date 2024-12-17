import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  Firestore,
  doc,
  getDoc,
  collection,
  query,
  getDocs,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { AddUserDialogComponent } from './add-user-dialog/add-user-dialog.component';
import { PhonePipe } from 'src/app/pipe/phone.pipe';

@Component({
  selector: 'app-client-details-view',
  standalone: true,
  imports: [MaterialModule, CommonModule, PhonePipe],
  templateUrl: './client-detail-view.component.html',
  styleUrls: ['./client-detail-view.component.scss'],
})
export class ClientDetailsViewComponent implements OnInit {
  client: any = null; // Detalhes do cliente
  users: MatTableDataSource<any> = new MatTableDataSource(); // Tabela de usuários
  displayedColumns: string[] = ['name', 'email', 'role', 'password', 'actions'];

  visiblePasswords: { [key: string]: boolean } = {}; // Controle de visibilidade de senhas

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    const clientId = this.route.snapshot.paramMap.get('id');
    if (clientId) {
      this.loadClientDetails(clientId);
      this.loadClientUsers(clientId);
    }
  }

  async loadClientDetails(clientId: string) {
    try {
      const clientDoc = doc(this.firestore, `clients/${clientId}`);
      const clientSnapshot = await getDoc(clientDoc);
      if (clientSnapshot.exists()) {
        this.client = clientSnapshot.data();
      } else {
        this.snackBar.open('Cliente não encontrado.', 'Fechar', {
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes do cliente:', error);
      this.snackBar.open('Erro ao carregar os detalhes do cliente.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadClientUsers(clientId: string) {
    try {
      const usersCollection = collection(this.firestore, 'users');
      const usersQuery = query(usersCollection);
      const snapshot = await getDocs(usersQuery);

      const users = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((user: any) => user.clientId === clientId);

      // Inicializa o controle de visibilidade de senhas
      users.forEach((user: any) => {
        this.visiblePasswords[user.id] = false; // Define a senha como oculta inicialmente
      });

      this.users.data = users;
      this.users.paginator = this.paginator;
      this.users.sort = this.sort;
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      this.snackBar.open('Erro ao carregar usuários.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  togglePasswordVisibility(userId: string): void {
    // Alterna a visibilidade da senha
    this.visiblePasswords[userId] = !this.visiblePasswords[userId];
  }

  openAddUserDialog() {
    const dialogRef = this.dialog.open(AddUserDialogComponent, {
      width: '500px',
      data: { clientId: this.route.snapshot.paramMap.get('id') }, // Passa o ID do cliente para o diálogo
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.snackBar.open('Usuário adicionado com sucesso!', 'Fechar', {
          duration: 3000,
        });
        this.loadClientUsers(this.client.id); // Recarrega a lista de usuários
      }
    });
  }

  deleteUser(userId: string) {
    this.snackBar.open('Usuário excluído com sucesso!', 'Fechar', {
      duration: 3000,
    });
  }
}
