import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  collection,
  query,
  getDocs,
  deleteDoc,
  doc,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { CommonModule, Location } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { ConfirmDialogComponent } from '../../clients/clients-list/confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-email-template-list',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './email-template-list.component.html',
  styleUrls: ['./email-template-list.component.scss'],
})
export class EmailTemplateListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'subject', 'emailType', 'actions'];
  dataSource = new MatTableDataSource<any>();
  projectId: string | null = null;
  title = 'Templates de E-mail';
  emailTypeFilter: string = ''; // Filtro de tipo de notificação
  searchQuery: string = ''; // Filtro de busca

  allTemplates: any[] = []; // Armazena todos os templates carregados

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');
    const path = this.route.snapshot.url[0]?.path;

    console.log('Iniciando ngOnInit...');
    if (path === 'mail-templates') {
      this.title = 'Templates Globais';
      this.loadTemplates();
    } else if (this.projectId) {
      this.title = 'Templates de E-mail do Projeto';
      this.loadTemplates();
    } else {
      this.snackBar.open('Projeto não encontrado.', 'Fechar', {
        duration: 3000,
      });
      console.log('Projeto não encontrado.');
    }
  }

  private async loadTemplates(): Promise<void> {
    console.log('Carregando templates...');

    try {
      const templatesCollection = collection(
        this.firestore,
        `projects/${this.projectId}/templates`
      );
      const snapshot = await getDocs(query(templatesCollection));
      const projectTemplates = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        isGlobal: false,
      }));

      const globalTemplatesCollection = collection(
        this.firestore,
        'defaultMailTemplate'
      );
      const globalSnapshot = await getDocs(query(globalTemplatesCollection));
      const globalTemplates = globalSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        isGlobal: true,
      }));

      this.allTemplates = [...globalTemplates, ...projectTemplates];
      console.log('Templates carregados:', this.allTemplates);

      this.applyFilter(); // Aplica o filtro atual aos dados
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      this.snackBar.open('Erro ao carregar templates.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  applyFilter(event?: Event): void {
    console.log('Aplicando filtro...');

    let filterValue = this.searchQuery.trim().toLowerCase();
    if (event) {
      filterValue = (event.target as HTMLInputElement).value
        .trim()
        .toLowerCase();
      console.log('Filtro de busca:', filterValue);
    }

    const filteredData = this.allTemplates.filter((data: any) => {
      const matchesSearch =
        data.name.toLowerCase().includes(filterValue) ||
        data.subject.toLowerCase().includes(filterValue);

      // Aplica o filtro de tipo de notificação somente se emailTypeFilter não estiver vazio
      const matchesType = this.emailTypeFilter
        ? data.emailType.toLowerCase() === this.emailTypeFilter.toLowerCase()
        : true;

      // Log detalhado para verificar os valores
      console.log(
        `Verificando item ${data.name} (search: ${matchesSearch}, type: ${matchesType})`
      );

      return matchesSearch && matchesType;
    });

    console.log('Dados filtrados:', filteredData);

    this.dataSource.data = filteredData;

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  clearFilters(): void {
    console.log('Limpando filtros...');
    this.searchQuery = '';
    this.emailTypeFilter = ''; // Limpa também o filtro de tipo
    this.applyFilter(); // Reaplicar filtro para mostrar todos os dados
  }

  // Método para capturar mudanças no dropdown de tipo
  onEmailTypeChange(event: any): void {
    this.emailTypeFilter = event.value;
    console.log('Tipo de notificação selecionado:', this.emailTypeFilter); // Log do tipo selecionado
    this.applyFilter(); // Reaplicar filtro após mudança
  }

  // Navegar para a página de criação de template
  createTemplate(): void {
    const path = this.route.snapshot.url[0]?.path;

    if (path === 'mail-templates') {
      this.router.navigate(['/projects/default-template/new']);
    } else if (this.projectId) {
      this.router.navigate([`/projects/${this.projectId}/templates/new`]);
    }
  }

  // Navegar para a página de edição de um template específico
  editTemplate(templateId: string, isGlobal: boolean): void {
    if (isGlobal) {
      // Navega para editar um template global
      this.router.navigate([`projects/default-template/${templateId}/edit`]);
    } else {
      // Navega para editar um template de projeto específico
      this.router.navigate([
        `/projects/${this.projectId}/templates/${templateId}/edit`,
      ]);
    }
  }

  // Excluir um template específico
  async deleteTemplate(templateId: string, isGlobal: boolean): Promise<void> {
    // Exibir o modal de confirmação
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: { message: 'Você tem certeza que deseja excluir este template?' }, // Mensagem do modal
    });

    // Esperar pela resposta do usuário no modal
    const confirmed = await dialogRef.afterClosed().toPromise();

    if (confirmed) {
      try {
        let templateDocRef;
        // Verificar se o template é global ou específico do projeto
        if (isGlobal) {
          templateDocRef = doc(
            this.firestore,
            `defaultMailTemplate/${templateId}`
          );
        } else {
          templateDocRef = doc(
            this.firestore,
            `projects/${this.projectId}/templates/${templateId}`
          );
        }

        // Excluir o documento
        await deleteDoc(templateDocRef);

        // Atualizar a tabela removendo o template excluído
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
