import { Routes } from '@angular/router';
import { ProjectsListComponent } from './projects-list/projects-list.component';
import { ProjectDetailComponent } from './project-detail/project-detail.component';
import { AuthGuard } from 'src/app/guards/auth.guard';
import { ProjectUsersComponent } from './project-users/project-users.component';
import { EmailTemplateListComponent } from './email-template-list/email-template-list.component';
import { EmailTemplateFormComponent } from './email-template-list/email-template-form/email-template-form.component';
import { QuestionnaireListComponent } from './questionnaire-list/questionnaire-list.component';
import { QuestionnaireFormComponent } from './questionnaire-list/questionnaire-form/questionnaire-form.component';
import { QuestionnairePreviewComponent } from './questionnaire-list/preview-questionnaire/preview-questionnaire.component';
import { AssessmentListComponent } from '../assessments/assessment-list/assessment-list.component';

// admin_master: acesso total a todos os projetos (visualizar, criar, editar, excluir)
// admin_client: acessa e visualiza apenas os projetos do próprio cliente (sem criar/editar/excluir)
const ALLOWED = ['admin_master', 'admin_client'];

export const ProjectsRoutes: Routes = [
  {
    path: '',
    component: ProjectsListComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
  {
    path: 'new',
    component: ProjectDetailComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
  {
    path: ':id/edit',
    component: ProjectDetailComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
  {
    path: ':id/users',
    component: ProjectUsersComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
  {
    path: ':id/:idProject/templates',
    component: EmailTemplateListComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
  {
    path: ':id/templates',
    component: EmailTemplateListComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
  {
    path: ':id/templates/new',
    component: EmailTemplateFormComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
  {
    path: 'default-template/new',
    component: EmailTemplateFormComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
  {
    path: ':id/templates/:templateId/edit',
    component: EmailTemplateFormComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
  {
    path: 'default-template/:templateId/edit',
    component: EmailTemplateFormComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
  {
    path: ':id/questionnaires',
    component: QuestionnaireListComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
  {
    path: ':id/questionnaires/new',
    component: QuestionnaireFormComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
  {
    path: ':id/questionnaires/:questionnaireId/edit',
    component: QuestionnaireFormComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
  {
    path: ':id/questionnaires/:questionnaireId/preview',
    component: QuestionnairePreviewComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
  {
    path: 'assessments/:id',
    component: AssessmentListComponent,
    canActivate: [AuthGuard],
    data: { role: ALLOWED },
  },
];
