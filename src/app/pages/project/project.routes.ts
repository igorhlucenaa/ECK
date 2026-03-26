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

export const ProjectsRoutes: Routes = [
  {
    path: '',
    component: ProjectsListComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' }, // Apenas admin_client pode acessar
  },
  {
    path: 'new',
    component: ProjectDetailComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' }, // Apenas admin_client pode criar
  },
  {
    path: ':id/edit',
    component: ProjectDetailComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' }, // Apenas admin_client pode editar
  },
  {
    path: ':id/users',
    component: ProjectUsersComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' },
  },
  {
    path: ':id/:idProject/templates',
    component: EmailTemplateListComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' },
  },
  {
    path: ':id/templates/new',
    component: EmailTemplateFormComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' },
  },
  {
    path: 'default-template/new',
    component: EmailTemplateFormComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' },
  },
  {
    path: ':id/templates/:templateId/edit',
    component: EmailTemplateFormComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' },
  },
  {
    path: 'default-template/:templateId/edit',
    component: EmailTemplateFormComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' }, // Garantir que apenas o admin_client possa editar templates
  },
  {
    path: ':id/questionnaires',
    component: QuestionnaireListComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' }, // Apenas admin_client pode visualizar os questionários
  },
  {
    path: ':id/questionnaires/new',
    component: QuestionnaireFormComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' }, // Apenas admin_client pode criar questionários
  },
  {
    path: ':id/questionnaires/:questionnaireId/edit',
    component: QuestionnaireFormComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' }, // Apenas admin_client pode editar questionários
  },
  {
    path: ':id/questionnaires/:questionnaireId/preview',
    component: QuestionnairePreviewComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' },
  },
  {
    path: 'assessments/:id',
    component: AssessmentListComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin_client' },
  },
];
