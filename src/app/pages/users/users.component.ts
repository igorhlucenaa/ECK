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
import { ConfirmDialogComponent } from '../clients/clients-list/confirm-dialog/confirm-dialog.component';
import { DetailsModalComponent } from 'src/app/layouts/full/shared/details-modal/details-modal.component';

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
  groups: string[]; // Torna groups opcional
  projects: string[]; // Modificado para múltiplos projetos
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
    'projects',
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
      const groups = await this.loadUserGroups(); // Carrega os grupos e retorna a lista
      console.log(groups);
      await this.loadUsers(groups); // Passa os grupos para associar
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.snackBar.open('Erro ao carregar dados.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  // Carrega os dados dos usuários do Firestore
  async loadUsers(groups: UserGroup[]): Promise<void> {
    try {
      // Buscar dados das coleções
      const usersCollection = collection(this.firestore, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const clientsCollection = collection(this.firestore, 'clients');
      const clientsSnapshot = await getDocs(clientsCollection);
      const projectsCollection = collection(this.firestore, 'projects');
      const projectsSnapshot = await getDocs(projectsCollection);
      const groupsCollection = collection(this.firestore, 'userGroups');
      const groupsSnapshot = await getDocs(groupsCollection);

      // Mapeamento de clientes
      const clientsMap = clientsSnapshot.docs.reduce((acc, doc) => {
        acc[doc.id] = doc.data()['companyName'];
        return acc;
      }, {} as { [key: string]: string });

      // Mapeamento de projetos
      const projectsMap = projectsSnapshot.docs.reduce((acc, doc) => {
        acc[doc.id] = {
          name: doc.data()['name'],
          groupIds: doc.data()['groupIds'] || [],
        };
        return acc;
      }, {} as { [key: string]: { name: string; groupIds: string[] } });

      // Mapeamento de grupos para usuários
      const groupsMap = groupsSnapshot.docs.reduce((acc, doc) => {
        const groupData = doc.data();
        const groupId = doc.id;
        if (groupData['userIds'] && Array.isArray(groupData['userIds'])) {
          groupData['userIds'].forEach((userId: string) => {
            if (!acc[userId]) {
              acc[userId] = { groups: [], projects: [] };
            }
            acc[userId].groups.push(groupData['name']);
            // Adicionando projetos ao usuário com base nos projetos do grupo
            projectsSnapshot.docs.forEach((projectDoc) => {
              const project = projectDoc.data();
              if (
                project['groupIds'] &&
                project['groupIds'].includes(groupId)
              ) {
                if (!acc[userId].projects.includes(projectDoc.id)) {
                  acc[userId].projects.push(projectDoc.id); // Associando o projeto ao usuário
                }
              }
            });
          });
        }
        return acc;
      }, {} as { [key: string]: { groups: string[]; projects: string[] } });

      // Mapeando usuários com seus grupos e projetos
      const users: any[] = usersSnapshot.docs.map((doc) => {
        const data = doc.data();
        const companyName =
          clientsMap[data['client']] || 'Cliente não encontrado';

        // Mapeando grupos e projetos para o usuário
        const userGroups = groupsMap[doc.id]?.groups || [];
        const userProjects = (groupsMap[doc.id]?.projects || [])
          .map((projectId) => {
            const project = projectsMap[projectId];
            if (project) {
              return project.name;
            }
            return null;
          })
          .filter((projectName) => projectName !== null);

        return {
          id: doc.id,
          name: data['name'] || '',
          surname: data['surname'] || '',
          email: data['email'] || '',
          role: data['role'] || '',
          notificationStatus: data['notificationStatus'] || 'Pendente',
          client: companyName,
          projects: userProjects, // Agora com múltiplos projetos
          groups: userGroups, // A lista de grupos
        };
      });

      console.log('Users data:', users);

      // Atualiza o dataSource com os dados dos usuários
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
  async loadUserGroups(): Promise<UserGroup[]> {
    try {
      const groupsCollection = collection(this.firestore, 'userGroups');
      const groupsSnapshot = await getDocs(groupsCollection);

      const clientsCollection = collection(this.firestore, 'clients');
      const clientsSnapshot = await getDocs(clientsCollection);

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
          client: clientName,
          projectIds: data['projectIds'] || [],
          userIds: data['userIds'] || [],
          clientId: data['clientId'],
        };
      });

      this.groupDataSource.data = groups;
      this.groupDataSource.paginator = this.groupPaginator;
      this.groupDataSource.sort = this.groupSort;

      return groups;
    } catch (error) {
      console.error('Erro ao carregar grupos de usuários:', error);
      this.snackBar.open('Erro ao carregar grupos de usuários.', 'Fechar', {
        duration: 3000,
      });
      return [];
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
    const dialogRef = this.dialog.open(CreateUserComponent, {
      width: '500px',
      data: { user }, // Passa os dados do usuário para edição
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const groups = await this.loadUserGroups(); // Carrega os grupos e retorna a lista
        await this.loadUsers(groups); // Recarrega a tabela de usuários após edição
      }
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
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        message: `Tem certeza de que deseja excluir o grupo "${group.name}"?`,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          const groupDoc = doc(this.firestore, `userGroups/${group.id}`);
          await deleteDoc(groupDoc);

          // Remove o grupo da tabela local
          this.groupDataSource.data = this.groupDataSource.data.filter(
            (g) => g.id !== group.id
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
    });
  }

  openCreateUserDialog(): void {
    const dialogRef = this.dialog.open(CreateUserComponent, {
      width: '500px',
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const groups = await this.loadUserGroups(); // Carrega os grupos e retorna a lista
        await this.loadUsers(groups); // Recarrega a tabela de usuários após edição
      }
    });
  }

  // Ações da tabela de usuários
  async deleteUser(user: User): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        message: `Tem certeza de que deseja excluir o usuário "${user.name}"?`,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
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
    });
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

  openDetailsModal(title: string, items: string[]): void {
    this.dialog.open(DetailsModalComponent, {
      width: '400px',
      data: { title, items },
    });
  }
}
