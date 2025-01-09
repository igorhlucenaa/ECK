import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
} from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { CreateUserGroupComponent } from './create-user-group/create-user-group.component';
import { CreateUserComponent } from './create-user/create-user.component';

export interface User {
  id: string;
  name: string;
  surname: string;
  email: string;
  group: string;
  role: string;
  notificationStatus: 'Enviado' | 'Pendente';
  client: string;
  project: string;
}

export interface UserGroup {
  id: any;
  name: string;
  description: string;
  createdBy: string;
  projectIds: [];
  userIds: [];
  clientId: string;
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
    'client',
    'project',
    'group',
    'role',
    'notificationStatus',
    'actions',
  ];
  userDataSource = new MatTableDataSource<User>([]);

  // Tabela de grupos de usuários
  displayedGroupColumns: string[] = [
    'name',
    'client',
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
    this.loadData();
  }

  async loadData(): Promise<void> {
    try {
      await this.loadUserGroups(); // Carrega os grupos primeiro
      await this.loadUsers(); // Depois carrega os usuários
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.snackBar.open('Erro ao carregar dados.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  // Carrega os dados dos usuários do Firestore
  async loadUsers(): Promise<void> {
    try {
      const usersCollection = collection(this.firestore, 'users');
      const usersSnapshot = await getDocs(usersCollection);

      const clientsCollection = collection(this.firestore, 'clients');
      const clientsSnapshot = await getDocs(clientsCollection);

      const projectsCollection = collection(this.firestore, 'projects');
      const projectsSnapshot = await getDocs(projectsCollection);

      // Mapeia os clientes por ID para fácil acesso
      const clientsMap = clientsSnapshot.docs.reduce((acc, doc) => {
        acc[doc.id] = doc.data()['companyName'];
        return acc;
      }, {} as { [key: string]: string });

      // Mapeia os projetos por ID para fácil acesso
      const projectsMap = projectsSnapshot.docs.reduce((acc, doc) => {
        acc[doc.id] = doc.data()['name'];
        return acc;
      }, {} as { [key: string]: string });

      const users: User[] = usersSnapshot.docs.map((doc) => {
        const data = doc.data();
        const companyName =
          clientsMap[data['client']] || 'Cliente não encontrado';
        const projectName =
          projectsMap[data['project']] || 'Projeto não encontrado';

        return {
          id: doc.id,
          name: data['name'] || '',
          surname: data['surname'] || '',
          email: data['email'] || '',
          group: data['group'] || '',
          role: data['role'] || '',
          notificationStatus: data['notificationStatus'] || 'Pendente',
          client: companyName, // Substitui o ID pelo nome do cliente
          project: projectName, // Substitui o ID pelo nome do projeto
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
      const groupsSnapshot = await getDocs(groupsCollection);

      const clientsCollection = collection(this.firestore, 'clients');
      const clientsSnapshot = await getDocs(clientsCollection);

      // Mapeia os clientes por ID para fácil acesso
      const clientsMap = clientsSnapshot.docs.reduce((acc, doc) => {
        acc[doc.id] = doc.data()['companyName'];
        return acc;
      }, {} as { [key: string]: string });

      const groups: UserGroup[] = groupsSnapshot.docs.map((doc) => {
        const data = doc.data();
        const clientName =
          clientsMap[data['clientId']] || 'Cliente não encontrado';

        return {
          id: doc.id,
          name: data['name'] || '',
          description: data['description'] || '',
          createdBy: data['createdBy'] || 'Desconhecido',
          client: clientName, // Vincula o nome do cliente
          projectIds: data['projectIds'] || [],
          userIds: data['userIds'] || [],
          clientId: data['clientId'],
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
  editUser(user: any): void {
    console.log(user);
    const dialogRef = this.dialog.open(CreateUserComponent, {
      width: '500px',
      data: { user }, // Passa os dados do usuário para edição
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadUsers(); // Recarrega a tabela de usuários após edição
      }
    });
  }

  // Ações da tabela de grupos
  editGroup(group: UserGroup): void {
    console.log(group);
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

  openCreateUserDialog(): void {
    const dialogRef = this.dialog.open(CreateUserComponent, {
      width: '500px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadUsers(); // Recarrega a tabela de usuários
      }
    });
  }

  // Ações da tabela de usuários
  async deleteUser(user: User): Promise<void> {
    console.log(user);
    try {
      const confirmDelete = confirm(
        `Tem certeza de que deseja excluir o usuário "${user.name}"?`
      );
      if (!confirmDelete) {
        return;
      }

      const userDoc = doc(this.firestore, `users/${user.id}`);
      await deleteDoc(userDoc);

      // Remove o usuário da tabela local
      this.userDataSource.data = this.userDataSource.data.filter(
        (u) => u.id !== user.id
      );

      this.snackBar.open('Usuário excluído com sucesso!', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      this.snackBar.open('Erro ao excluir usuário.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  // Enviar e-mail de notificação
  sendEmailNotification(user: User): void {
    console.log('Enviando e-mail para:', user.email);
    // Aqui você implementaria a lógica de envio de e-mail, usando um serviço backend
    // Por exemplo, se você estiver usando Firebase Functions ou outro serviço:
    // this.emailService.sendNotification(user.email);

    this.snackBar.open(`E-mail enviado para ${user.email}`, 'Fechar', {
      duration: 3000,
    });
  }
}
