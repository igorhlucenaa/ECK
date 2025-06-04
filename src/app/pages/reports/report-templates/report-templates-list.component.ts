import { Component, OnInit } from '@angular/core';
import { ReportTemplate } from 'src/app/models/report-template.model';

@Component({
  selector: 'app-report-templates-list',
  templateUrl: './report-templates-list.component.html',
  styleUrls: ['./report-templates-list.component.scss']
})
export class ReportTemplatesListComponent implements OnInit {
  templates: ReportTemplate[] = [];

  constructor() {}

  ngOnInit(): void {
    // Carregar templates do Firestore futuramente
  }

  onCreate() {
    // Navegar para criação de novo template
  }

  onEdit(template: ReportTemplate) {
    // Navegar para edição
  }

  onDelete(template: ReportTemplate) {
    // Excluir template
  }
}
