import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray, FormControl } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { Firestore, collection, getDocs, getDoc, addDoc, doc, updateDoc, deleteDoc, query, where } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/apps/authentication/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { CompetencyDialogComponent } from './competency-dialog/competency-dialog.component';
import { CreateQuestionDialogComponent } from './create-question-dialog/create-question-dialog.component';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

interface Competency {
  id: string;
  name: string;
  description: string;
  clientId: string;
  questions?: Question[];
  createdAt: Date;
  updatedAt: Date;
}

interface Question {
  id: string;
  text: string;
  type: 'likert' | 'multiple_choice' | 'text' | 'number';
  options?: string[];
  required: boolean;
  order: number;
}

interface Client {
  id: string;
  companyName: string;
}

// Interface igual ao reports
interface Competencia {
  id: string;
  nome: string;
  descricao: string;
  perguntasIds: string[];
}

interface QuestionData {
  id: string;
  title: string;
  type: string;
}

@Component({
  selector: 'app-competencies',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, FormsModule, TranslateModule],
  templateUrl: './competencies.component.html',
  styleUrls: ['./competencies.component.scss']
})
export class CompetenciesComponent implements OnInit {
  competencies: Competency[] = [];
  clients: Client[] = [];
  selectedClientId: string = '';
  userRole: string = '';
  userClientId: string = '';
  isLoading = false;

  // Gerenciamento de grupos (igual ao reports)
  groupName: string = '';
  selectedGroupId: string = '';
  competencyGroups: any[] = [];
  groupCompetencies: Competencia[] = []; // Competências temporárias (igual this.competencias no /reports)

  // Competência sendo editada (igual ao reports)
  competenciaEditando: Competencia = { id: '', nome: '', descricao: '', perguntasIds: [] };

  // ✅ FormGroup para competências (igual ao reports)
  competenciaForm!: FormGroup;

  // Perguntas e filtros (igual ao reports)
  allQuestions: QuestionData[] = [];
  filteredQuestions: QuestionData[] = [];
  // ✅ Convertido para FormControl (igual ao reports)
  includeOpenQuestions = new FormControl(false);
  perguntasBloqueadas = new Set<string>();

  // ✅ Arrays sincronizados (igual ao reports)
  dynamicColumns: string[] = [];
  questionMap: { [key: string]: string } = {};

  constructor(
    private firestore: Firestore,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    private dialog: MatDialog,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    // ✅ Inicializar FormGroup (igual ao reports)
    this.competenciaForm = this.fb.group({
      nome: ['', Validators.required],
      descricao: ['', Validators.required],
      perguntasIds: [[] as string[], Validators.required]
    });

    // ✅ Configurar listener para mudanças no filtro (igual ao reports)
    this.includeOpenQuestions.valueChanges.subscribe(() => {
      this.onQuestionFilterChange();
    });

    await this.loadUserData();
    await this.loadClients();
    await this.loadCompetencyGroups();
    // ✅ Sempre carrega perguntas (não tem mais modo individual)
    await this.loadAllQuestions();
  }

  private async loadUserData(): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (currentUser) {
      this.userRole = currentUser.role;
      this.userClientId = currentUser.clientId || '';

      if (this.userRole === 'admin_client' && this.userClientId) {
        this.selectedClientId = this.userClientId;
      }
    }
  }

  private async loadClients(): Promise<void> {
    try {
      if (this.userRole === 'admin_master') {
        const clientsCollection = collection(this.firestore, 'clients');
        const snapshot = await getDocs(clientsCollection);
        this.clients = snapshot.docs.map(doc => ({
          id: doc.id,
          companyName: doc.data()['companyName'] || 'Cliente sem nome'
        }));
      } else if (this.userRole === 'admin_client' && this.userClientId) {
        const clientDoc = await getDoc(doc(this.firestore, 'clients', this.userClientId));
        if (clientDoc.exists()) {
          this.clients = [{
            id: this.userClientId,
            companyName: clientDoc.data()['companyName'] || 'Cliente sem nome'
          }];
        }
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open('Erro ao carregar clientes', 'Fechar', { duration: 3000 });
    }
  }

  // Método removido - não salva mais competências individuais (igual ao /reports)

  async loadCompetencyGroups(): Promise<void> {
    if (!this.selectedClientId) {
      this.competencyGroups = [];
      return;
    }

    try {
      const groupsCollection = collection(this.firestore, 'competencyGroups');
      const q = query(groupsCollection, where('clientId', '==', this.selectedClientId));
      const snapshot = await getDocs(q);

      this.competencyGroups = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
    } catch (error) {
      console.error('Erro ao carregar grupos de competências:', error);
      this.competencyGroups = [];
    }
  }

  onClientChange(): void {
    // Limpa dados ao trocar cliente
    this.groupCompetencies = [];
    this.competencyGroups = [];
    this.allQuestions = [];
    this.filteredQuestions = [];
    this.dynamicColumns = [];

    // Carrega dados do novo cliente
    this.loadCompetencyGroups();
    this.loadAllQuestions();
  }

  async loadAllQuestions(): Promise<void> {
    if (!this.selectedClientId) {
      this.allQuestions = [];
      this.filteredQuestions = [];
      return;
    }

    try {
      const questions: QuestionData[] = [];

      // Carrega perguntas de todas as avaliações do cliente
      const assessmentsCollection = collection(this.firestore, 'assessments');
      const assessmentsQuery = query(assessmentsCollection, where('clientId', '==', this.selectedClientId));
      const assessmentsSnapshot = await getDocs(assessmentsQuery);

      for (const doc of assessmentsSnapshot.docs) {
        const data = doc.data();
        const surveyJSON = data['surveyJSON'];

        if (surveyJSON && Array.isArray(surveyJSON.pages)) {
          surveyJSON.pages.forEach((page: any) => {
            if (Array.isArray(page.elements)) {
              page.elements.forEach((el: any) => {
                // Matriz (linhas viram perguntas individuais)
                if ((el.type === 'matrix' || el.type === 'matrixdropdown') && Array.isArray(el.rows)) {
                  el.rows.forEach((row: any, rowIndex: number) => {
                    if (!row) return;
                    let questionText = '';
                    if (row.text && typeof row.text === 'object' && row.text.pt) {
                      questionText = row.text.pt.trim();
                    } else if (row.text && typeof row.text === 'string') {
                      questionText = row.text.trim();
                    } else {
                      questionText = `Questão ${rowIndex + 1}`;
                    }
                    const questionId = `${el.name}_${row.value}`;
                    questions.push({ id: questionId, title: questionText, type: 'matrix_row' });
                  });
                } else if (el.name) {
                  // Perguntas simples
                  let questionTitle = '';
                  if (el.title && typeof el.title === 'object' && el.title.pt) {
                    questionTitle = el.title.pt.trim();
                  } else if (el.title && typeof el.title === 'string') {
                    questionTitle = el.title.trim();
                  } else if (el.name && typeof el.name === 'string') {
                    questionTitle = el.name.trim();
                  } else {
                    questionTitle = 'Pergunta sem título';
                  }
                  questions.push({ id: el.name, title: questionTitle, type: el.type });
                }
              });
            }
          });
        }
      }

      // Carrega perguntas customizadas do cliente
      const customQuestionsCollection = collection(this.firestore, 'customQuestions');
      const customQuestionsQuery = query(customQuestionsCollection, where('clientId', '==', this.selectedClientId));
      const customQuestionsSnapshot = await getDocs(customQuestionsQuery);

      customQuestionsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        questions.push({
          id: data['id'] || doc.id,
          title: data['title'] || 'Pergunta sem título',
          type: data['type'] || 'text'
        });
      });

      this.allQuestions = questions;

      // ✅ Criar questionMap (igual ao reports)
      this.questionMap = {};
      questions.forEach(q => {
        this.questionMap[q.id] = q.title;
      });

      // ✅ Aplicar filtro e atualizar dynamicColumns
      this.applyQuestionFilter();
    } catch (error) {
      console.error('Erro ao carregar perguntas:', error);
      this.allQuestions = [];
      this.filteredQuestions = [];
      this.dynamicColumns = [];
    }
  }

  // ✅ Método applyQuestionFilter (igual ao reports)
  applyQuestionFilter(): void {
    if (!this.allQuestions.length) {
      this.filteredQuestions = [];
      this.dynamicColumns = [];
      return;
    }

    const includeOpen = !!this.includeOpenQuestions.value;

    this.filteredQuestions = this.allQuestions.filter(q => {
      if (!includeOpen) {
        // Exclui perguntas abertas
        return !['text', 'comment', 'file'].includes(q.type);
      }
      return true;
    });

    // ✅ Atualizar dynamicColumns com IDs filtrados
    this.dynamicColumns = this.filteredQuestions.map(q => q.id);

    console.log(`🔍 Filtro aplicado - Incluir abertas: ${includeOpen}`);
    console.log(`📊 Perguntas totais: ${this.allQuestions.length}`);
    console.log(`📊 Perguntas filtradas: ${this.filteredQuestions.length}`);
  }

  // ✅ Método onQuestionFilterChange (igual ao reports)
  onQuestionFilterChange(): void {
    this.applyQuestionFilter();

    // Forçar detecção de mudanças
    this.cdr.detectChanges();

    console.log('📊 Filtro alterado - Perguntas disponíveis:', this.dynamicColumns.length);
  }

  // Método antigo mantido para compatibilidade
  filterQuestions(): void {
    this.applyQuestionFilter();
  }

  getExcludedOpenQuestions(): number {
    return this.allQuestions.filter(q => ['text', 'comment', 'file'].includes(q.type)).length;
  }

  // ✅ Método para mostrar contador de questões disponíveis (igual ao reports)
  getAvailableQuestionCount(): string {
    const total = this.allQuestions.length;
    const filtered = this.filteredQuestions.length;
    const includeOpen = this.includeOpenQuestions.value;

    if (includeOpen) {
      return `${filtered} questões disponíveis (todas)`;
    } else {
      const excluded = total - filtered;
      return `${filtered} questões disponíveis (${excluded} abertas excluídas)`;
    }
  }

  atualizarPerguntasBloqueadas(): void {
    this.perguntasBloqueadas.clear();
    const idCompetenciaEditando = this.competenciaEditando?.id;

    this.groupCompetencies.forEach(c => {
      if (c.id !== idCompetenciaEditando) {
        c.perguntasIds.forEach(pId => this.perguntasBloqueadas.add(pId));
      }
    });
  }

  isQuestionBlocked(questionId: string): boolean {
    return this.perguntasBloqueadas.has(questionId);
  }

  // ✅ Método salvarCompetencia atualizado (igual ao reports)
  salvarCompetencia(): void {
    if (this.competenciaForm.invalid) {
      this.snackBar.open(this.translate.instant('Preencha todos os campos obrigatórios'), this.translate.instant('Fechar'), { duration: 3000 });
      return;
    }

    const formValue = this.competenciaForm.value;
    const idCompetenciaEditando = this.competenciaEditando.id;

    if (idCompetenciaEditando) {
      // Editando competência existente
      const idx = this.groupCompetencies.findIndex(c => c.id === idCompetenciaEditando);
      if (idx > -1) {
        // ✅ Merge com valores do form
        this.groupCompetencies[idx] = { ...this.competenciaEditando, ...formValue };
      }
      this.snackBar.open(this.translate.instant('Competência atualizada com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
    } else {
      // Adicionando nova competência
      const nova: Competencia = {
        id: `comp_${new Date().getTime()}`,
        ...formValue
      };
      this.groupCompetencies.push(nova);
      this.snackBar.open(this.translate.instant('Competência adicionada com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
    }

    this.cancelarEdicaoCompetencia();
    this.atualizarPerguntasBloqueadas();
  }

  // ✅ Método editarCompetencia atualizado (igual ao reports)
  editarCompetencia(c: Competencia): void {
    this.competenciaEditando = { ...c };
    // ✅ Sincronizar com o FormGroup
    this.competenciaForm.setValue({
      nome: c.nome,
      descricao: c.descricao,
      perguntasIds: c.perguntasIds
    });
    this.atualizarPerguntasBloqueadas();
  }

  // ✅ Método cancelarEdicaoCompetencia atualizado (igual ao reports)
  cancelarEdicaoCompetencia(): void {
    this.competenciaEditando = { id: '', nome: '', descricao: '', perguntasIds: [] };
    // ✅ Resetar o FormGroup
    this.competenciaForm.reset({ nome: '', descricao: '', perguntasIds: [] });
    this.atualizarPerguntasBloqueadas();
  }

  removerCompetencia(index: number): void {
    if (index >= 0 && index < this.groupCompetencies.length) {
      this.groupCompetencies.splice(index, 1);
      this.atualizarPerguntasBloqueadas();
    }
  }

  isValidCompetenciaForm(): boolean {
    return !!(this.competenciaEditando.nome &&
              this.competenciaEditando.descricao &&
              this.competenciaEditando.perguntasIds &&
              this.competenciaEditando.perguntasIds.length > 0);
  }

  // ✅ Salvar grupo (igual ao salvarRelatorioNoFirebase do /reports)
  async saveCompetencyGroup(): Promise<void> {
    if (!this.groupName || this.groupCompetencies.length === 0) {
      this.snackBar.open(this.translate.instant('Digite um nome para o grupo de competências.'), this.translate.instant('Fechar'), { duration: 3000 });
      return;
    }

    try {
      // Salva o grupo com as competências temporárias (igual ao /reports)
      const groupData = {
        name: this.groupName,
        clientId: this.selectedClientId,
        competencias: this.groupCompetencies, // Array de competências temporárias
        createdAt: new Date()
      };

      await addDoc(collection(this.firestore, 'competencyGroups'), groupData);

      this.snackBar.open(this.translate.instant('Grupo salvo com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
      this.groupName = '';
      this.groupCompetencies = []; // Limpa após salvar
      await this.loadCompetencyGroups();
    } catch (error) {
      console.error('Erro ao salvar grupo de competências:', error);
      this.snackBar.open(this.translate.instant('Erro ao salvar grupo de competências.'), this.translate.instant('Fechar'), { duration: 3000 });
    }
  }

  // ✅ Carregar grupo existente (igual ao carregar relatório no /reports)
  async loadCompetencyGroup(): Promise<void> {
    if (!this.selectedGroupId) return;

    try {
      const groupDoc = await getDoc(doc(this.firestore, 'competencyGroups', this.selectedGroupId));

      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        // Carrega as competências do grupo para edição
        this.groupCompetencies = groupData['competencias'] || [];
        this.groupName = groupData['name'] || '';
        this.atualizarPerguntasBloqueadas();
        this.snackBar.open(this.translate.instant('Grupo carregado com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
      }
    } catch (error) {
      console.error('Erro ao carregar grupo:', error);
      this.snackBar.open(this.translate.instant('Erro ao carregar grupo de competências.'), this.translate.instant('Fechar'), { duration: 3000 });
    }
  }

  getClientName(): string {
    const client = this.clients.find(c => c.id === this.selectedClientId);
    return client ? client.companyName : 'Nenhum cliente selecionado';
  }

  getQuestionTypesCount(comp: Competencia): number {
    const questionIds = comp.perguntasIds || [];
    const types = new Set();
    questionIds.forEach(id => {
      const question = this.allQuestions.find(q => q.id === id);
      if (question) {
        types.add(question.type);
      }
    });
    return types.size;
  }

  debugPerguntas(): void {
    console.log('=== DEBUG PERGUNTAS ===');
    console.log('Todas as perguntas:', this.allQuestions);
    console.log('Perguntas filtradas:', this.filteredQuestions);
    console.log('Perguntas bloqueadas:', Array.from(this.perguntasBloqueadas));
  }

  debugTipos(): void {
    console.log('=== DEBUG TIPOS ===');
    const tipos = new Map();
    this.allQuestions.forEach(q => {
      tipos.set(q.type, (tipos.get(q.type) || 0) + 1);
    });
    console.log('Contagem por tipo:', Object.fromEntries(tipos));
  }

  openCreateQuestionDialog(): void {
    if (!this.selectedClientId) {
      this.snackBar.open(this.translate.instant('Selecione um cliente primeiro.'), this.translate.instant('Fechar'), { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(CreateQuestionDialogComponent, {
      width: '600px',
      data: {
        clientId: this.selectedClientId
      }
    });

    dialogRef.afterClosed().subscribe(async (newQuestion) => {
      if (newQuestion) {
        // Recarrega as perguntas para incluir a nova
        await this.loadAllQuestions();
        this.snackBar.open('Pergunta criada e adicionada à lista!', 'Fechar', { duration: 3000 });
      }
    });
  }

  // ✅ Métodos removidos - não usa mais modo individual (igual ao /reports)
  // - openCompetencyDialog()
  // - deleteCompetency()
  // - isValidCompetency()
  // - getSafeQuestionsCount()
  // - getRequiredQuestionsCount()
  // - getLikertQuestionsCount()
  // - getMultipleChoiceQuestionsCount()
  // etc...
}

