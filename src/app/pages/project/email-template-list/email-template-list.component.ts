import { Component, OnInit, ViewChild } from '@angular/core';
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
import { EmailSelectionDialogComponent } from '../projects-list/email-selection-dialog/email-selection-dialog.component';

@Component({
  selector: 'app-email-template-list',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './email-template-list.component.html',
  styleUrls: ['./email-template-list.component.scss'],
})
export class EmailTemplateListComponent implements OnInit {
  displayedColumns: string[] = [
    'client',
    'name',
    'subject',
    'emailType',
    'actions',
  ];
  dataSource = new MatTableDataSource<any>();
  clientId: string | null = null; // Mantido como string | null
  title = 'Modelos de E-mail';
  emailTypeFilter: string = ''; // Filtro de tipo de notificação
  searchQuery: string = ''; // Filtro de busca
  allTemplates: any[] = []; // Armazena todos os templates carregados
  userRole: string = ''; // Papel do usuário logado
  userClientId: string | null = null; // ID do cliente logado

  clients: any[] = []; // Lista de clientes para o filtro
  clientFilter: string = ''; // Filtro por cliente

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
          // Para admin_master, exibir apenas templates padrão ou do clientId da rota
          queryConstraint = query(
            templatesCollection,
            where('clientId', 'in', [this.clientId, ''])
          );
        } else {
          queryConstraint = query(templatesCollection); // Todos os templates se não houver clientId
        }
      } else if (this.userRole === 'admin_client' && this.userClientId) {
        if (this.clientId) {
          // Para admin_client, exibir apenas templates do clientId da rota ou padrões, se corresponder ao userClientId
          if (this.clientId === this.userClientId) {
            queryConstraint = query(
              templatesCollection,
              where('clientId', 'in', [this.clientId, ''])
            );
          } else {
            queryConstraint = query(
              templatesCollection,
              where('clientId', '==', '')
            ); // Apenas templates padrão se o clientId não corresponder
          }
        } else {
          queryConstraint = query(
            templatesCollection,
            where('clientId', '==', this.userClientId)
          ); // Sem clientId na rota, usa o userClientId
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

  openEmailSelectionModal(
    clientId: string | null, // Alterado para aceitar string | null
    templateId: string,
    emailType: string
  ): void {
    if (!clientId && this.userClientId) {
      clientId = this.userClientId; // Fallback para userClientId se clientId for null
    }
    if (clientId) {
      this.dialog.open(EmailSelectionDialogComponent, {
        width: '75%',
        data: { clientId, templateId, emailType },
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
}
