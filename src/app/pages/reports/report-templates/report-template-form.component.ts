import { Component, OnInit } from '@angular/core';
import { ReportTemplate, ReportSection, ReportSectionType } from 'src/app/models/report-template.model';

@Component({
  selector: 'app-report-template-form',
  templateUrl: './report-template-form.component.html',
  styleUrls: ['./report-template-form.component.scss']
})
export class ReportTemplateFormComponent implements OnInit {
  template: ReportTemplate = { name: '', sections: [] };
  sectionTypes: ReportSectionType[] = ['logo', 'text', 'summary', 'highlights', 'lows', 'customText'];

  constructor() {}

  ngOnInit(): void {
    // Carregar template para edição se necessário
  }

  addSection(type: ReportSectionType) {
    this.template.sections.push({ type });
  }

  removeSection(index: number) {
    this.template.sections.splice(index, 1);
  }

  moveSectionUp(index: number) {
    if (index > 0) {
      const temp = this.template.sections[index];
      this.template.sections[index] = this.template.sections[index - 1];
      this.template.sections[index - 1] = temp;
    }
  }

  moveSectionDown(index: number) {
    if (index < this.template.sections.length - 1) {
      const temp = this.template.sections[index];
      this.template.sections[index] = this.template.sections[index + 1];
      this.template.sections[index + 1] = temp;
    }
  }

  onLogoUpload(event: any, section: ReportSection) {
    // Lógica de upload de logo (integrar com Firestore Storage)
  }

  saveTemplate() {
    // Salvar no Firestore
  }
}
