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

@Component({
  selector: 'app-email-template-list',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './email-template-list.component.html',
  styleUrls: ['./email-template-list.component.scss'],
})
export class EmailTemplateListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'subject', 'actions']; // Colunas da tabela
  dataSource = new MatTableDataSource<any>(); // Fonte de dados da tabela
  projectId: string | null = null; // ID do projeto

  @ViewChild(MatPaginator) paginator!: MatPaginator; // Referência ao paginator
  @ViewChild(MatSort) sort!: MatSort; // Referência ao sort

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit(): void {
    // Obter o ID do projeto da rota
    this.projectId = this.route.snapshot.paramMap.get('id');

    if (this.projectId) {
      this.loadTemplates(); // Carregar templates associados ao projeto
    } else {
      this.snackBar.open('Projeto não encontrado.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  // Método para carregar templates de e-mail
  private async loadTemplates(): Promise<void> {
    try {
      const templatesCollection = collection(
        this.firestore,
        `projects/${this.projectId}/templates`
      );
      const snapshot = await getDocs(query(templatesCollection));

      // Mapeia os dados retornados para a tabela
      const templates = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      this.dataSource.data = templates;

      // Configurar sort e paginador
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;

      // Configurar o filtro para buscar por nome e assunto
      this.dataSource.filterPredicate = (data: any, filter: string) => {
        const lowerFilter = filter.trim().toLowerCase();
        return (
          data.name.toLowerCase().includes(lowerFilter) ||
          data.subject.toLowerCase().includes(lowerFilter)
        );
      };
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      this.snackBar.open('Erro ao carregar templates.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  // Método para aplicar o filtro (campo de busca)
  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  // Navegar para a página de criação de template
  createTemplate(): void {
    this.router.navigate([`/projects/${this.projectId}/templates/new`]);
  }

  // Navegar para a página de edição de um template específico
  editTemplate(templateId: string): void {
    this.router.navigate([
      `/projects/${this.projectId}/templates/${templateId}/edit`,
    ]);
  }

  // Excluir um template específico
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      const templateDocRef = doc(
        this.firestore,
        `projects/${this.projectId}/templates/${templateId}`
      );
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

  goBack(): void {
    this.location.back();
  }
}
