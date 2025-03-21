// email-template-list.component.ts
import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  collection,
  query,
  getDocs,
  deleteDoc,
  doc,
  where,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { CommonModule, Location } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { ConfirmDialogComponent } from '../../clients/clients-list/confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { ParticipantsComponent } from '../../assessments/participants/participants.component';

@Component({
  selector: 'app-email-template-list',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './email-template-list.component.html',
  styleUrls: ['./email-template-list.component.scss'],
})
export class EmailTemplateListComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = [
    'client',
    'name',
    'subject',
    'emailType',
    'actions',
  ];
  dataSource = new MatTableDataSource<any>();
  clientId: string | null = null;
  projectId: string | any = null;
  title = 'Modelos de E-mail';
  emailTypeFilter: string = '';
  searchQuery: string = '';
  allTemplates: any[] = [];
  userRole: string = '';
  userClientId: string | null = null;

  clients: any[] = [];
  clientFilter: string = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private dialog: MatDialog,
    private authService: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    this.clientId = this.route.snapshot.paramMap.get('id');
    this.projectId = this.route.snapshot.paramMap.get('idProject');
    console.log(this.projectId);

    const user = await this.authService.getCurrentUser();

    if (!user) {
      this.snackBar.open('Erro ao obter informações do usuário.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    this.userRole = user.role;
    this.userClientId = user.clientId;

    await this.loadClients();
    await this.loadTemplates();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    this.dataSource.sortData = (data: any[], sort: MatSort): any[] => {
      const active = sort.active;
      const direction = sort.direction;

      if (!active || direction === '') {
        return data;
      }

      return data.sort((a, b) => {
        const valueA = a[active];
        const valueB = b[active];

        if (active === 'client') {
          const clientA = a.clientName || '';
          const clientB = b.clientName || '';
          return (
            clientA.localeCompare(clientB) * (direction === 'asc' ? 1 : -1)
          );
        }

        if (typeof valueA === 'string' && typeof valueB === 'string') {
          return valueA.localeCompare(valueB) * (direction === 'asc' ? 1 : -1);
        } else {
          return (
            (valueA < valueB ? -1 : valueA > valueB ? 1 : 0) *
            (direction === 'asc' ? 1 : -1)
          );
        }
      });
    };
  }

  private async loadClients(): Promise<void> {
    try {
      const clientsCollection = collection(this.firestore, 'clients');
      const snapshot = await getDocs(clientsCollection);
      this.clients = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['companyName'],
      }));
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  }

  private async loadTemplates(): Promise<void> {
    try {
      const templatesCollection = collection(this.firestore, 'mailTemplates');
      let queryConstraint;

      if (this.userRole === 'admin_master') {
        if (this.clientId) {
          queryConstraint = query(
            templatesCollection,
            where('clientId', 'in', [this.clientId, ''])
          );
        } else {
          queryConstraint = query(templatesCollection);
        }
      } else if (this.userRole === 'admin_client' && this.userClientId) {
        if (this.clientId) {
          if (this.clientId === this.userClientId) {
            queryConstraint = query(
              templatesCollection,
              where('clientId', 'in', [this.clientId, ''])
            );
          } else {
            queryConstraint = query(
              templatesCollection,
              where('clientId', '==', '')
            );
          }
        } else {
          queryConstraint = query(
            templatesCollection,
            where('clientId', '==', this.userClientId)
          );
        }
      } else {
        this.snackBar.open(
          'Você não tem permissão para visualizar templates.',
          'Fechar',
          {
            duration: 3000,
          }
        );
        return;
      }

      const snapshot = await getDocs(queryConstraint);
      this.allTemplates = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          isGlobal: !data['clientId'],
          clientName:
            this.clients.find((c) => c.id === data['clientId'])?.name ||
            'TEMPLATE PADRÃO',
        };
      });

      this.dataSource.data = this.allTemplates;
      this.applyFilter();
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      this.snackBar.open('Erro ao carregar templates.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  applyFilter(): void {
    const inputElement =
      document.querySelector<HTMLInputElement>('#searchInput');
    const filterValue = (inputElement?.value || '').trim().toLowerCase();

    const filteredData = this.allTemplates.filter((data: any) => {
      const matchesSearch =
        data.name.toLowerCase().includes(filterValue) ||
        data.subject.toLowerCase().includes(filterValue);

      const matchesType = this.emailTypeFilter
        ? data.emailType.toLowerCase() === this.emailTypeFilter.toLowerCase()
        : true;

      const matchesClient = this.clientFilter
        ? data.clientName === this.clientFilter
        : true;

      return matchesSearch && matchesType && matchesClient;
    });

    this.dataSource.data = filteredData;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  onClientChange(event: any): void {
    this.clientFilter = event.value;
    this.applyFilter();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.emailTypeFilter = '';
    this.clientFilter = '';
    this.applyFilter();
  }

  openParticipantSelectionModal(
    clientId: string | null,
    templateId: string,
    emailType: string,
    projectId: string
  ): void {
    if (!clientId && this.userClientId) {
      clientId = this.userClientId;
    }
    if (clientId) {
      this.dialog.open(ParticipantsComponent, {
        width: '75%',
        data: { clientId, templateId, emailType, projectId },
      });
    } else {
      this.snackBar.open(
        'Nenhum cliente disponível para enviar e-mail.',
        'Fechar',
        {
          duration: 3000,
        }
      );
    }
  }

  onEmailTypeChange(event: any): void {
    this.emailTypeFilter = event.value;
    this.applyFilter();
  }

  createTemplate(): void {
    if (this.clientId) {
      this.router.navigate([`/projects/${this.clientId}/templates/new`]);
    } else if (this.userRole === 'admin_master') {
      this.router.navigate(['/projects/default-template/new']);
    } else if (this.userRole === 'admin_client' && this.userClientId) {
      this.router.navigate([`/projects/${this.userClientId}/templates/new`]);
    } else {
      this.snackBar.open(
        'Nenhum cliente disponível para criar template.',
        'Fechar',
        {
          duration: 3000,
        }
      );
    }
  }

  editTemplate(templateId: string, isGlobal: boolean): void {
    if (this.clientId) {
      this.router.navigate([
        `/projects/${this.clientId}/templates/${templateId}/edit`,
      ]);
    } else if (this.userRole === 'admin_master') {
      this.router.navigate([`projects/default-template/${templateId}/edit`]);
    } else if (
      !isGlobal &&
      this.userRole === 'admin_client' &&
      this.userClientId
    ) {
      this.router.navigate([
        `/projects/${this.userClientId}/templates/${templateId}/edit`,
      ]);
    } else {
      this.snackBar.open(
        'Você não tem permissão para editar este template.',
        'Fechar',
        {
          duration: 3000,
        }
      );
    }
  }

  async deleteTemplate(templateId: string, isGlobal: boolean): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: { message: 'Você tem certeza que deseja excluir este template?' },
    });

    const confirmed = await dialogRef.afterClosed().toPromise();

    if (confirmed) {
      try {
        let templateDocRef;
        if (isGlobal && this.userRole === 'admin_master') {
          templateDocRef = doc(this.firestore, `mailTemplates/${templateId}`);
        } else if (
          !isGlobal &&
          this.userRole === 'admin_client' &&
          this.userClientId
        ) {
          templateDocRef = doc(this.firestore, `mailTemplates/${templateId}`);
        } else {
          this.snackBar.open(
            'Você não tem permissão para excluir este template.',
            'Fechar',
            {
              duration: 3000,
            }
          );
          return;
        }

        await deleteDoc(templateDocRef);
        this.dataSource.data = this.dataSource.data.filter(
          (template) => template.id !== templateId
        );
        this.snackBar.open('Template excluído com sucesso!', 'Fechar', {
          duration: 3000,
        });
      } catch (error) {
        console.error('Erro ao excluir template:', error);
        this.snackBar.open('Erro ao excluir template.', 'Fechar', {
          duration: 3000,
        });
      }
    }
  }

  goBack(): void {
    this.location.back();
  }

  getFriendlyEmailType(emailType: string): string {
    switch (emailType) {
      case 'cadastro':
        return 'Cadastro do Usuário';
      case 'convite':
        return 'Convite';
      case 'conviteAvaliador':
        return 'Convite - Avaliador';
      case 'conviteRespondente':
        return 'Convite - Avaliado';
      case 'lembrete':
        return 'Lembrete';
      case 'lembreteAvaliador':
        return 'Lembrete - Avaliador';
      case 'lembreteRespondente':
        return 'Lembrete - Avaliado';
      case 'relatorioFinalizado':
        return 'Relatório Finalizado';
      default:
        return emailType;
    }
  }
}
