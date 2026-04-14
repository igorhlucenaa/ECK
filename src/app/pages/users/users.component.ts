import { AfterViewInit, Component, OnInit, Optional, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import {
  Firestore,
  QueryDocumentSnapshot,
  DocumentData,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { CreateUserGroupComponent } from './create-user-group/create-user-group.component';
import { CreateUserComponent } from './create-user/create-user.component';
import { ConfirmDialogComponent } from '../clients/clients-list/confirm-dialog/confirm-dialog.component';
import { DetailsModalComponent } from 'src/app/layouts/full/shared/details-modal/details-modal.component';
import { UserDetailsDialogComponent } from './user-details-dialog/user-details-dialog.component';
import { GroupDetailsDialogComponent } from './group-details-dialog/group-details-dialog.component';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
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
  notificationStatus: 'Pendente' | 'Link Enviado' | 'Acessou';
  lastInviteSentAt?: Date;
  lastLoginAt?: Date;
  client: string;
  clients: string[];
  project: string;
  groups: string[];
  projects: string[];
  blocked: boolean;
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
    'select',
    'name',
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
    'select',
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

  selectedUserIds  = new Set<string>();
  selectedGroupIds = new Set<string>();
  duplicateEmails  = new Set<string>();

  statusFilter: 'all' | 'active' | 'blocked' = 'all';
  allUsers: User[] = [];

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
    private router: Router,
    private auth: Auth,
    @Optional() public dialogRef: MatDialogRef<UsersComponent>
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  /** Retorna true se o usuário logado pode editar o usuário alvo */
  canEdit(user: User): boolean {
    // admin_client não pode editar nenhum usuário
    if (this.currentUserRole === 'admin_client') return false;
    // admin_master não pode editar a si mesmo nem outros masters
    if (user.role === 'admin_master') {
      return this.currentUserRole === 'admin_master' && user.email !== this.currentUserEmail;
    }
    return true;
  }

  /** Retorna true se o usuário logado pode excluir o usuário alvo */
  canDelete(user: User): boolean {
    // admin_client não pode excluir nenhum usuário
    if (this.currentUserRole === 'admin_client') return false;
    // Não pode excluir a si mesmo
    if (user.email === this.currentUserEmail) return false;
    // admin_master só pode ser excluído por outro admin_master
    if (user.role === 'admin_master') {
      return this.currentUserRole === 'admin_master';
    }
    return true;
  }

  /** Conta quantos admin_masters existem na tabela */
  private countMasters(): number {
    return this.userDataSource.data.filter(u => u.role === 'admin_master').length;
  }

  /** Tooltip explicando por que o botão está desativado */
  getEditTooltip(user: User): string {
    if (this.currentUserRole === 'admin_client')
      return this.translate.instant('ADM Cliente não possui permissão para editar usuários');
    if (user.role === 'admin_master' && user.email === this.currentUserEmail)
      return this.translate.instant('Você não pode editar sua própria conta MASTER');
    if (user.role === 'admin_master' && this.currentUserRole !== 'admin_master')
      return this.translate.instant('Apenas um admin MASTER pode editar outro admin MASTER');
    return this.translate.instant('Editar');
  }

  getDeleteTooltip(user: User): string {
    if (this.currentUserRole === 'admin_client')
      return this.translate.instant('ADM Cliente não possui permissão para excluir usuários');
    if (user.email === this.currentUserEmail && user.role === 'admin_master')
      return this.translate.instant('Você não pode remover sua própria conta MASTER. Solicite a outro admin MASTER que realize esta ação');
    if (user.email === this.currentUserEmail)
      return this.translate.instant('Você não pode excluir sua própria conta');
    if (user.role === 'admin_master' && this.currentUserRole !== 'admin_master')
      return this.translate.instant('Apenas um admin MASTER pode remover outro admin MASTER');
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
      // Suporta tanto campo legado 'client' quanto novo 'clients' (array)
      if (this.userRole === 'admin_client' && clientId) {
        const [snapLegacy, snapArray] = await Promise.all([
          getDocs(query(usersCollection, where('client', '==', clientId))),
          getDocs(query(usersCollection, where('clients', 'array-contains', clientId))),
        ]);
        // Mescla sem duplicatas
        const docsMap = new Map<string, any>();
        [...snapLegacy.docs, ...snapArray.docs].forEach(d => docsMap.set(d.id, d));
        usersSnapshot = { docs: Array.from(docsMap.values()) } as any;
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
      const users: User[] = usersSnapshot.docs
        .map((userDoc: QueryDocumentSnapshot<DocumentData>) => {
          const data = userDoc.data();

          // Suporta tanto campo único 'client' quanto array 'clients'
          const rawClients: string[] = Array.isArray(data['clients'])
            ? data['clients']
            : data['client'] ? [data['client']] : [];
          const clientNames = rawClients
            .map((id) => clientsMap[id])
            .filter((name): name is string => !!name);

          const userGroups = groupsMap[userDoc.id]?.groups || [];
          const userProjects = (groupsMap[userDoc.id]?.projects || [])
            .map((projectId) => {
              const project = projectsMap[projectId];
              if (project) {
                return project.name;
              }
              return null;
            })
            .filter((projectName) => projectName !== null);

          const rawStatus = data['notificationStatus'];
          const notificationStatus: User['notificationStatus'] =
            rawStatus === 'Acessou' ? 'Acessou'
            : rawStatus === 'Link Enviado' ? 'Link Enviado'
            : 'Pendente';

          return {
            id: userDoc.id,
            name: data['name'] || '',
            surname: data['surname'] || '',
            email: data['email'] || '',
            role: data['role'] || '',
            notificationStatus,
            lastInviteSentAt: data['lastInviteSentAt']?.toDate?.() ?? undefined,
            lastLoginAt: data['lastLoginAt']?.toDate?.() ?? undefined,
            client: clientNames[0] || '',
            clients: clientNames,
            projects: userProjects,
            groups: userGroups,
            group: userGroups.join(', '),
            project: userProjects.join(', '),
            blocked: data['blocked'] || false,
          } as User;
        })
        .sort((a: User, b: User) => a.name.localeCompare(b.name));

      // Detectar e-mails duplicados
      const emailCount = new Map<string, number>();
      users.forEach(u => {
        const e = u.email?.toLowerCase();
        if (e) emailCount.set(e, (emailCount.get(e) || 0) + 1);
      });
      this.duplicateEmails = new Set(
        Array.from(emailCount.entries()).filter(([, c]) => c > 1).map(([e]) => e)
      );

      // Armazena todos os usuários e aplica filtro de status atual
      this.allUsers = users;
      this.applyStatusFilter(this.statusFilter);
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
      panelClass: 'form-dialog-panel',
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

  // ─── Seleção em massa — Usuários ─────────────────────────────
  isAllUsersSelected(): boolean {
    const visible = this.userDataSource.filteredData;
    return visible.length > 0 && visible.filter(u => this.canDelete(u)).every(u => this.selectedUserIds.has(u.id));
  }

  isSomeUsersSelected(): boolean {
    return this.userDataSource.filteredData.some(u => this.selectedUserIds.has(u.id));
  }

  toggleAllUsers(checked: boolean): void {
    if (checked) {
      this.userDataSource.filteredData.filter(u => this.canDelete(u)).forEach(u => this.selectedUserIds.add(u.id));
    } else {
      this.userDataSource.filteredData.forEach(u => this.selectedUserIds.delete(u.id));
    }
  }

  toggleUserSelect(user: User): void {
    if (!this.canDelete(user)) return;
    if (this.selectedUserIds.has(user.id)) {
      this.selectedUserIds.delete(user.id);
    } else {
      this.selectedUserIds.add(user.id);
    }
  }

  deleteSelectedUsers(): void {
    const count = this.selectedUserIds.size;

    // Verificar se seleção inclui masters não permitidos
    const selectedUsers = this.userDataSource.data.filter(u => this.selectedUserIds.has(u.id));
    const mastersInSelection = selectedUsers.filter(u => u.role === 'admin_master');

    if (mastersInSelection.length > 0 && this.currentUserRole !== 'admin_master') {
      this.snackBar.open(
        this.translate.instant('Apenas um admin MASTER pode remover outro admin MASTER.'),
        this.translate.instant('Fechar'), { duration: 5000 });
      return;
    }
    if (mastersInSelection.some(u => u.email === this.currentUserEmail)) {
      this.snackBar.open(
        this.translate.instant('Você não pode remover sua própria conta MASTER.'),
        this.translate.instant('Fechar'), { duration: 5000 });
      return;
    }
    const remainingMasters = this.countMasters() - mastersInSelection.length;
    if (remainingMasters < 1 && mastersInSelection.length > 0) {
      this.snackBar.open(
        this.translate.instant('Não é possível remover o único admin MASTER da plataforma.'),
        this.translate.instant('Fechar'), { duration: 5000 });
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: { message: this.translate.instant(`Tem certeza de que deseja excluir ${count} usuário(s)?`) },
    });
    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      const ids = Array.from(this.selectedUserIds);
      try {
        const batch = writeBatch(this.firestore);
        ids.forEach(id => batch.delete(doc(this.firestore, `users/${id}`)));
        await batch.commit();
        this.userDataSource.data = this.userDataSource.data.filter(u => !this.selectedUserIds.has(u.id));
        this.selectedUserIds.clear();
        this.snackBar.open(this.translate.instant('Usuários excluídos com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
      } catch (error) {
        console.error('Erro ao excluir usuários em massa:', error);
        this.snackBar.open(this.translate.instant('Erro ao excluir usuários.'), this.translate.instant('Fechar'), { duration: 3000 });
      }
    });
  }

  // ─── Seleção em massa — Grupos ───────────────────────────────
  isAllGroupsSelected(): boolean {
    const visible = this.groupDataSource.filteredData;
    return visible.length > 0 && visible.every(g => this.selectedGroupIds.has(g.id));
  }

  isSomeGroupsSelected(): boolean {
    return this.groupDataSource.filteredData.some(g => this.selectedGroupIds.has(g.id));
  }

  toggleAllGroups(checked: boolean): void {
    if (checked) {
      this.groupDataSource.filteredData.forEach(g => this.selectedGroupIds.add(g.id));
    } else {
      this.groupDataSource.filteredData.forEach(g => this.selectedGroupIds.delete(g.id));
    }
  }

  toggleGroupSelect(id: string): void {
    if (this.selectedGroupIds.has(id)) {
      this.selectedGroupIds.delete(id);
    } else {
      this.selectedGroupIds.add(id);
    }
  }

  deleteSelectedGroups(): void {
    const count = this.selectedGroupIds.size;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: { message: this.translate.instant(`Tem certeza de que deseja excluir ${count} grupo(s)?`) },
    });
    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      const ids = Array.from(this.selectedGroupIds);
      try {
        const batch = writeBatch(this.firestore);
        ids.forEach(id => batch.delete(doc(this.firestore, `userGroups/${id}`)));
        await batch.commit();
        this.groupDataSource.data = this.groupDataSource.data.filter(g => !this.selectedGroupIds.has(g.id));
        this.selectedGroupIds.clear();
        const groups = await this.loadUserGroups();
        await this.loadUsers(groups);
        this.snackBar.open(this.translate.instant('Grupos excluídos com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
      } catch (error) {
        console.error('Erro ao excluir grupos em massa:', error);
        this.snackBar.open(this.translate.instant('Erro ao excluir grupos.'), this.translate.instant('Fechar'), { duration: 3000 });
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
      panelClass: 'form-dialog-panel',
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
    // Auto-remoção de conta MASTER
    if (user.email === this.currentUserEmail && user.role === 'admin_master') {
      this.snackBar.open(
        this.translate.instant('Você não pode remover sua própria conta MASTER. Solicite a outro admin MASTER que realize esta ação.'),
        this.translate.instant('Fechar'), { duration: 5000 });
      return;
    }
    // Último MASTER
    if (user.role === 'admin_master' && this.countMasters() <= 1) {
      this.snackBar.open(
        this.translate.instant('Não é possível remover o único admin MASTER da plataforma.'),
        this.translate.instant('Fechar'), { duration: 5000 });
      return;
    }

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

  /** Retorna true se o usuário logado pode bloquear/desbloquear o alvo */
  canBlock(user: User): boolean {
    if (user.email === this.currentUserEmail) return false;
    if (user.role === 'admin_master') return this.currentUserRole === 'admin_master';
    if (this.currentUserRole === 'admin_client') return user.role === 'viewer' || user.role === 'user';
    return true;
  }

  async toggleBlockUser(user: User): Promise<void> {
    const newBlocked = !user.blocked;
    const action = newBlocked ? 'bloquear' : 'desbloquear';

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: { message: `Tem certeza de que deseja ${action} o acesso de "${user.name} ${user.surname}"?` },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      try {
        await updateDoc(doc(this.firestore, `users/${user.id}`), { blocked: newBlocked });

        const patch = (u: User) => u.id === user.id ? { ...u, blocked: newBlocked } : u;
        this.allUsers = this.allUsers.map(patch);
        this.userDataSource.data = this.userDataSource.data.map(patch);

        const msg = newBlocked ? 'Acesso bloqueado com sucesso!' : 'Acesso desbloqueado com sucesso!';
        this.snackBar.open(msg, 'Fechar', { duration: 3000 });
      } catch (error) {
        console.error('Erro ao alterar bloqueio:', error);
        this.snackBar.open('Erro ao alterar status de acesso.', 'Fechar', { duration: 3000 });
      }
    });
  }

  applyStatusFilter(filter: 'all' | 'active' | 'blocked'): void {
    this.statusFilter = filter;
    if (filter === 'active') {
      this.userDataSource.data = this.allUsers.filter(u => !u.blocked);
    } else if (filter === 'blocked') {
      this.userDataSource.data = this.allUsers.filter(u => !!u.blocked);
    } else {
      this.userDataSource.data = this.allUsers;
    }
    this.userDataSource.paginator?.firstPage();
  }

  hasDuplicateEmail(user: User): boolean {
    return this.duplicateEmails.has(user.email?.toLowerCase());
  }

  // Enviar link de criação / redefinição de senha
  async sendEmailNotification(user: User): Promise<void> {
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/authentication/login`,
        handleCodeInApp: false,
      };
      await sendPasswordResetEmail(this.auth, user.email, actionCodeSettings);

      const now = new Date();

      // Persiste no Firestore
      await updateDoc(doc(this.firestore, `users/${user.id}`), {
        notificationStatus: 'Link Enviado',
        lastInviteSentAt: now,
      });

      // Atualiza tabela local sem reload
      const patch = (u: User): User =>
        u.id === user.id
          ? { ...u, notificationStatus: 'Link Enviado', lastInviteSentAt: now }
          : u;
      this.allUsers = this.allUsers.map(patch);
      this.userDataSource.data = this.userDataSource.data.map(patch);

      this.snackBar.open(
        this.translate.instant('Link de acesso enviado para {{email}}', { email: user.email }),
        this.translate.instant('Fechar'),
        { duration: 3000 }
      );
    } catch (err: any) {
      console.error('Erro ao enviar link:', err?.code, err?.message);
      this.snackBar.open(
        `Erro ao enviar link: ${err?.message}`,
        this.translate.instant('Fechar'),
        { duration: 6000 }
      );
    }
  }

  openDetailsModal(title: string, items: any): void {
    this.dialog.open(DetailsModalComponent, {
      width: '400px',
      data: { title, items },
    });
  }
}
