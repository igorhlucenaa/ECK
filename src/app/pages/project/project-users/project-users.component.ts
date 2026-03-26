import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { CommonModule, Location } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

@Component({
  selector: 'app-project-users',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  templateUrl: './project-users.component.html',
  styleUrls: ['./project-users.component.scss'],
})
export class ProjectUsersComponent implements OnInit {
  displayedColumns: string[] = ['name', 'email', 'role'];
  dataSource = new MatTableDataSource<User>();
  projectId: string | null = null;
  searchValue: string = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');
    if (this.projectId) {
      this.loadUsersByProject();
    }
    this.setupFilter();
  }

  async loadUsersByProject(): Promise<void> {
    try {
      if (!this.projectId) return;

      // Obtém os detalhes do projeto para pegar os `groupIds` e `clientId`
      const projectsCollection = collection(this.firestore, 'projects');
      const projectsSnapshot = await getDocs(
        query(projectsCollection, where('__name__', '==', this.projectId))
      );

      if (projectsSnapshot.empty) {
        this.snackBar.open('Projeto não encontrado.', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      const projectData = projectsSnapshot.docs[0].data();
      const clientId = projectData['clientId']; // Obtém o `clientId` do projeto
      const groupIds: string[] = projectData['groupIds'] || []; // Obtém os grupos associados ao projeto

      if (groupIds.length === 0) {
        this.dataSource.data = [];
        return;
      }

      // 1. Buscar todos os grupos associados ao projeto (baseados nos `groupIds`)
      const userGroupsCollection = collection(this.firestore, 'userGroups');
      const userGroupsSnapshot = await getDocs(
        query(userGroupsCollection, where('__name__', 'in', groupIds))
      );

      // 2. Coletar os `userIds` dos grupos filtrados
      const userIds = new Set<string>();
      userGroupsSnapshot.docs.forEach((doc: any) => {
        const data: any = doc.data();
        if (data.userIds && Array.isArray(data.userIds)) {
          data.userIds.forEach((userId: any) => userIds.add(userId));
        }
      });

      if (userIds.size === 0) {
        this.dataSource.data = [];
        return;
      }

      // 3. Buscar apenas os usuários do cliente e que estão no projeto
      const usersCollection = collection(this.firestore, 'users');
      const usersSnapshot = await getDocs(
        query(
          usersCollection,
          where('__name__', 'in', Array.from(userIds)),
          where('client', '==', clientId)
        )
      );

      const users = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Sem Nome',
        email: doc.data()['email'] || 'Sem Email',
        role: doc.data()['role'] || 'Sem Cargo',
      }));

      // Atualiza a tabela com os usuários filtrados
      this.dataSource.data = users;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    } catch (error) {
      console.error('Erro ao carregar usuários do projeto:', error);
      this.snackBar.open('Erro ao carregar os usuários.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  setupFilter(): void {
    this.dataSource.filterPredicate = (data: User, filter: string): boolean => {
      return `${data.name} ${data.email} ${data.role}`
        .toLowerCase()
        .includes(filter.trim().toLowerCase());
    };
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.searchValue = filterValue;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  goBack(): void {
    this.location.back();
  }
}

// import { Component, OnInit, ViewChild } from '@angular/core';
// import { ActivatedRoute } from '@angular/router';
// import { Firestore, collection, getDocs } from '@angular/fire/firestore';
// import { MatTableDataSource } from '@angular/material/table';
// import { MatSnackBar } from '@angular/material/snack-bar';
// import { MatPaginator } from '@angular/material/paginator';
// import { MatSort } from '@angular/material/sort';
// import { MatDialog } from '@angular/material/dialog';
// import { CommonModule, Location } from '@angular/common';
// import { MaterialModule } from 'src/app/material.module';
// import { UsersListByGroupComponent } from './users-list-by-group/users-list-by-group.component';
// // Adicione esta interface no início do seu arquivo component.ts ou em um arquivo separado de interfaces
// export interface UserGroupDetailed {
//   id: string;
//   name: string;
//   description: string;
//   createdBy: string;
//   clientId: string;
//   projectIds: string[];
//   clientName: string;
//   projectNames: string[];
//   users: any[];
// }

// @Component({
//   selector: 'app-project-users',
//   standalone: true,
//   imports: [MaterialModule, CommonModule],
//   templateUrl: './project-users.component.html',
//   styleUrls: ['./project-users.component.scss'],
// })
// export class ProjectUsersComponent implements OnInit {
//   displayedColumns: string[] = [
//     'groupName',
//     'clientName',
//     'projectNames',
//     'description',
//     'actions',
//   ];
//   dataSource = new MatTableDataSource<any>();
//   projectId: string | null = null;
//   searchValue: string = ''; // Adicionando a propriedade de busca

//   @ViewChild(MatPaginator) paginator!: MatPaginator;
//   @ViewChild(MatSort) sort!: MatSort;

//   constructor(
//     private route: ActivatedRoute,
//     private firestore: Firestore,
//     private snackBar: MatSnackBar,
//     private dialog: MatDialog,
//     private location: Location
//   ) {}

//   ngOnInit(): void {
//     this.projectId = this.route.snapshot.paramMap.get('id');
//     //     if (this.projectId) {
//       this.loadGroupsWithUsers();
//     }
//     this.setupFilter(); // Configurar o filtro
//   }

//   async loadGroupsWithUsers(): Promise<void> {
//     try {
//       const groupsCollection = collection(this.firestore, 'userGroups');
//       const clientsCollection = collection(this.firestore, 'clients');
//       const projectsCollection = collection(this.firestore, 'projects');
//       const usersCollection = collection(this.firestore, 'users');

//       // Carrega os documentos de cada coleção
//       const [groupsSnapshot, clientsSnapshot, projectsSnapshot, usersSnapshot] =
//         await Promise.all([
//           getDocs(groupsCollection),
//           getDocs(clientsCollection),
//           getDocs(projectsCollection),
//           getDocs(usersCollection),
//         ]);

//       // Mapear clientes, projetos e usuários
//       const clients = clientsSnapshot.docs.map((doc) => ({
//         id: doc.id,
//         ...(doc.data() as { companyName: string }),
//       }));
//       const projects = projectsSnapshot.docs.map((doc) => ({
//         id: doc.id,
//         ...(doc.data() as {
//           name: string;
//           clientId: string;
//           groupIds: string[];
//         }),
//       }));
//       const users = usersSnapshot.docs.map((doc) => ({
//         id: doc.id,
//         ...(doc.data() as { name: string; email: string; client: string }),
//       }));

//       // Obter clientId e projectId atuais
//       let currentClientId = this.route.snapshot.queryParamMap.get('clientId');
//       if (!currentClientId && this.projectId) {
//         const currentProject = projects.find(
//           (project) => project.id === this.projectId
//         );
//         currentClientId = currentProject?.clientId || null;
//       }

//       // Filtrar grupos com base no clientId e projectId
//       const groups = groupsSnapshot.docs
//         .map((doc) => {
//           const groupData = doc.data();
//           const client = clients.find((c) => c.id === groupData['clientId']);
//           const projectIds = projects
//             .filter((p) => p.groupIds?.includes(doc.id))
//             .map((p) => p.name);
//           const groupUsers = (groupData['userIds'] || [])
//             .map((userId: string) => users.find((u) => u.id === userId)?.name)
//             .filter((name: any) => name);

//           return {
//             id: doc.id,
//             name: groupData['name'] || 'Sem Nome',
//             description: groupData['description'] || '',
//             createdBy: groupData['createdBy'] || 'Desconhecido',
//             clientId: groupData['clientId'] || '',
//             clientName: client?.companyName || 'N/A',
//             projectNames: projectIds,
//             users: groupUsers,
//           };
//         })
//         .filter((group) => {
//           const belongsToClient = currentClientId
//             ? group.clientId === currentClientId
//             : true;
//           const belongsToProject = this.projectId
//             ? projects.some((p) => p.groupIds?.includes(group.id))
//             : true;
//           return belongsToClient && belongsToProject;
//         });

//       // Atualizar a tabela
//       this.dataSource.data = groups;
//       this.dataSource.paginator = this.paginator;
//       this.dataSource.sort = this.sort;
//     } catch (error) {
//       console.error('Erro ao carregar grupos:', error);
//       this.snackBar.open('Erro ao carregar dados.', 'Fechar', {
//         duration: 3000,
//       });
//     }
//   }

//   // Método para configurar o filtro
//   setupFilter(): void {
//     this.dataSource.filterPredicate = (data: any, filter: string): boolean => {
//       const dataStr = `
//         ${data.name} ${data.clientName} ${data.projectNames.join(',')}
//       `.toLowerCase();
//       return dataStr.includes(filter.trim().toLowerCase());
//     };
//   }

//   // Método para aplicar o filtro
//   applyFilter(event: Event): void {
//     const filterValue = (event.target as HTMLInputElement).value;
//     this.searchValue = filterValue; // Atualiza o valor do campo de busca
//     this.dataSource.filter = filterValue.trim().toLowerCase();

//     if (this.dataSource.paginator) {
//       this.dataSource.paginator.firstPage();
//     }
//   }

//   openUsersModal(group: any): void {
//     //     this.dialog.open(UsersListByGroupComponent, {
//       width: '800px', // Define a largura do modal
//       data: {
//         groupName: group.name,
//         groupId: group.id, // Certifique-se de que group.id existe e está correto
//       },
//     });
//   }

//   goBack(): void {
//     this.location.back();
//   }

//   isLastProject(projects: string[], currentProject: string): boolean {
//     return projects.indexOf(currentProject) === projects.length - 1;
//   }
// }
