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
  projectId: string | null = null;
  title = 'Templates de E-mail';
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
    this.projectId = this.route.snapshot.paramMap.get('id');

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
    console.log('Carregando lista de clientes...');
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
    console.log('Carregando templates...');

    try {
      const templatesCollection = collection(this.firestore, 'mailTemplates');
      let queryConstraint;

      if (this.userRole === 'admin_master') {
        console.log('entrou nesse 1');
        queryConstraint = query(templatesCollection);
      } else if (this.userRole === 'admin_client' && this.userClientId) {
        queryConstraint = query(
          templatesCollection,
          where('clientId', '==', this.userClientId)
        );
      } else {
        console.log('entrou nesse 2');
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
            'TEMPLATE PADRÃO', // Substitui clientId pelo nome
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
    const filterValue = inputElement
      ? inputElement.value.trim().toLowerCase()
      : '';

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
    projectId: string,
    templateId: string,
    emailType: string
  ): void {
    this.dialog.open(EmailSelectionDialogComponent, {
      width: '900px',
      data: { projectId, templateId, emailType }, // Adiciona o templateId aqui
    });
  }

  onEmailTypeChange(event: any): void {
    this.emailTypeFilter = event.value;
    this.applyFilter();
  }

  createTemplate(): void {
    if (this.userRole === 'admin_master') {
      this.router.navigate(['/projects/default-template/new']);
    } else if (this.userRole === 'admin_client' && this.userClientId) {
      this.router.navigate([`/projects/${this.userClientId}/templates/new`]);
    }
  }

  editTemplate(templateId: string, isGlobal: boolean): void {
    console.log(this.userRole);
    if (this.userRole === 'admin_master') {
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
          console.log('entrou nesse 3');
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
        console.log(this.dataSource.data);
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
