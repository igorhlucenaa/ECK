import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
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
import { UserDetailsDialogComponent } from './user-details-dialog/user-details-dialog.component';
import { GroupDetailsDialogComponent } from './group-details-dialog/group-details-dialog.component';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router, RouterModule } from '@angular/router';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';

export interface User {
  id: string;
  name: string;
  surname: string;
  email: string;
  group: string;
  role: string;
  notificationStatus: 'Enviado' | 'Pendente';
  client: string;
  clients: string[]; // nomes dos clientes vinculados
  project: string;
  groups: string[];
  projects: string[];
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
  imports: [MaterialModule, CommonModule, FormsModule, RouterModule, TranslateModule, AppPageHeaderComponent],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
})
export class UsersComponent implements OnInit, AfterViewInit {
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
  userRole: any;
  // Tabela de grupos de usuários
  displayedGroupColumns: string[] = [
    'client',
    'name',
    'description',
    'createdBy',
    'actions',
  ];
  groupDataSource = new MatTableDataSource<UserGroup>([]);

  // Usuário logado
  currentUserEmail: string | null = null;
  currentUserRole: string | null = null;

  // Titles for details modal (avoid pipe in (click) expressions)
  clientUsersTitle = this.translate.instant('Clientes do Usuário');
  userProjectsTitle = this.translate.instant('Projetos do Usuário');
  userGroupsTitle = this.translate.instant('Grupos do Usuário');

  @ViewChild('userPaginator') userPaginator!: MatPaginator;

  @ViewChild('groupPaginator') groupPaginator!: MatPaginator;

  @ViewChild('userSort', { static: false }) userSort!: MatSort;
  @ViewChild('groupSort', { static: false }) groupSort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private authService: AuthService,
    private translate: TranslateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  /** Retorna true se o usuário logado pode editar o usuário alvo */
  canEdit(user: User): boolean {
    // admin_master nunca pode ser editado
    if (user.role === 'admin_master') return false;
    // admin_client só pode editar viewers
    if (this.currentUserRole === 'admin_client') {
      return user.role === 'viewer' || user.role === 'user';
    }
    return true;
  }

  /** Retorna true se o usuário logado pode excluir o usuário alvo */
  canDelete(user: User): boolean {
    // admin_master nunca pode ser excluído
    if (user.role === 'admin_master') return false;
    // Não pode excluir a si mesmo
    if (user.email === this.currentUserEmail) return false;
    // admin_client só pode excluir viewers
    if (this.currentUserRole === 'admin_client') {
      return user.role === 'viewer' || user.role === 'user';
    }
    return true;
  }

  /** Tooltip explicando por que o botão está desativado */
  getEditTooltip(user: User): string {
    if (user.role === 'admin_master') return this.translate.instant('Usuários Master não podem ser editados');
    if (this.currentUserRole === 'admin_client' && user.role === 'admin_client') return this.translate.instant('Sem permissão para editar este perfil');
    return this.translate.instant('Editar');
  }

  getDeleteTooltip(user: User): string {
    if (user.role === 'admin_master') return this.translate.instant('Usuários Master não podem ser excluídos');
    if (user.email === this.currentUserEmail) return this.translate.instant('Você não pode excluir sua própria conta');
    if (this.currentUserRole === 'admin_client' && user.role === 'admin_client') return this.translate.instant('Sem permissão para excluir este perfil');
    return this.translate.instant('Excluir');
  }

  ngAfterViewInit(): void {
            this.userDataSource.sort = this.userSort;
    this.userDataSource.paginator = this.userPaginator;
  }

  async loadData(): Promise<void> {
    try {
      // Carrega dados do usuário logado para regras de permissão
      const currentUser = await this.authService.getCurrentUser();
      this.currentUserEmail = currentUser?.email || null;
      this.currentUserRole = await this.authService.getCurrentUserRole();

      const groups = await this.loadUserGroups(); // Carrega os grupos e retorna a lista
      await this.loadUsers(groups); // Passa os grupos para associar
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.snackBar.open(this.translate.instant('Erro ao carregar dados.'), this.translate.instant('Fechar'), {
        duration: 3000,
      });
    }
  }

  // Carrega os dados dos usuários do Firestore
  async loadUsers(groups: UserGroup[]): Promise<void> {
    try {
      this.userRole = await this.authService.getCurrentUserRole();
      const clientId = await this.authService.getCurrentClientId();

      // Coleção de usuários
      const usersCollection = collection(this.firestore, 'users');
      let usersSnapshot;

      // Admin_client pode ver apenas os usuários do seu cliente
      if (this.userRole === 'admin_client' && clientId) {
        usersSnapshot = await getDocs(
          query(usersCollection, where('client', '==', clientId))
        );
      } else if (this.userRole === 'admin_master') {
        usersSnapshot = await getDocs(usersCollection);
      } else {
        console.warn('Usuário não autorizado para carregar dados.');
        this.userDataSource.data = [];
        return;
      }

      const clientsCollection = collection(this.firestore, 'clients');
      const clientsSnapshot = await getDocs(clientsCollection);

      const projectsCollection = collection(this.firestore, 'projects');
      const projectsSnapshot = await getDocs(projectsCollection);

      const groupsCollection = collection(this.firestore, 'userGroups');
      const groupsSnapshot = await getDocs(groupsCollection);
      // Mapear clientes
      const clientsMap = clientsSnapshot.docs.reduce((acc, doc) => {
        acc[doc.id] = doc.data()['companyName'];
        return acc;
      }, {} as { [key: string]: string });

      // Mapear projetos
      const projectsMap = projectsSnapshot.docs.reduce((acc, doc) => {
        acc[doc.id] = {
          name: doc.data()['name'],
          groupIds: doc.data()['groupIds'] || [],
        };
        return acc;
      }, {} as { [key: string]: { name: string; groupIds: string[] } });

      // Mapear grupos
      const groupsMap = groupsSnapshot.docs.reduce((acc, doc) => {
        const groupData = doc.data();
        const groupId = doc.id;

        if (groupData['userIds'] && Array.isArray(groupData['userIds'])) {
          groupData['userIds'].forEach((userId: string) => {
            if (!acc[userId]) {
              acc[userId] = { groups: [], projects: [] };
            }
            acc[userId].groups.push(groupData['name']);

            projectsSnapshot.docs.forEach((projectDoc) => {
              const project = projectDoc.data();
              if (
                project['groupIds'] &&
                project['groupIds'].includes(groupId)
              ) {
                if (!acc[userId].projects.includes(projectDoc.id)) {
                  acc[userId].projects.push(projectDoc.id);
                }
              }
            });
          });
        }
        return acc;
      }, {} as { [key: string]: { groups: string[]; projects: string[] } });

      // Mapear usuários com grupos e projetos
      const users = usersSnapshot.docs
        .map((doc) => {
          const data = doc.data();

          // Suporta tanto campo único 'client' quanto array 'clients'
          const rawClients: string[] = Array.isArray(data['clients'])
            ? data['clients']
            : data['client'] ? [data['client']] : [];
          const clientNames = rawClients
            .map((id) => clientsMap[id])
            .filter((name): name is string => !!name);

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
            client: clientNames[0] || '',
            clients: clientNames,
            projects: userProjects,
            groups: userGroups,
            group: userGroups.join(', '),
            project: userProjects.join(', '),
          } as User;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      // Atualizar dataSource
      this.userDataSource.data = users;
      setTimeout(() => {
        this.userDataSource.sort = this.userSort;
        this.userDataSource.paginator = this.userPaginator;
      });
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      this.snackBar.open(this.translate.instant('Erro ao carregar usuários.'), this.translate.instant('Fechar'), {
        duration: 3000,
      });
    }
  }

  // Carrega os dados dos grupos de usuários do Firestore
  async loadUserGroups(): Promise<UserGroup[]> {
    try {
      const userRole = await this.authService.getCurrentUserRole();
      const clientId = await this.authService.getCurrentClientId();

      const groupsCollection = collection(this.firestore, 'userGroups');
      let groupsSnapshot;

      // Admin_client pode ver apenas os grupos do seu cliente
      if (userRole === 'admin_client' && clientId) {
        groupsSnapshot = await getDocs(
          query(groupsCollection, where('clientId', '==', clientId))
        );
      } else if (userRole === 'admin_master') {
        groupsSnapshot = await getDocs(groupsCollection);
      } else {
        console.warn('Usuário não autorizado para carregar dados.');
        this.groupDataSource.data = [];
        return [];
      }

      const clientsCollection = collection(this.firestore, 'clients');
      const clientsSnapshot = await getDocs(clientsCollection);

      const clientsMap = clientsSnapshot.docs.reduce((acc, doc) => {
        acc[doc.id] = doc.data()['companyName'];
        return acc;
      }, {} as { [key: string]: string });

      const groups: UserGroup[] = groupsSnapshot.docs
        .map((doc) => {
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
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      this.groupDataSource.data = groups;
      setTimeout(() => {
        this.groupDataSource.sort = this.groupSort;
        this.groupDataSource.paginator = this.groupPaginator;
      });

      return groups;
    } catch (error) {
      console.error('Erro ao carregar grupos de usuários:', error);
      this.snackBar.open(this.translate.instant('Erro ao carregar grupos de usuários.'), this.translate.instant('Fechar'), {
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

  openUserDetails(user: User): void {
    this.dialog.open(UserDetailsDialogComponent, {
      data: user,
      panelClass: 'udlg-panel',
    });
  }

  // Ações da tabela de usuários
  editUser(user: any): void {
    this.router.navigate(['/users', user.id, 'edit']);
  }

  openGroupDetails(group: UserGroup): void {
    this.dialog.open(GroupDetailsDialogComponent, {
      data: group,
      panelClass: 'gdlg-panel',
    });
  }

  // Ações da tabela de grupos
  editGroup(group: UserGroup): void {
    this.router.navigate(['/users/group', group.id, 'edit']);
  }

  openCreateGroupDialog(): void {
    const dialogRef = this.dialog.open(CreateUserGroupComponent, {
      width: '500px',
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        // Após criar o grupo, recarrega a lista de grupos
        const groups = await this.loadUserGroups();
        // Agora, recarrega os usuários com os novos grupos
        await this.loadUsers(groups);
      }
    });
  }

  async deleteGroup(group: UserGroup): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        message: this.translate.instant('Tem certeza de que deseja excluir o grupo "{{name}}"?', { name: group.name }),
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

          // Recarrega a lista de grupos e usuários após exclusão
          const groups = await this.loadUserGroups();
          await this.loadUsers(groups);

          this.snackBar.open(this.translate.instant('Grupo excluído com sucesso!'), this.translate.instant('Fechar'), {
            duration: 3000,
          });
        } catch (error) {
          console.error('Erro ao excluir grupo:', error);
          this.snackBar.open(this.translate.instant('Erro ao excluir grupo.'), this.translate.instant('Fechar'), {
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
        message: this.translate.instant('Tem certeza de que deseja excluir o usuário "{{name}}"?', { name: user.name }),
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

          this.snackBar.open(this.translate.instant('Usuário excluído com sucesso!'), this.translate.instant('Fechar'), {
            duration: 3000,
          });
        } catch (error) {
          console.error('Erro ao excluir usuário:', error);
          this.snackBar.open(this.translate.instant('Erro ao excluir usuário.'), this.translate.instant('Fechar'), {
            duration: 3000,
          });
        }
      }
    });
  }

  // Enviar e-mail de notificação
  sendEmailNotification(user: User): void {
        // Aqui você implementaria a lógica de envio de e-mail, usando um serviço backend
    // Por exemplo, se você estiver usando Firebase Functions ou outro serviço:
    // this.emailService.sendNotification(user.email);

    this.snackBar.open(this.translate.instant('E-mail enviado para {{email}}', { email: user.email }), this.translate.instant('Fechar'), {
      duration: 3000,
    });
  }

  openDetailsModal(title: string, items: any): void {
    this.dialog.open(DetailsModalComponent, {
      width: '400px',
      data: { title, items },
    });
  }
}
