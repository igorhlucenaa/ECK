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
} from '@angular/fire/firestore';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

import { SurveyCreatorModel } from 'survey-creator-core';
import { SurveyCreatorModule } from 'survey-creator-angular';

import 'survey-core/survey.i18n.js'; // Para localização da pesquisa em si
import 'survey-creator-core/survey-creator-core.i18n.js'; // Para a UI do Survey Creator
import { editorLocalization } from 'survey-creator-core';

// Sobrescrevendo traduções individuais em uma localização existente (opcional)
const ptBRLocale = editorLocalization.getLocale('pt');
// Exemplo de sobrescrita:
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
    private router: Router
  ) {
    // Inicializa o formulário de metadados (Título, Cliente, Descrição)
    this.form = this.fb.group({
      clientId: ['', Validators.required],
      name: ['', Validators.required],
      description: ['', Validators.required],
    });
  }

  async ngOnInit(): Promise<void> {
    // Inicialização do SurveyCreatorModel antes de configurar a localização
    this.creatorModel = new SurveyCreatorModel({
      showLogicTab: true, // Exibe a aba de lógica condicional
      isAutoSave: true, // Desativa salvamento automático
      showJSONEditorTab: true, // Permite edição JSON
    });

    // Aplica a localização após a inicialização do modelo
    this.creatorModel.locale = 'pt';
    this.creatorModel.survey.locale = 'pt';

    const currentUser = await this.authService.getCurrentUser();
    this.userRole = currentUser?.role || null;
    console.log('Criando SurveyJS:', this.creatorModel);
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

      const formData = {
        ...this.form.value,
        surveyJSON: this.creatorModel.JSON, // Obtém o JSON do SurveyJS
        createdBy: {
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
        },
        createdAt: new Date(),
      };

      const assessmentsCollection = collection(this.firestore, 'assessments');
      await addDoc(assessmentsCollection, formData);

      console.log('Formulário salvo com sucesso:', formData);
      this.snackBar.open('Formulário salvo com sucesso!', 'Fechar', {
        duration: 3000,
      });
      this.router.navigate(['/assessments']);
    } catch (error) {
      console.error('Erro ao salvar formulário:', error);
      this.snackBar.open(
        'Erro ao salvar formulário. Tente novamente.',
        'Fechar',
        { duration: 3000 }
      );
    }
  }

  onClientChange(event: any): void {
    console.log('Cliente selecionado:', event.value);
    this.form.get('clientId')?.setValue(event.value);
  }
}
