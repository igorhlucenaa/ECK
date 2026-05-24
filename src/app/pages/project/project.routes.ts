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

const LIST_ALLOWED = ['admin_master', 'admin_client', 'viewer'];
const CLIENT_SCOPE_ALLOWED = ['admin_master', 'admin_client'];
const MASTER_ONLY = ['admin_master'];

export const ProjectsRoutes: Routes = [
  {
    path: '',
    component: ProjectsListComponent,
    canActivate: [AuthGuard],
    data: { role: LIST_ALLOWED },
  },
  {
    path: 'new',
    component: ProjectDetailComponent,
    canActivate: [AuthGuard],
    data: { role: MASTER_ONLY },
  },
  {
    path: ':id/edit',
    component: ProjectDetailComponent,
    canActivate: [AuthGuard],
    data: { role: MASTER_ONLY },
  },
  {
    path: ':id/users',
    component: ProjectUsersComponent,
    canActivate: [AuthGuard],
    data: { role: CLIENT_SCOPE_ALLOWED },
  },
  {
    path: ':id/:idProject/templates',
    component: EmailTemplateListComponent,
    canActivate: [AuthGuard],
    data: { role: CLIENT_SCOPE_ALLOWED },
  },
  {
    path: ':id/templates',
    component: EmailTemplateListComponent,
    canActivate: [AuthGuard],
    data: { role: CLIENT_SCOPE_ALLOWED },
  },
  {
    path: ':id/templates/new',
    component: EmailTemplateFormComponent,
    canActivate: [AuthGuard],
    data: { role: CLIENT_SCOPE_ALLOWED },
  },
  {
    path: 'default-template/new',
    component: EmailTemplateFormComponent,
    canActivate: [AuthGuard],
    data: { role: CLIENT_SCOPE_ALLOWED },
  },
  {
    path: ':id/templates/:templateId/edit',
    component: EmailTemplateFormComponent,
    canActivate: [AuthGuard],
    data: { role: CLIENT_SCOPE_ALLOWED },
  },
  {
    path: 'default-template/:templateId/edit',
    component: EmailTemplateFormComponent,
    canActivate: [AuthGuard],
    data: { role: CLIENT_SCOPE_ALLOWED },
  },
  {
    path: ':id/questionnaires',
    component: QuestionnaireListComponent,
    canActivate: [AuthGuard],
    data: { role: MASTER_ONLY },
  },
  {
    path: ':id/questionnaires/new',
    component: QuestionnaireFormComponent,
    canActivate: [AuthGuard],
    data: { role: MASTER_ONLY },
  },
  {
    path: ':id/questionnaires/:questionnaireId/edit',
    component: QuestionnaireFormComponent,
    canActivate: [AuthGuard],
    data: { role: MASTER_ONLY },
  },
  {
    path: ':id/questionnaires/:questionnaireId/preview',
    component: QuestionnairePreviewComponent,
    canActivate: [AuthGuard],
    data: { role: MASTER_ONLY },
  },
  {
    path: 'assessments/:id',
    component: AssessmentListComponent,
    canActivate: [AuthGuard],
    data: { role: MASTER_ONLY },
  },
];

