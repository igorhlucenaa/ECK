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
} from '@angular/fire/firestore';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';

import { SurveyCreatorModel } from 'survey-creator-core';
import { SurveyCreatorModule } from 'survey-creator-angular';
import { SurveyModel, ITheme } from 'survey-core'; // Usando ITheme corretamente

import 'survey-core/survey.i18n.js'; // Para localização da pesquisa
import 'survey-creator-core/survey-creator-core.i18n.js'; // Para a UI do Survey Creator
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
    // Inicializa o formulário de metadados (Título, Cliente, Descrição)
    this.form = this.fb.group({
      clientId: ['', Validators.required],
      name: ['', Validators.required],
      description: [''],
    });
  }

  async ngOnInit(): Promise<void> {
    // Inicialização do SurveyCreatorModel com o Theme Editor habilitado
    this.creatorModel = new SurveyCreatorModel({
      showLogicTab: true, // Exibe a aba de lógica condicional
      isAutoSave: true, // Desativa salvamento automático
      showJSONEditorTab: true, // Permite edição JSON
      showThemeTab: true, // Habilita a aba de temas (Theme Editor)
    });

    // Configurar a função de salvar o tema
    this.setupThemeSaving();

    // Aplica a localização
    this.creatorModel.locale = 'pt';
    this.creatorModel.survey.locale = 'pt';

    const currentUser = await this.authService.getCurrentUser();
    this.userRole = currentUser?.role || null;
    
    if (this.userRole === 'admin_client') {
      // Usuário admin_client vê apenas o cliente associado
      const clientId = currentUser?.clientId || '';
      if (clientId) {
        const clientName = await this.getClientName(clientId);
        this.clients = [
          { id: clientId, name: clientName || 'Cliente Indefinido' },
        ];
        this.form.get('clientId')?.setValue(clientId);
        this.form.get('clientId')?.disable();
      }
    } else if (this.userRole === 'admin_master') {
      // Usuário admin_master vê todos os clientes
      await this.loadClients();
    }

    // Sincronizar o tema inicial com o Theme Editor
    this.syncThemeWithEditor();

    this.route.paramMap.subscribe(async (params) => {
      const assessmentId = params.get('id');
      if (assessmentId) {
        this.loadAssessment(assessmentId);
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
          name: data['name'],
          description: data['description'],
        });

        if (this.userRole === 'admin_client') {
          this.form.get('clientId')?.disable();
        }

        // Carregar o JSON do SurveyJS
        if (data['surveyJSON']) {
          this.creatorModel.JSON = data['surveyJSON'];
        }

        // Carregar o tema salvo
        if (data['theme']) {
          this.creatorModel.theme = data['theme'];
        }
      }
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
    }
  }

  private setupThemeSaving(): void {
    // Função personalizada para salvar o tema no Firestore junto com o formulário
    this.creatorModel.saveThemeFunc = (saveNo: any, callback: any) => {
      // O tema já está disponível em this.creatorModel.theme
      const theme = this.creatorModel.theme as ITheme;
      // Aqui, não precisamos salvar em localStorage ou serviço web, pois salvaremos no Firestore no saveForm()
      callback(saveNo, true); // Indica que o salvamento foi bem-sucedido (não precisamos de ação externa aqui)
    };
  }

  private syncThemeWithEditor(): void {
    // Configurar um tema inicial padrão usando ITheme
    const defaultTheme: ITheme = {
      themeName: 'modern', // Nome do tema base
      colorPalette: 'light', // Paleta de cores (pode ser 'light' ou 'dark')
      isPanelless: false, // Mantém os painéis (false para manter o layout padrão)
      cssVariables: {
        '--sjs-primary-backcolor': '#007BFF', // Cor primária padrão
        '--sjs-secondary-backcolor': '#6C757D', // Cor secundária padrão
        '--sjs-general-backcolor': '#F8F9FA', // Fundo geral
        '--sjs-general-forecolor': '#212529', // Texto geral
        '--sjs-hover-color': '#0056B3', // Cor ao passar o mouse
      },
    };

    // Aplicar o tema inicial ao Theme Editor
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
        this.snackBar.open('Formulário atualizado com sucesso!', 'Fechar', {
          duration: 3000,
        });
      } else {
        // Cria um novo formulário
        const assessmentsCollection = collection(this.firestore, 'assessments');
        await addDoc(assessmentsCollection, formData);
        this.snackBar.open('Formulário criado com sucesso!', 'Fechar', {
          duration: 3000,
        });
      }

      this.router.navigate(['/assessments']);
    } catch (error) {
      console.error('Erro ao salvar formulário:', error);
      this.snackBar.open('Erro ao salvar. Tente novamente.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  onClientChange(event: any): void {
        this.form.get('clientId')?.setValue(event.value);
  }
}
