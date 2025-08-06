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
import { SurveyModel, ITheme, settings } from 'survey-core';
import 'survey-core/survey.i18n.js';
import 'survey-creator-core/survey-creator-core.i18n.js';
import { editorLocalization } from 'survey-creator-core';
import { ScaleService } from 'src/app/services/scale.service';
import { Scale } from 'src/app/models/scale.model';

import { MatDialog } from '@angular/material/dialog';
import { ScaleManagerComponent } from '../scale-manager/scale-manager.component';

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
  scales: Scale[] = [];

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private scaleService: ScaleService,
    private dialog: MatDialog
  ) {
    // Inicializa o formulário de metadados (Título, Cliente, Descrição)
    this.form = this.fb.group({
      clientId: ['', Validators.required],
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

    this.setupSurveyJSProperties();
  }

  async loadScales(clientId: string): Promise<void> {
    if (!clientId) return;
    this.scales = await this.scaleService.getScalesByClient(clientId);
    // Atualiza as opções da propriedade customizada no SurveyJS
    this.setupSurveyJSProperties();
  }

  setupSurveyJSProperties(): void {
    // Adiciona propriedade customizada para questões do tipo matriz
    if (this.creatorModel && this.creatorModel.survey) {
      // Registra a propriedade customizada 'scaleId' para questões matriz
      (this.creatorModel.survey as any)['addProperty']('matrix', {
        name: 'scaleId',
        title: 'Modelo de Escala',
        type: 'dropdown',
        choices: this.scales.map(s => ({ value: s.id, text: s.name })),
        category: 'general',
        onSetValue: (obj: any, value: any) => {
          const selectedScale = this.scales.find(s => s.id === value);
          if (selectedScale) {
            obj.columns = selectedScale.options;
            console.log('Escala aplicada:', selectedScale.name);
          }
        }
      });

      // Listener para quando uma nova questão é adicionada
      this.creatorModel.survey.onQuestionAdded.add((sender, options) => {
        if (options.question.getType() === 'matrix') {
          console.log('Nova questão matriz adicionada');
          // Aqui podemos adicionar lógica adicional se necessário
        }
      });
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
    this.loadScales(clientId); // Carrega as escalas para o cliente selecionado
  }


  goBack(): void {
    this.location.back();
  }

  openScaleManager(): void {
    const clientId = this.form.get('clientId')?.value;
    if (!clientId) {
      this.snackBar.open('Por favor, selecione um cliente primeiro.', 'Fechar', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(ScaleManagerComponent, {
      width: '800px',
      data: { clientId: clientId }
    });

    dialogRef.afterClosed().subscribe(() => {
      // Recarrega as escalas para atualizar o dropdown no SurveyJS
      this.loadScales(clientId);
    });
  }
}
