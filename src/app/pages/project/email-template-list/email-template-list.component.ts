// email-template-list.component.ts
import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  collection,
  query,
  getDocs,
  getDoc,
  deleteDoc,
  doc,
  addDoc,
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
import {
  DuplicateTemplateDialogComponent,
  DuplicateTemplateDialogData,
} from './duplicate-template-dialog/duplicate-template-dialog.component';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';

@Component({
  selector: 'app-email-template-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule, AppPageHeaderComponent],
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
  userClientIds: string[] = [];

  clients: any[] = [];
  clientFilter: string = '';

  projects: any[] = [];
  projectFilter: string = '';

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
    this.userClientIds = await this.authService.getCurrentUserClientIds();
    this.userClientId = this.userClientIds[0] || null;

    await this.loadClients();

    // Se veio de rota com clientId, pré-seleciona o filtro visual e carrega projetos
    if (this.clientId) {
      this.clientFilter = this.clientId;
      await this.loadProjects(this.clientId);
    }

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
      if (this.userRole === 'admin_client') {
        // Carrega apenas os clientes vinculados ao admin_client
        const snaps = await Promise.all(
          this.userClientIds.map(id => getDoc(doc(this.firestore, 'clients', id)))
        );
        this.clients = snaps
          .filter(d => d.exists())
          .map(d => ({ id: d.id, name: d.data()!['companyName'] || '' }));

        // Auto-seleciona o único cliente (ou o primeiro se houver mais de um)
        if (this.clients.length === 1) {
          this.clientFilter = this.clients[0].id;
        }
      } else {
        const snapshot = await getDocs(collection(this.firestore, 'clients'));
        this.clients = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data()['companyName'],
        }));
      }
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
      } else if (this.userRole === 'admin_client' && this.userClientIds.length > 0) {
        // Filtra apenas templates dos clientes vinculados ao admin_client
        queryConstraint = query(
          templatesCollection,
          where('clientId', 'in', this.userClientIds)
        );
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
    const filterValue = this.searchQuery.trim().toLowerCase();

    const filteredData = this.allTemplates.filter((data: any) => {
      const matchesSearch = !filterValue ||
        (data.name || '').toLowerCase().includes(filterValue) ||
        (data.subject || '').toLowerCase().includes(filterValue);

      const matchesType = this.emailTypeFilter
        ? (data.emailType || '').toLowerCase() === this.emailTypeFilter.toLowerCase()
        : true;

      const matchesClient = this.clientFilter
        ? data.clientId === this.clientFilter
        : true;

      return matchesSearch && matchesType && matchesClient;
    });

    this.dataSource.data = filteredData;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  async onClientChange(clientId: string): Promise<void> {
    this.clientFilter = clientId;
    this.projectFilter = '';
    this.projects = [];
    if (clientId) {
      await this.loadProjects(clientId);
    }
    this.applyFilter();
  }

  private async loadProjects(clientId: string): Promise<void> {
    try {
      const snap = await getDocs(
        query(collection(this.firestore, 'projects'), where('clientId', '==', clientId))
      );
      this.projects = snap.docs
        .filter(d => !['Cancelado', 'Inativo'].includes(d.data()['status'] || ''))
        .map(d => ({ id: d.id, name: d.data()['name'] || '—' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    } catch (e) {
      console.error('Erro ao carregar projetos:', e);
    }
  }

  onProjectChange(projectId: string): void {
    this.projectFilter = projectId;
  }

  /** clientId efetivo para o envio: rota tem prioridade, senão usa o filtro */
  get effectiveClientId(): string | null {
    return this.clientId || this.clientFilter || null;
  }

  /** projectId efetivo para o envio: rota tem prioridade, senão usa o filtro */
  get effectiveProjectId(): string | null {
    return this.projectId || this.projectFilter || null;
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.emailTypeFilter = '';
    this.projectFilter = '';
    this.projects = [];
    this.clientFilter = (this.userRole === 'admin_client' && this.clients.length === 1)
      ? this.clients[0].id
      : '';
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

  getSuggestedDuplicateName(baseName: string): string {
    const base = (baseName || '').trim();
    const match = base.match(/^(.+?)\s*\((\d+)\)\s*$/);
    const nameWithoutSuffix = match ? match[1].trim() : base;
    const existingNumbers = this.allTemplates
      .map((t) => t.name)
      .filter((n) => n && n.startsWith(nameWithoutSuffix))
      .map((n) => {
        const m = n.match(/\s*\((\d+)\)\s*$/);
        return m ? parseInt(m[1], 10) : 1;
      });
    const nextNum =
      existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;
    return `${nameWithoutSuffix} (${nextNum})`;
  }

  async duplicateTemplate(template: any): Promise<void> {
    const suggestedName = this.getSuggestedDuplicateName(template.name);
    const dialogRef = this.dialog.open(DuplicateTemplateDialogComponent, {
      width: '400px',
      data: { suggestedName } as DuplicateTemplateDialogData,
    });

    const newName = await dialogRef.afterClosed().toPromise();
    if (newName == null || newName === '') return;

    try {
      const templateRef = doc(this.firestore, 'mailTemplates', template.id);
      const templateSnap = await getDoc(templateRef);
      if (!templateSnap.exists()) {
        this.snackBar.open('Template não encontrado.', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      const data = templateSnap.data();
      const templatesCollection = collection(this.firestore, 'mailTemplates');
      await addDoc(templatesCollection, {
        name: newName,
        subject: data?.['subject'] ?? template.subject,
        content: data?.['content'] ?? template.content,
        emailType: data?.['emailType'] ?? template.emailType,
        clientId: data?.['clientId'] ?? template.clientId ?? '',
        projectId: data?.['projectId'] ?? template.projectId ?? '',
      });

      this.snackBar.open('Template duplicado com sucesso!', 'Fechar', {
        duration: 3000,
      });
      await this.loadTemplates();
    } catch (error) {
      console.error('Erro ao duplicar template:', error);
      this.snackBar.open('Erro ao duplicar template.', 'Fechar', {
        duration: 3000,
      });
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

  getEmailTypeClass(emailType: string): string {
    const map: Record<string, string> = {
      cadastro: 'type-cadastro',
      convite: 'type-convite',
      conviteAvaliador: 'type-convite',
      conviteRespondente: 'type-convite',
      lembrete: 'type-lembrete',
      lembreteAvaliador: 'type-lembrete',
      lembreteRespondente: 'type-lembrete',
      relatorioFinalizado: 'type-relatorio',
    };
    return map[emailType] || 'type-default';
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
