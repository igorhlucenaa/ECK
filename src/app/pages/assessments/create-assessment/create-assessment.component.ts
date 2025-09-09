import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule, Location } from '@angular/common';
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
  competencies: { id: string; name: string }[] = [];
  competencyLists: { id: string; name: string; competencyIds: string[] }[] = [];
  userRole: string | null = null;
  creatorModel: SurveyCreatorModel;

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location
  ) {
    // Inicializa o formulário de metadados
    this.form = this.fb.group({
      clientId: ['', Validators.required],
      name: ['', Validators.required],
      description: [''],
      competencyIds: [[]], // Alterado para FormControl para multi-select
      mixQuestions: [true],
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
        this.form.get('clientId')?.setValue(clientId); // Define o valor antes de desabilitar
        this.form.get('clientId')?.disable(); // Desabilita após definir o valor
        console.log('Form status after clientId set:', this.form.status); // Depuração
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

    // Observa mudanças no clientId para carregar competências
    this.form.get('clientId')?.valueChanges.subscribe(clientId => {
      if (clientId) {
        this.loadCompetencies(clientId);
        this.loadCompetencyLists(clientId);
      } else {
        this.competencies = []; // Limpa as competências se nenhum cliente for selecionado
        this.competencyLists = [];
      }
    });

    // Observa mudanças nas competências selecionadas para gerar o formulário
    this.form.get('competencyIds')?.valueChanges.subscribe(async (competencyIds) => {
      await this.generateSurveyFromCompetencies(competencyIds);
    });

    this.form.get('mixQuestions')?.valueChanges.subscribe(async () => {
      const competencyIds = this.form.get('competencyIds')?.value as string[];
      await this.generateSurveyFromCompetencies(competencyIds);
    });
  }

  async loadCompetencies(clientId: string): Promise<void> {
    try {
      const competenciesCollection = collection(this.firestore, 'competencies');
      const q = query(competenciesCollection, where('clientId', '==', clientId));
      const snapshot = await getDocs(q);
      this.competencies = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data()['name']
      }));
    } catch (error) {
      console.error('Erro ao carregar competências:', error);
    }
  }

  async generateSurveyFromCompetencies(competencyIds: string[]): Promise<void> {
    if (!competencyIds || competencyIds.length === 0) {
      this.creatorModel.JSON = { pages: [] }; // Limpa o formulário
      return;
    }

    try {
      const pages: any[] = [];
      let questionCounter = 0; // Garante nomes de perguntas únicos
      const mixQuestions = !!this.form.get('mixQuestions')?.value;
      const allQuestions: any[] = [];

      for (const id of competencyIds) {
        const docRef = doc(this.firestore, 'competencies', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const competencyData = docSnap.data();
          if (competencyData && competencyData['questions']) {

            const questions = (competencyData['questions'] || []).map((q: any) => {
              const questionName = q.id || `q_${questionCounter++}`;

              let surveyQuestion: any = {
                name: questionName,
                title: q.text,
                isRequired: q.required,
              };

              // Mapeia os tipos de pergunta da competência para os tipos do SurveyJS
              switch (q.type) {
                case 'likert':
                  surveyQuestion.type = 'rating';
                  surveyQuestion.rateMin = 1;
                  surveyQuestion.rateMax = 5;
                  surveyQuestion.minRateDescription = 'Discordo Totalmente';
                  surveyQuestion.maxRateDescription = 'Concordo Totalmente';
                  break;
                case 'multiple_choice':
                  surveyQuestion.type = 'radiogroup';
                  surveyQuestion.choices = q.options || [];
                  break;
                case 'text':
                  surveyQuestion.type = 'comment'; // Campo de texto de múltiplas linhas
                  break;
                case 'number':
                  surveyQuestion.type = 'text';
                  surveyQuestion.inputType = 'number';
                  break;
                default:
                  surveyQuestion.type = 'text';
              }
              return surveyQuestion;
            });

            if (mixQuestions) {
              allQuestions.push(...questions);
            } else {
              // Cria uma página para a competência (sem descrição, conforme solicitação)
              const page = {
                name: `page_${id}`,
                title: competencyData['name'],
                description: '',
                elements: questions,
              };
              pages.push(page);
            }
          }
        }
      }

      if (mixQuestions) {
        // Embaralha perguntas de todas as competências e cria uma única página
        this.shuffleArray(allQuestions);
        pages.push({
          name: 'page_global',
          title: this.form.get('name')?.value || 'Avaliação',
          description: '',
          elements: allQuestions,
        });
      }

      const surveyJSON = {
        title: this.form.get('name')?.value || 'Avaliação de Competências',
        description: this.form.get('description')?.value || '',
        showProgressBar: 'top', // Melhora a navegação entre páginas
        pages: pages,
      };

      this.creatorModel.JSON = surveyJSON;
    } catch (error) {
      console.error('Erro ao gerar formulário a partir de competências:', error);
    }
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  async loadCompetencyLists(clientId: string): Promise<void> {
    try {
      const listsCollection = collection(this.firestore, 'competencyLists');
      const qy = query(listsCollection, where('clientId', '==', clientId));
      const snapshot = await getDocs(qy);
      this.competencyLists = snapshot.docs.map((d) => ({
        id: d.id,
        name: (d.data() as any)['name'],
        competencyIds: ((d.data() as any)['competencyIds'] as string[]) || [],
      }));
    } catch (error) {
      console.error('Erro ao carregar listas de competências:', error);
    }
  }

  onCompetencyListChange(listId: string): void {
    const list = this.competencyLists.find((l) => l.id === listId);
    if (!list) return;
    this.form.get('competencyIds')?.setValue(list.competencyIds);
  }

  async saveCurrentSelectionAsList(name: string): Promise<void> {
    const clientId = this.form.get('clientId')?.value as string;
    const competencyIds = (this.form.get('competencyIds')?.value as string[]) || [];
    if (!clientId || !name || competencyIds.length === 0) {
      this.snackBar.open('Informe um nome e selecione ao menos uma competência.', 'Fechar', { duration: 3000 });
      return;
    }
    try {
      const listsCollection = collection(this.firestore, 'competencyLists');
      await addDoc(listsCollection, {
        clientId,
        name,
        competencyIds,
        createdAt: new Date(),
      });
      this.snackBar.open('Lista salva com sucesso!', 'Fechar', { duration: 3000 });
      await this.loadCompetencyLists(clientId);
    } catch (error) {
      console.error('Erro ao salvar lista de competências:', error);
      this.snackBar.open('Erro ao salvar lista.', 'Fechar', { duration: 3000 });
    }
  }

  async loadAssessment(assessmentId: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, 'assessments', assessmentId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(data)
        this.form.patchValue({
          clientId: data['clientId'],
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

        console.log('Form status after loadAssessment:', this.form.status); // Depuração
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

  async saveForm(): Promise<void> {
    if (this.form.invalid) {
      console.error('O formulário é inválido. Status:', this.form.status);
      console.log('Valores do formulário:', this.form.value); // Depuração
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

        this.snackBar.open('Formulário atualizado com sucesso!', 'Fechar', {
          duration: 3000,
        });
      } else {
        // Cria um novo formulário associado ao cliente
        const assessmentsCollection = collection(this.firestore, 'assessments');
        await addDoc(assessmentsCollection, formData);

        this.snackBar.open('Formulário criado com sucesso!', 'Fechar', {
          duration: 3000,
        });
      }

      this.router.navigate(['/assessments']); // Redireciona para a lista de assessments
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
    console.log('Client changed, form status:', this.form.status); // Depuração
  }


  goBack(): void {
    this.location.back();
  }
}
