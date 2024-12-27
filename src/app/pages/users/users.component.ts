import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Firestore, collection, deleteDoc, doc, getDocs } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { CreateUserGroupComponent } from './create-user-group/create-user-group.component';

export interface User {
  name: string;
  surname: string;
  email: string;
  group: string;
  role: string;
  notificationStatus: 'Enviado' | 'Pendente';
}

export interface UserGroup {
  id: any;
  name: string;
  description: string;
  createdBy: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
})
export class UsersComponent implements OnInit {
  // Tabela de usuários
  displayedUserColumns: string[] = [
    'name',
    'surname',
    'email',
    'group',
    'role',
    'notificationStatus',
    'actions',
  ];
  userDataSource = new MatTableDataSource<User>([]);

  // Tabela de grupos de usuários
  displayedGroupColumns: string[] = [
    'name',
    'description',
    'createdBy',
    'actions',
  ];
  groupDataSource = new MatTableDataSource<UserGroup>([]);

  @ViewChild('userPaginator') userPaginator!: MatPaginator;
  @ViewChild('userSort') userSort!: MatSort;

  @ViewChild('groupPaginator') groupPaginator!: MatPaginator;
  @ViewChild('groupSort') groupSort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadUserGroups();
  }

  // Carrega os dados dos usuários do Firestore
  async loadUsers(): Promise<void> {
    try {
      const usersCollection = collection(this.firestore, 'users'); // Substitua pelo nome correto da coleção
      const snapshot = await getDocs(usersCollection);

      const users: User[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id, // Inclua o ID se necessário
          name: data['name'] || '', // Garanta que o campo "name" existe ou defina um valor padrão
          surname: data['surname'] || '',
          email: data['email'] || '',
          group: data['group'] || '',
          role: data['role'] || '',
          notificationStatus: data['notificationStatus'] || 'Pendente',
        };
      });

      this.userDataSource.data = users;
      this.userDataSource.paginator = this.userPaginator;
      this.userDataSource.sort = this.userSort;
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      this.snackBar.open('Erro ao carregar usuários.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  // Carrega os dados dos grupos de usuários do Firestore
  async loadUserGroups(): Promise<void> {
    try {
      const groupsCollection = collection(this.firestore, 'userGroups');
      const snapshot = await getDocs(groupsCollection);

      const groups: UserGroup[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data['name'] || '',
          description: data['description'] || '',
          createdBy: data['createdBy'] || 'Desconhecido', // Nome do usuário
          createdByEmail: data['createdByEmail'] || 'Não informado', // Email do usuário
        };
      });

      this.groupDataSource.data = groups;
      this.groupDataSource.paginator = this.groupPaginator;
      this.groupDataSource.sort = this.groupSort;
    } catch (error) {
      console.error('Erro ao carregar grupos de usuários:', error);
      this.snackBar.open('Erro ao carregar grupos de usuários.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  // Filtro para usuários
  applyUserFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.userDataSource.filter = filterValue.trim().toLowerCase();
    if (this.userDataSource.paginator) {
      this.userDataSource.paginator.firstPage();
    }
  }

  // Filtro para grupos
  applyGroupFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.groupDataSource.filter = filterValue.trim().toLowerCase();
    if (this.groupDataSource.paginator) {
      this.groupDataSource.paginator.firstPage();
    }
  }

  // Ações da tabela de usuários
  editUser(user: User): void {
    this.snackBar.open(`Editar usuário: ${user.name}`, 'Fechar', {
      duration: 3000,
    });
  }

  // Ações da tabela de grupos
  editGroup(group: UserGroup): void {
    const dialogRef = this.dialog.open(CreateUserGroupComponent, {
      width: '500px',
      data: group, // Passa os dados do grupo para edição
    });
  
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadUserGroups();
      }
    });
  }

  openCreateGroupDialog(): void {
    const dialogRef = this.dialog.open(CreateUserGroupComponent, {
      width: '500px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadUserGroups(); // Recarrega a tabela de grupos
      }
    });
  }

  async deleteGroup(group: UserGroup): Promise<void> {
    try {
      const confirmDelete = confirm(
        `Tem certeza de que deseja excluir o grupo "${group.name}"?`
      );
      if (!confirmDelete) {
        return;
      }

      const groupDoc = doc(this.firestore, `userGroups/${group.id}`);
      await deleteDoc(groupDoc);

      this.groupDataSource.data = this.groupDataSource.data.filter(
        (g) => g.name !== group.name
      );

      this.snackBar.open('Grupo excluído com sucesso!', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao excluir grupo:', error);
      this.snackBar.open('Erro ao excluir grupo.', 'Fechar', {
        duration: 3000,
      });
    }
  }
}
