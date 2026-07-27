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
import { TranslateModule } from '@ngx-translate/core';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';
import { CompetencyQuestionsService, CompetencyQuestionSource } from 'src/app/services/competency-questions.service';

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
    TranslateModule,
    AppPageHeaderComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CreateAssessmentComponent implements OnInit {
  form: FormGroup;
  clients: { id: string; name: string }[] = [];
  competencies: { id: string; name: string }[] = [];
  competencyLists: { id: string; name: string; competencyIds: string[] }[] = [];
  competencyGroups: { id: string; name: string; competencias: any[] }[] = [];
  selectedGroupId: string = '';
  userRole: string | null = null;
  creatorModel: SurveyCreatorModel;

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private competencyQuestionsService: CompetencyQuestionsService
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
      showTranslationTab: true,
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
        this.loadCompetencyGroups(clientId);
      } else {
        this.competencies = []; // Limpa as competências se nenhum cliente for selecionado
        this.competencyLists = [];
        this.competencyGroups = [];
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
      console.log('🔍 INICIANDO CARREGAMENTO DE COMPETÊNCIAS');
      console.log('  - ClientId:', clientId);
      
      const competenciesSet = new Map<string, { id: string; name: string }>();
      
      // 1. Carregar competências da coleção 'competencies' (formato antigo - para compatibilidade)
      try {
        console.log('📚 Buscando na coleção "competencies"...');
        const competenciesCollection = collection(this.firestore, 'competencies');
        const q = query(competenciesCollection, where('clientId', '==', clientId));
        const snapshot = await getDocs(q);
        console.log(`  - Encontrados ${snapshot.docs.length} documentos na coleção "competencies"`);
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log(`  - Competência encontrada (formato antigo):`, {
            id: doc.id,
            name: data['name'],
            data: data
          });
          competenciesSet.set(doc.id, {
            id: doc.id,
            name: data['name'] || ''
          });
        });
      } catch (error) {
        console.warn('⚠️ Erro ao carregar competências da coleção competencies:', error);
      }
      
      // 2. Carregar competências dos grupos de competências (formato novo)
      try {
        console.log('📦 Buscando na coleção "competencyGroups"...');
        const groupsCollection = collection(this.firestore, 'competencyGroups');
        const groupsQuery = query(groupsCollection, where('clientId', '==', clientId));
        const groupsSnapshot = await getDocs(groupsQuery);
        console.log(`  - Encontrados ${groupsSnapshot.docs.length} grupos de competências`);
        
        groupsSnapshot.docs.forEach((groupDoc, groupIndex) => {
          const groupData = groupDoc.data();
          const competencias = groupData['competencias'] || [];
          
          console.log(`  - Grupo ${groupIndex + 1}:`, {
            id: groupDoc.id,
            name: groupData['name'],
            clientId: groupData['clientId'],
            totalCompetencias: competencias.length,
            competencias: competencias
          });
          
          // Adicionar cada competência do grupo à lista
          competencias.forEach((comp: any, index: number) => {
            if (comp && comp.nome) {
              // Criar um ID único para a competência: grupoId_comp_index
              const uniqueId = `${groupDoc.id}_comp_${index}`;
              console.log(`    ✅ Competência encontrada no grupo:`, {
                uniqueId: uniqueId,
                nome: comp.nome,
                descricao: comp.descricao,
                perguntasIds: comp.perguntasIds,
                index: index
              });
              competenciesSet.set(uniqueId, {
                id: uniqueId,
                name: comp.nome || `Competência ${index + 1}`
              });
            } else {
              console.warn(`    ⚠️ Competência inválida no índice ${index}:`, comp);
            }
          });
        });
      } catch (error) {
        console.error('❌ Erro ao carregar competências dos grupos:', error);
        console.error('  - Detalhes do erro:', error);
      }
      
      // Converter Map para Array
      this.competencies = Array.from(competenciesSet.values());
      
      console.log(`✅ RESULTADO FINAL:`);
      console.log(`  - Total de competências carregadas: ${this.competencies.length}`);
      console.log(`  - Lista de competências:`, this.competencies);
      
      if (this.competencies.length === 0) {
        console.warn('⚠️ NENHUMA COMPETÊNCIA ENCONTRADA!');
        console.warn('  - Verifique se há grupos salvos para este cliente');
        console.warn('  - Verifique se o clientId está correto:', clientId);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar competências:', error);
      console.error('  - Stack trace:', error);
      this.snackBar.open('Erro ao carregar competências', 'Fechar', { duration: 3000 });
    }
  }

  async generateSurveyFromCompetencies(competencyIds: string[]): Promise<void> {
    if (!competencyIds || competencyIds.length === 0) {
      this.creatorModel.JSON = { pages: [] };
      return;
    }

    try {
      const pages: any[] = [];
      let questionCounter = 0;
      const mixQuestions = !!this.form.get('mixQuestions')?.value;
      const allQuestions: any[] = [];
      const groupCache = new Map<string, Record<string, unknown> | null>();
      const assessmentCache = new Map<string, Record<string, unknown> | null>();
      let competenciesWithoutQuestions = 0;

      for (const id of competencyIds) {
        let competencyName = '';
        let questions: CompetencyQuestionSource[] = [];

        const parsedGroupComp = this.competencyQuestionsService.parseGroupCompetencyId(id);
        if (parsedGroupComp) {
          const { groupId, groupIndex } = parsedGroupComp;

          if (!groupCache.has(groupId)) {
            const groupDocSnap = await getDoc(doc(this.firestore, 'competencyGroups', groupId));
            groupCache.set(groupId, groupDocSnap.exists() ? groupDocSnap.data() : null);
          }

          const groupData = groupCache.get(groupId);
          const competencias = (groupData?.['competencias'] as unknown[]) || [];

          if (groupData && competencias[groupIndex]) {
            const comp = competencias[groupIndex] as Record<string, unknown>;
            competencyName = String(comp['nome'] || comp['name'] || '');

            let assessmentSurveyJSON: Record<string, unknown> | null = null;
            const assessmentId = groupData['assessmentId'] as string | undefined;
            if (assessmentId) {
              if (!assessmentCache.has(assessmentId)) {
                const assessmentSnap = await getDoc(doc(this.firestore, 'assessments', assessmentId));
                assessmentCache.set(
                  assessmentId,
                  assessmentSnap.exists() ? (assessmentSnap.data()?.['surveyJSON'] as Record<string, unknown>) || null : null
                );
              }
              assessmentSurveyJSON = assessmentCache.get(assessmentId) || null;
            }

            questions = this.competencyQuestionsService.resolveCompetencyQuestions(
              comp as any,
              groupData,
              assessmentSurveyJSON
            );
          }
        } else {
          const docSnap = await getDoc(doc(this.firestore, 'competencies', id));

          if (docSnap.exists()) {
            const competencyData = docSnap.data();
            competencyName = competencyData['name'] || '';

            if (Array.isArray(competencyData['questions'])) {
              questions = competencyData['questions'].map((q: any) => ({
                id: q.id || `q_${questionCounter++}`,
                text: q.text || '',
                type: q.type || 'rating',
                required: true,
                options: q.options,
              }));
            }
          }
        }

        if (questions.length === 0) {
          competenciesWithoutQuestions++;
          continue;
        }

        const surveyQuestions = questions.map((q) =>
          this.competencyQuestionsService.toSurveyQuestion(q, questionCounter++)
        );

        if (mixQuestions) {
          allQuestions.push(...surveyQuestions);
        } else {
          pages.push({
            name: `page_${id}`,
            title: competencyName,
            description: '',
            elements: surveyQuestions,
          });
        }
      }

      if (mixQuestions && allQuestions.length > 0) {
        this.shuffleArray(allQuestions);
        pages.push({
          name: 'page_global',
          title: this.form.get('name')?.value || 'Avaliação',
          description: '',
          elements: allQuestions,
        });
      }

      this.creatorModel.JSON = {
        title: this.form.get('name')?.value || 'Avaliação de Competências',
        description: this.form.get('description')?.value || '',
        showProgressBar: 'top',
        pages,
      };

      if (pages.length === 0) {
        this.snackBar.open(
          'Nenhuma pergunta encontrada nas competências selecionadas. Verifique se elas têm perguntas vinculadas no grupo de competências.',
          'Fechar',
          { duration: 5000 }
        );
      } else if (competenciesWithoutQuestions > 0) {
        this.snackBar.open(
          `${competenciesWithoutQuestions} competência(s) sem perguntas foram ignoradas.`,
          'Fechar',
          { duration: 4000 }
        );
      }
    } catch (error) {
      console.error('Erro ao gerar formulário a partir das competências:', error);
      this.snackBar.open('Erro ao gerar formulário a partir das competências', 'Fechar', { duration: 3000 });
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

  async loadCompetencyGroups(clientId: string): Promise<void> {
    try {
      console.log('📦 Carregando grupos de competências para cliente:', clientId);
      const groupsCollection = collection(this.firestore, 'competencyGroups');
      const groupsQuery = query(groupsCollection, where('clientId', '==', clientId));
      const groupsSnapshot = await getDocs(groupsQuery);
      
      this.competencyGroups = groupsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data['name'] || '',
          competencias: data['competencias'] || []
        };
      });
      
      console.log(`✅ Total de grupos carregados: ${this.competencyGroups.length}`);
    } catch (error) {
      console.error('❌ Erro ao carregar grupos de competências:', error);
      this.snackBar.open('Erro ao carregar grupos de competências', 'Fechar', { duration: 3000 });
    }
  }

  async onCompetencyGroupChange(groupId: string): Promise<void> {
    this.selectedGroupId = groupId;

    if (!groupId) {
      this.form.get('competencyIds')?.setValue([]);
      return;
    }

    const group = this.competencyGroups.find((g) => g.id === groupId);
    if (!group) return;

    const clientId = this.form.get('clientId')?.value;
    if (clientId) {
      await this.loadCompetencies(clientId);
    }

    const competencyIds: string[] = [];
    group.competencias.forEach((_comp: any, index: number) => {
      const uniqueId = `${groupId}_comp_${index}`;
      if (this.competencies.some(c => c.id === uniqueId)) {
        competencyIds.push(uniqueId);
      }
    });

    if (competencyIds.length > 0) {
      this.form.get('competencyIds')?.setValue(competencyIds);
      this.snackBar.open(`Grupo "${group.name}" selecionado com ${competencyIds.length} competências`, 'Fechar', { duration: 3000 });
    } else {
      this.snackBar.open(`Nenhuma competência encontrada para o grupo "${group.name}"`, 'Fechar', { duration: 3000 });
    }
  }

  private detectSelectedGroup(competencyIds: string[]): void {
    if (!competencyIds || competencyIds.length === 0) return;
    const groupIds = new Set<string>();
    for (const id of competencyIds) {
      const parsed = this.competencyQuestionsService.parseGroupCompetencyId(id);
      if (parsed) {
        groupIds.add(parsed.groupId);
      }
    }
    if (groupIds.size === 1) {
      this.selectedGroupId = Array.from(groupIds)[0];
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

      if (!docSnap.exists()) return;

      const data = docSnap.data();
      const clientId = data['clientId'];
      const savedCompetencyIds: string[] = data['competencyIds'] || [];
      const savedMixQuestions: boolean = data['mixQuestions'] ?? true;

      // Preenche campos básicos sem disparar valueChanges (evita regenerar o survey)
      this.form.patchValue({
        clientId,
        name: data['name'],
        description: data['description'],
        mixQuestions: savedMixQuestions,
      }, { emitEvent: false });

      // Carrega as listas dependentes do cliente manualmente
      if (clientId) {
        await Promise.all([
          this.loadCompetencies(clientId),
          this.loadCompetencyLists(clientId),
          this.loadCompetencyGroups(clientId),
        ]);
      }

      // Restaura competências selecionadas sem disparar geração do survey
      // (o surveyJSON já está salvo e será carregado abaixo)
      if (savedCompetencyIds.length > 0) {
        this.form.get('competencyIds')?.setValue(savedCompetencyIds, { emitEvent: false });
        this.detectSelectedGroup(savedCompetencyIds);
      }

      if (this.userRole === 'admin_client') {
        this.form.get('clientId')?.disable();
      }

      // Restaura o survey e tema do editor
      if (data['surveyJSON']) {
        this.creatorModel.JSON = data['surveyJSON'];
      }

      if (data['theme']) {
        this.creatorModel.theme = data['theme'];
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


  get isEditMode(): boolean {
    return !!this.route.snapshot.paramMap.get('id');
  }

  goBack(): void {
    this.location.back();
  }
}
