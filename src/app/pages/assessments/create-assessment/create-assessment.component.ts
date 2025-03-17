import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  where,
  query,
} from '@angular/fire/firestore';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { SurveyCreatorModel } from 'survey-creator-core';
import { SurveyCreatorModule } from 'survey-creator-angular';
import { SurveyModel, ITheme } from 'survey-core';
import 'survey-core/survey.i18n.js';
import 'survey-creator-core/survey-creator-core.i18n.js';
import { editorLocalization } from 'survey-creator-core';

// Sobrescrevendo traduções
const ptBRLocale = editorLocalization.getLocale('pt');
ptBRLocale.ed.addNewQuestion = 'Adicionar Nova Pergunta';

@Component({
  selector: 'app-create-assessment',
  standalone: true,
  templateUrl: './create-assessment.component.html',
  styleUrls: ['./create-assessment.component.scss'],
  imports: [
    CommonModule,
    MaterialModule,
    ReactiveFormsModule,
    SurveyCreatorModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CreateAssessmentComponent implements OnInit {
  form: FormGroup;
  clients: { id: string; name: string }[] = [];
  projects: { id: string; name: string }[] = []; // Nova lista de projetos
  userRole: string | null = null;
  creatorModel: SurveyCreatorModel;

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Inicializa o formulário de metadados (Título, Cliente, Descrição, Projeto)
    this.form = this.fb.group({
      clientId: ['', Validators.required],
      projectId: ['', Validators.required], // Campo obrigatório para projeto
      name: ['', Validators.required],
      description: [''],
    });
  }

  async ngOnInit(): Promise<void> {
    this.creatorModel = new SurveyCreatorModel({
      showLogicTab: true,
      isAutoSave: true,
      showJSONEditorTab: true,
      showThemeTab: true,
    });

    this.setupThemeSaving();
    this.creatorModel.locale = 'pt';
    this.creatorModel.survey.locale = 'pt';

    const currentUser = await this.authService.getCurrentUser();
    this.userRole = currentUser?.role || null;

    if (this.userRole === 'admin_client') {
      const clientId = currentUser?.clientId || '';
      if (clientId) {
        const clientName = await this.getClientName(clientId);
        this.clients = [
          { id: clientId, name: clientName || 'Cliente Indefinido' },
        ];
        this.form.get('clientId')?.setValue(clientId);
        this.form.get('clientId')?.disable();
        await this.loadProjects(clientId); // Carrega projetos para admin_client
      }
    } else if (this.userRole === 'admin_master') {
      await this.loadClients();
    }

    this.syncThemeWithEditor();

    this.route.paramMap.subscribe(async (params) => {
      const assessmentId = params.get('id');
      if (assessmentId) {
        await this.loadAssessment(assessmentId);
      }
    });
  }

  async loadAssessment(assessmentId: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, 'assessments', assessmentId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        this.form.patchValue({
          clientId: data['clientId'],
          projectId: data['projectId'], // Carrega o projectId
          name: data['name'],
          description: data['description'],
        });

        if (this.userRole === 'admin_client') {
          this.form.get('clientId')?.disable();
        }

        if (data['surveyJSON']) {
          this.creatorModel.JSON = data['surveyJSON'];
        }

        if (data['theme']) {
          this.creatorModel.theme = data['theme'];
        }

        // Carrega projetos após definir clientId
        await this.loadProjects(data['clientId']);
      }
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
    }
  }

  private setupThemeSaving(): void {
    this.creatorModel.saveThemeFunc = (saveNo: any, callback: any) => {
      const theme = this.creatorModel.theme as ITheme;
      callback(saveNo, true);
    };
  }

  private syncThemeWithEditor(): void {
    const defaultTheme: ITheme = {
      themeName: 'modern',
      colorPalette: 'light',
      isPanelless: false,
      cssVariables: {
        '--sjs-primary-backcolor': '#007BFF',
        '--sjs-secondary-backcolor': '#6C757D',
        '--sjs-general-backcolor': '#F8F9FA',
        '--sjs-general-forecolor': '#212529',
        '--sjs-hover-color': '#0056B3',
      },
    };

    this.creatorModel.theme = defaultTheme;
  }

  private async getClientName(clientId: string): Promise<string | null> {
    try {
      const clientDocRef = doc(this.firestore, 'clients', clientId);
      const clientDoc = await getDoc(clientDocRef);
      return clientDoc.exists()
        ? clientDoc.data()['companyName'] || null
        : null;
    } catch (error) {
      console.error('Erro ao buscar nome do cliente:', error);
      return null;
    }
  }

  async loadClients(): Promise<void> {
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

  async loadProjects(clientId: string): Promise<void> {
    try {
      if (!clientId) {
        this.projects = [];
        return;
      }

      const projectsCollection = collection(this.firestore, 'projects');
      const projectsQuery = query(
        projectsCollection,
        where('clientId', '==', clientId)
      );
      const snapshot = await getDocs(projectsQuery);
      this.projects = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Projeto Indefinido',
      }));

      // Se for edição, tenta pré-selecionar o projectId
      const projectId = this.form.get('projectId')?.value;
      if (projectId && !this.projects.some((p) => p.id === projectId)) {
        this.form.get('projectId')?.setValue(''); // Limpa se o projectId não estiver na lista
      }
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      this.projects = [];
    }
  }

  async saveForm(): Promise<void> {
    if (this.form.invalid) {
      console.error('O formulário é inválido.');
      return;
    }

    try {
      const currentUser = await this.authService.getCurrentUser();
      if (!currentUser) {
        console.error('Erro ao obter usuário autenticado.');
        return;
      }

      const surveyJSON = this.creatorModel.JSON;
      const currentTheme = this.creatorModel.theme as ITheme;

      const formData = {
        ...this.form.value,
        surveyJSON,
        theme: currentTheme,
        createdBy: {
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
        },
        createdAt: new Date(),
      };

      const assessmentId = this.route.snapshot.paramMap.get('id');
      if (assessmentId) {
        // Atualiza documento existente
        const docRef = doc(this.firestore, 'assessments', assessmentId);
        await updateDoc(docRef, formData);

        // Atualiza o projectId no projeto associado (se necessário)
        const projectRef = doc(this.firestore, 'projects', formData.projectId);
        await updateDoc(projectRef, { assessmentId: assessmentId });

        this.snackBar.open('Formulário atualizado com sucesso!', 'Fechar', {
          duration: 3000,
        });
      } else {
        // Cria um novo formulário e associa ao projeto
        const assessmentsCollection = collection(this.firestore, 'assessments');
        const assessmentDocRef = await addDoc(assessmentsCollection, formData);
        const assessmentId = assessmentDocRef.id;

        // Associa o assessmentId ao projeto
        const projectRef = doc(this.firestore, 'projects', formData.projectId);
        await updateDoc(projectRef, { assessmentId: assessmentId });

        this.snackBar.open('Formulário criado com sucesso!', 'Fechar', {
          duration: 3000,
        });
      }

      this.router.navigate(['/projects']); // Redireciona para a lista de projetos
    } catch (error) {
      console.error('Erro ao salvar formulário:', error);
      this.snackBar.open('Erro ao salvar. Tente novamente.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  onClientChange(event: any): void {
    const clientId = event.value;
    this.form.get('clientId')?.setValue(clientId);
    this.loadProjects(clientId); // Carrega projetos quando o cliente muda
    this.form.get('projectId')?.setValue(''); // Limpa o projeto ao mudar o cliente
  }
}
