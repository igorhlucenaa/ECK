import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { Firestore, collection, getDocs, getDoc, addDoc, doc, query, where } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../services/apps/authentication/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { CreateQuestionDialogComponent } from './create-question-dialog/create-question-dialog.component';
import { Subject, takeUntil } from 'rxjs';

// Interface igual ao reports
interface Competencia {
  id: string;
  nome: string;
  descricao: string;
  perguntasIds: string[];
}

interface AssessmentOption {
  id: string;
  name: string;
}

interface Client {
  id: string;
  companyName: string;
}

@Component({
  selector: 'app-competencies',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './competencies.component.html',
  styleUrls: ['./competencies.component.scss']
})
export class CompetenciesComponent implements OnInit, OnDestroy {
  // Estrutura igual ao reports
  competencias: Competencia[] = [];
  assessments: AssessmentOption[] = [];
  selectedAssessmentId: string | null = null;
  questionMap: { [key: string]: string } = {};
  dynamicColumns: string[] = [];
  filteredQuestions: { id: string; title: string; type: string }[] = [];
  allQuestions: { id: string; title: string; type: string }[] = [];

  // Controles de formulário
  assessmentControl = new FormControl('');
  competenciaForm!: FormGroup;
  competenciaEditando: Competencia = { id: '', nome: '', descricao: '', perguntasIds: [] };

  // Grupos de competências
  competencyGroups: any[] = [];
  competencyGroupControl = new FormControl('');
  groupNameControl = new FormControl('');

  // Clientes
  clients: Client[] = [];
  selectedClientId: string | null = null;
  clientControl = new FormControl('');

  // Filtro de perguntas
  includeOpenQuestions = new FormControl(false);
  perguntasBloqueadas: Set<string> = new Set();

  // Perguntas custom (para compatibilidade com grupos antigos)
  customQuestions: { id: string; title: string; type: string }[] = [];

  // Controles de UI
  userRole: string = '';
  userClientId: string = '';
  isLoading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private firestore: Firestore,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) {
    // Formulário igual ao reports
    this.competenciaForm = this.fb.group({
      nome: ['', Validators.required],
      descricao: ['', Validators.required],
      perguntasIds: [[] as string[], Validators.required]
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadUserData();
    await this.loadClients();
    await this.loadAssessments();

    // Carregar grupos se cliente já estiver definido
    if (this.selectedClientId) {
      await this.loadCompetencyGroups(this.selectedClientId);
    }

    // Configurar listener para mudanças no filtro de perguntas
    this.includeOpenQuestions.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.onQuestionFilterChange();
      });

    // Listener para mudanças na avaliação
    this.assessmentControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(id => {
        this.selectedAssessmentId = id;
        if (id) {
          this.onAssessmentChange();
        } else {
          this.competencias = [];
          this.questionMap = {};
          this.dynamicColumns = [];
          this.customQuestions = [];
        }
        this.cdr.detectChanges();
      });

    // Listener para mudanças no cliente
    this.clientControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(clientId => {
        this.selectedClientId = clientId;
        if (clientId) {
          this.loadCompetencyGroups(clientId);
          // Limpar competências quando mudar de cliente
          this.competencias = [];
          this.customQuestions = [];
          this.cancelarEdicaoCompetencia();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadUserData(): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (currentUser) {
      this.userRole = currentUser.role;
      this.userClientId = currentUser.clientId || '';

      // Se for admin_client, define o cliente automaticamente
      if (this.userRole === 'admin_client' && this.userClientId) {
        this.selectedClientId = this.userClientId;
        this.clientControl.setValue(this.userClientId);
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
        // Para admin_client, carrega apenas seu próprio cliente
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

  async loadAssessments(): Promise<void> {
    try {
      const assessmentsSnap = await getDocs(collection(this.firestore, 'assessments'));
      this.assessments = assessmentsSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data()['name'] || doc.id
      }));
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      this.snackBar.open('Erro ao carregar avaliações', 'Fechar', { duration: 3000 });
    }
  }

  async onAssessmentChange(): Promise<void> {
    if (!this.selectedAssessmentId) {
      this.questionMap = {};
      this.dynamicColumns = [];
      this.allQuestions = [];
      this.filteredQuestions = [];
      return;
    }

    try {
      this.isLoading = true;
      const assessmentRef = doc(this.firestore, 'assessments', this.selectedAssessmentId);
      const assessmentSnap = await getDoc(assessmentRef);

      if (!assessmentSnap.exists()) {
        this.isLoading = false;
        return;
      }

      const assessmentData = assessmentSnap.data();
      const surveyJSON = assessmentData['surveyJSON'];

      if (!surveyJSON || !surveyJSON.pages) {
        this.isLoading = false;
        return;
      }

      // Extrair questões do surveyJSON (igual ao reports)
      const questions: { id: string; title: string; type: string }[] = [];

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
              questions.push({ id: el.name, title: questionTitle, type: el.type || 'text' });
            }
          });
        }
      });

      // As perguntas custom agora são parte da avaliação, então não precisamos combiná-las
      this.allQuestions = questions;

      // Construir questionMap e dynamicColumns
      this.questionMap = {};
      questions.forEach((q: { id: string; title: string; type: string }) => {
        this.questionMap[q.id] = q.title;
      });

      this.dynamicColumns = questions.map((q: { id: string; title: string; type: string }) => q.id);
      this.onQuestionFilterChange();

    } catch (error) {
      console.error('Erro ao carregar avaliação:', error);
      this.snackBar.open('Erro ao carregar avaliação', 'Fechar', { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

  onQuestionFilterChange(): void {
    const includeOpen = this.includeOpenQuestions.value;

    // Tipos considerados "abertos"
    const openTypes = ['comment', 'text', 'file', 'fileupload'];

    this.filteredQuestions = this.allQuestions.filter(q => {
      if (includeOpen) {
        return true; // Mostra todas
      }
      return !openTypes.includes(q.type);
    });

    // Atualizar dynamicColumns baseado no filtro
    this.dynamicColumns = this.filteredQuestions.map(q => q.id);
  }

  salvarCompetencia(): void {
    if (this.competenciaForm.invalid) {
      this.snackBar.open(this.t('Preencha todos os campos obrigatórios.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    // Pegar valores diretamente do FormControl para garantir que está atualizado
    const nome = this.competenciaForm.get('nome')?.value || '';
    const descricao = this.competenciaForm.get('descricao')?.value || '';
    const perguntasIdsControl = this.competenciaForm.get('perguntasIds');
    const perguntasIdsVinculadas = Array.isArray(perguntasIdsControl?.value)
      ? [...perguntasIdsControl.value]
      : [];

    // Validar se há perguntas selecionadas
    if (perguntasIdsVinculadas.length === 0) {
      this.snackBar.open(this.t('Selecione pelo menos uma pergunta para a competência.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    // Verificar se todas as perguntas custom vinculadas estão na lista
    perguntasIdsVinculadas.forEach((perguntaId: string) => {
      if (perguntaId.startsWith('custom_')) {
        const existe = this.customQuestions.some(q => q.id === perguntaId);
        if (!existe) {
          // Tentar encontrar em allQuestions
          const pergunta = this.allQuestions.find(q => q.id === perguntaId);
          if (pergunta && pergunta.id.startsWith('custom_')) {
            // Adicionar à lista de customQuestions se não estiver
            this.customQuestions.push(pergunta);
            console.log('Pergunta custom recuperada de allQuestions:', pergunta);
          } else {
            console.warn('Pergunta custom não encontrada:', perguntaId);
          }
        }
      }
    });

    const idCompetenciaEditando = this.competenciaEditando.id;

    if (idCompetenciaEditando) {
      // Editando competência existente
      const idx = this.competencias.findIndex(c => c.id === idCompetenciaEditando);
      if (idx > -1) {
        // Atualizar a competência com os novos dados
        const competenciaAtualizada: Competencia = {
          id: this.competenciaEditando.id,
          nome: nome.trim(),
          descricao: descricao.trim(),
          perguntasIds: perguntasIdsVinculadas // Array já é uma cópia
        };

        this.competencias[idx] = competenciaAtualizada;

        console.log('✅ Competência atualizada:', competenciaAtualizada);
        console.log('✅ Total de perguntas vinculadas:', perguntasIdsVinculadas.length);
        console.log('✅ Perguntas custom disponíveis:', this.customQuestions.length);
      } else {
        this.snackBar.open(this.t('Erro: Competência não encontrada para edição.'), this.t('Fechar'), { duration: 3000 });
        return;
      }
      this.snackBar.open(this.t('Competência atualizada com sucesso!'), this.t('Fechar'), { duration: 3000 });
    } else {
      // Adicionando nova competência
      const nova: Competencia = {
        id: `comp_${new Date().getTime()}`,
        nome: nome.trim(),
        descricao: descricao.trim(),
        perguntasIds: perguntasIdsVinculadas
      };
      this.competencias.push(nova);
      this.snackBar.open(this.t('Competência adicionada com sucesso!'), this.t('Fechar'), { duration: 3000 });
    }

    this.cancelarEdicaoCompetencia();
    this.atualizarPerguntasBloqueadas();

    // Forçar atualização da view
    this.cdr.detectChanges();
  }

  editarCompetencia(c: Competencia): void {
    this.competenciaEditando = { ...c };

    // Garantir que perguntasIds é um array válido
    const perguntasIds = Array.isArray(c.perguntasIds) ? [...c.perguntasIds] : [];

    this.competenciaForm.setValue({
      nome: c.nome || '',
      descricao: c.descricao || '',
      perguntasIds: perguntasIds
    });

    // Forçar atualização da view
    this.cdr.detectChanges();
    this.atualizarPerguntasBloqueadas();
  }

  removerCompetencia(c: Competencia): void {
    const idx = this.competencias.findIndex(comp => comp.id === c.id);
    if (idx > -1) {
      this.competencias.splice(idx, 1);
      this.snackBar.open(this.t('Competência removida!'), this.t('Fechar'), { duration: 3000 });
      this.atualizarPerguntasBloqueadas();
    }
  }

  cancelarEdicaoCompetencia(): void {
    this.competenciaEditando = { id: '', nome: '', descricao: '', perguntasIds: [] };
    this.competenciaForm.reset({ nome: '', descricao: '', perguntasIds: [] });
    this.atualizarPerguntasBloqueadas();
  }

  private atualizarPerguntasBloqueadas(): void {
    this.perguntasBloqueadas.clear();
    const idCompetenciaEditando = this.competenciaEditando?.id;

    this.competencias.forEach(c => {
      // Se não estamos editando esta competência, suas perguntas estão bloqueadas
      if (c.id !== idCompetenciaEditando) {
        c.perguntasIds.forEach(pId => this.perguntasBloqueadas.add(pId));
      }
    });
  }

  // Métodos de grupos de competências (igual ao reports)
  async loadCompetencyGroups(clientId: string): Promise<void> {
    try {
      const groupsCollection = collection(this.firestore, 'competencyGroups');
      const groupsSnapshot = await getDocs(
        query(groupsCollection, where('clientId', '==', clientId))
      );

      this.competencyGroups = groupsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Erro ao carregar grupos de competências:', error);
      this.snackBar.open(this.t('Erro ao carregar grupos de competências.'), this.t('Fechar'), {
        duration: 3000,
      });
    }
  }

  async saveCompetencyGroup(): Promise<void> {
    if (!this.selectedClientId) {
      this.snackBar.open(this.t('Selecione um cliente primeiro.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    if (!this.groupNameControl.value) {
      this.snackBar.open(this.t('Digite um nome para o grupo de competências.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    if (this.competencias.length === 0) {
      this.snackBar.open(this.t('Adicione pelo menos uma competência antes de salvar o grupo.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    if (!this.selectedAssessmentId) {
      this.snackBar.open(this.t('Selecione uma avaliação antes de salvar o grupo.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    try {
      const groupData: any = {
        name: this.groupNameControl.value,
        clientId: this.selectedClientId,
        competencias: this.competencias,
        createdAt: new Date(),
        assessmentId: this.selectedAssessmentId
      };

      // Salvar perguntas custom se houver
      if (this.customQuestions.length > 0) {
        groupData.customQuestions = this.customQuestions;
      }

      await addDoc(collection(this.firestore, 'competencyGroups'), groupData);

      this.snackBar.open(this.t('Grupo salvo com sucesso!'), this.t('Fechar'), { duration: 3000 });
      this.groupNameControl.reset();

      // Limpar competências após salvar
      this.competencias = [];
      this.customQuestions = [];
      this.cancelarEdicaoCompetencia();

      // Atualizar lista de grupos
      await this.loadCompetencyGroups(this.selectedClientId);

    } catch (error) {
      console.error('Erro ao salvar grupo de competências:', error);
      this.snackBar.open(this.t('Erro ao salvar grupo de competências.'), this.t('Fechar'), { duration: 3000 });
    }
  }

  async loadCompetencyGroup(): Promise<void> {
    const selectedGroupId = this.competencyGroupControl.value;
    if (!selectedGroupId) return;

    try {
      const groupDoc = await getDoc(doc(this.firestore, 'competencyGroups', selectedGroupId));

      if (groupDoc.exists()) {
        const groupData = groupDoc.data();

        // Carregar competências do grupo
        this.competencias = groupData['competencias'] || [];

        // Se o grupo tem assessmentId associado, selecionar a avaliação
        if (groupData['assessmentId']) {
          this.selectedAssessmentId = groupData['assessmentId'];
          this.assessmentControl.setValue(groupData['assessmentId']);

          // Carregar perguntas custom ANTES de carregar a avaliação
          if (groupData['customQuestions'] && Array.isArray(groupData['customQuestions'])) {
            this.customQuestions = groupData['customQuestions'];
          } else {
            this.customQuestions = [];
          }

          await this.onAssessmentChange();
        } else {
          // Se não tem assessmentId, apenas carregar perguntas custom
          if (groupData['customQuestions'] && Array.isArray(groupData['customQuestions'])) {
            this.customQuestions = groupData['customQuestions'];
          } else {
            this.customQuestions = [];
          }
        }

        this.snackBar.open(this.t('Grupo carregado com sucesso!'), this.t('Fechar'), { duration: 3000 });
        this.atualizarPerguntasBloqueadas();
        this.cdr.detectChanges();

      } else {
        this.snackBar.open(this.t('Grupo não encontrado.'), this.t('Fechar'), { duration: 3000 });
      }

    } catch (error) {
      console.error('Erro ao carregar grupo de competências:', error);
      this.snackBar.open(this.t('Erro ao carregar grupo de competências.'), this.t('Fechar'), { duration: 3000 });
    }
  }

  // Métodos auxiliares
  private t(key: string): string {
    return this.translate ? this.translate.instant(key) : key;
  }

  canEdit(): boolean {
    return this.userRole === 'admin_master' || this.userRole === 'admin_client';
  }

  getClientName(): string {
    const client = this.clients.find(c => c.id === this.selectedClientId);
    return client ? client.companyName : '';
  }

  getCompetenciaText(): string {
    const count = this.competencias.length;
    return `${count} competência${count !== 1 ? 's' : ''} ativa${count !== 1 ? 's' : ''}`;
  }

  getGrupoText(): string {
    const count = this.competencyGroups.length;
    return `${count} grupo${count !== 1 ? 's' : ''} salvo${count !== 1 ? 's' : ''}`;
  }

  getQuestaoText(count: number): string {
    return `${count} questão${count !== 1 ? 'ões' : ''}`;
  }

  getAvailableQuestionCount(): string {
    const total = this.allQuestions.length;
    const filtered = this.filteredQuestions.length;
    const openExcluded = total - filtered;
    return `${filtered} questões disponíveis${openExcluded > 0 ? ` (${openExcluded} questões abertas excluídas)` : ''}`;
  }

  getQuestionTypeByIdSafe(questionId: string): string {
    const question = this.allQuestions.find(q => q.id === questionId);
    if (!question) return 'Desconhecido';

    const typeMap: { [key: string]: string } = {
      'text': 'Texto',
      'comment': 'Comentário',
      'rating': 'Avaliação',
      'dropdown': 'Dropdown',
      'radiogroup': 'Múltipla Escolha',
      'checkbox': 'Checkbox',
      'boolean': 'Sim/Não',
      'matrix': 'Matriz',
      'matrix_row': 'Matriz (Linha)',
      'file': 'Arquivo'
    };

    return typeMap[question.type] || question.type;
  }

  trackByCompetencia(index: number, item: Competencia): string {
    return item.id;
  }

  // Métodos para gerenciar perguntas custom
  openCreateQuestionDialog(): void {
    if (!this.selectedAssessmentId) {
      this.snackBar.open(this.t('Selecione uma avaliação primeiro.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(CreateQuestionDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: {
        assessmentId: this.selectedAssessmentId,
        clientId: this.selectedClientId
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        // Recarregar as perguntas da avaliação para incluir a nova pergunta
        await this.onAssessmentChange();

        this.snackBar.open(this.t('Pergunta criada e adicionada à avaliação!'), this.t('Fechar'), { duration: 3000 });

        // Forçar atualização da view
        this.cdr.detectChanges();
      }
    });
  }

  removerPerguntaCustom(perguntaId: string): void {
    const index = this.customQuestions.findIndex(q => q.id === perguntaId);
    if (index > -1) {
      // Verificar se a pergunta está sendo usada em alguma competência
      const estaEmUso = this.competencias.some(c => c.perguntasIds.includes(perguntaId));
      if (estaEmUso) {
        this.snackBar.open(this.t('Não é possível remover uma pergunta que está sendo usada em uma competência.'), this.t('Fechar'), { duration: 3000 });
        return;
      }

      this.customQuestions.splice(index, 1);

      // Remover das listas
      const allIndex = this.allQuestions.findIndex(q => q.id === perguntaId);
      if (allIndex > -1) {
        this.allQuestions.splice(allIndex, 1);
      }

      delete this.questionMap[perguntaId];
      this.dynamicColumns = this.dynamicColumns.filter(id => id !== perguntaId);

      // Atualizar filtro
      this.onQuestionFilterChange();

      this.snackBar.open(this.t('Pergunta removida!'), this.t('Fechar'), { duration: 3000 });
    }
  }

  getQuestionTypeLabel(type: string): string {
    const typeMap: { [key: string]: string } = {
      'rating': 'Escala (1-5)',
      'text': 'Texto',
      'comment': 'Comentário',
      'dropdown': 'Dropdown',
      'radiogroup': 'Múltipla Escolha',
      'checkbox': 'Checkbox',
      'boolean': 'Sim/Não',
      'matrix': 'Matriz'
    };
    return typeMap[type] || type;
  }
}

