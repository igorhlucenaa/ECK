import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { CommonModule, Location } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { UsersListByGroupComponent } from './users-list-by-group/users-list-by-group.component';
// Adicione esta interface no início do seu arquivo component.ts ou em um arquivo separado de interfaces
export interface UserGroupDetailed {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  clientId: string;
  projectIds: string[];
  clientName: string;
  projectNames: string[];
  users: any[];
}

@Component({
  selector: 'app-project-users',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  templateUrl: './project-users.component.html',
  styleUrls: ['./project-users.component.scss'],
})
export class ProjectUsersComponent implements OnInit {
  displayedColumns: string[] = [
    'groupName',
    'clientName',
    'projectNames',
    'description',
    'actions',
  ];
  dataSource = new MatTableDataSource<any>();
  projectId: string | null = null;
  searchValue: string = ''; // Adicionando a propriedade de busca

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');
    if (this.projectId) {
      this.loadGroupsWithUsers();
    }
    this.setupFilter(); // Configurar o filtro
  }

  async loadGroupsWithUsers(): Promise<void> {
    try {
      const groupsCollection = collection(this.firestore, 'userGroups');
      const clientsCollection = collection(this.firestore, 'clients');
      const projectsCollection = collection(this.firestore, 'projects');

      const [groupsSnapshot, clientsSnapshot, projectsSnapshot] =
        await Promise.all([
          getDocs(groupsCollection),
          getDocs(clientsCollection),
          getDocs(projectsCollection),
        ]);

      const clients = clientsSnapshot.docs.map((clientDoc) => ({
        id: clientDoc.id,
        ...(clientDoc.data() as { companyName: string }),
      }));

      const projects = projectsSnapshot.docs.map((projectDoc) => ({
        id: projectDoc.id,
        ...(projectDoc.data() as { name: string }),
      }));

      const currentClientId = this.route.snapshot.queryParamMap.get('clientId');

      const groups: UserGroupDetailed[] = groupsSnapshot.docs
        .map((groupDoc) => {
          const groupData = groupDoc.data();
          const client = clients.find(
            (client) => client.id === groupData['clientId']
          );

          const projectIds: string[] = groupData['projectIds'] || [];
          const projectNames: string[] = projectIds
            .map(
              (projectId: string) =>
                projects.find((project) => project.id === projectId)?.name || ''
            )
            .filter((name: string) => name !== '');

          return {
            id: groupDoc.id,
            name: groupData['name'] || '',
            description: groupData['description'] || '',
            createdBy: groupData['createdBy'] || 'Desconhecido',
            clientId: groupData['clientId'] || '',
            projectIds,
            clientName: client?.companyName || 'N/A',
            projectNames,
            users: groupData['users'] || [],
          };
        })
        .filter((group) => {
          // Filtra apenas grupos que pertencem ao projeto atual e ao cliente especificado (se houver)
          const belongsToProject = group.projectIds.includes(this.projectId!);
          const belongsToClient = currentClientId
            ? group.clientId === currentClientId
            : true; // Se clientId não estiver especificado, não filtra por cliente
          return belongsToProject && belongsToClient;
        });

      this.dataSource.data = groups;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    } catch (error) {
      console.error('Erro ao carregar grupos, clientes e projetos:', error);
      this.snackBar.open('Erro ao carregar dados.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  // Método para configurar o filtro
  setupFilter(): void {
    this.dataSource.filterPredicate = (data: any, filter: string): boolean => {
      const dataStr = `
        ${data.name} ${data.clientName} ${data.projectNames.join(',')}
      `.toLowerCase();
      return dataStr.includes(filter.trim().toLowerCase());
    };
  }

  // Método para aplicar o filtro
  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.searchValue = filterValue; // Atualiza o valor do campo de busca
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  openUsersModal(group: any): void {
    console.log(group);
    this.dialog.open(UsersListByGroupComponent, {
      width: '800px', // Define a largura do modal
      data: {
        groupName: group.name,
        groupId: group.id, // Certifique-se de que group.id existe e está correto
      },
    });
  }

  goBack(): void {
    this.location.back();
  }

  isLastProject(projects: string[], currentProject: string): boolean {
    return projects.indexOf(currentProject) === projects.length - 1;
  }
}
