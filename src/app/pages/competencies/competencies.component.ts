import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { Firestore, collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, where } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../services/apps/authentication/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { CreateQuestionDialogComponent } from './create-question-dialog/create-question-dialog.component';
import { Subject, takeUntil } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';
import { ConfirmDialogService } from 'src/app/shared/confirm-dialog/confirm-dialog.service';
import { CompetencyQuestionsService } from '../../services/competency-questions.service';

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
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, TranslateModule, AppPageHeaderComponent],
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
  currentGroupId: string | null = null; // ID do grupo sendo editado

  // Clientes
  clients: Client[] = [];
  filteredClients: Client[] = [];
  clientSearchControl = new FormControl('');
  selectedClientId: string | null = null;
  clientControl = new FormControl('');

  // Filtro de perguntas
  includeOpenQuestions = new FormControl(false);
  perguntasBloqueadas: Set<string> = new Set();

  // Perguntas custom (para compatibilidade com grupos antigos)
  customQuestions: { id: string; title: string; type: string }[] = [];

  // Perguntas custom por competência (quando não há avaliação)
  customQuestionsByCompetency: { [competencyId: string]: { id: string; title: string; type: string }[] } = {};

  // Cache para perguntas custom da competência sendo editada (para evitar recálculos)
  perguntasCustomCache: { id: string; title: string; type: string }[] = [];


  // Controles de UI
  userRole: string = '';
  userClientId: string = '';
  userClientIds: string[] = [];
  isLoading = false;

  // Estado do painel de edição
  isEditorOpen = false;
  isGroupEditorOpen = false;
  showCompForm = false;
  hasUnsavedChanges = false;

  private destroy$ = new Subject<void>();

  constructor(
    private firestore: Firestore,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private confirmDialog: ConfirmDialogService,
    private competencyQuestionsService: CompetencyQuestionsService
  ) {
    // Formulário igual ao reports (perguntasIds não é obrigatório quando não há avaliação)
    this.competenciaForm = this.fb.group({
      nome: ['', Validators.required],
      descricao: ['', Validators.required],
      perguntasIds: [[] as string[]] // Não obrigatório para permitir modo sem avaliação
    });

    // Inicializar perguntas custom por competência
    this.customQuestionsByCompetency = {};
  }

  async ngOnInit(): Promise<void> {
    await this.loadUserData();
    await this.loadClients();
    await this.loadAssessments();

    this.filteredClients = [...this.clients];
    this.clientSearchControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(search => {
        const s = (search || '').toLowerCase();
        this.filteredClients = this.clients.filter(c =>
          c.companyName.toLowerCase().includes(s)
        );
      });

    // Carregar grupos se cliente já estiver definido
    if (this.selectedClientId) {
      await this.loadCompetencyGroups(this.selectedClientId);
    }

    // Pré-selecionar avaliação se vier via query param (ex: redirecionado do Reports)
    const assessmentIdParam = this.route.snapshot.queryParamMap.get('assessmentId');
    if (assessmentIdParam && this.assessments.some(a => a.id === assessmentIdParam)) {
      this.assessmentControl.setValue(assessmentIdParam);
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
        // Usar setTimeout para evitar loops infinitos
        setTimeout(() => {
          this.cdr.detectChanges();
        }, 0);
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
          // Limpar grupo editado ao mudar de cliente
          this.currentGroupId = null;
          this.groupNameControl.reset();
        }
      });

    // Listener para mudanças no grupo selecionado
    this.competencyGroupControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(groupId => {
        // Se o grupo foi limpo (valor vazio), limpar estado de edição
        if (!groupId) {
          this.currentGroupId = null;
          this.groupNameControl.reset();
          this.competencias = [];
          this.customQuestions = [];
          this.customQuestionsByCompetency = {};
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
      this.userClientIds = await this.authService.getCurrentUserClientIds();
      this.userClientId = this.userClientIds[0] || '';

      // Se for admin_client, define o primeiro cliente automaticamente
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
      } else if (this.userRole === 'admin_client' && this.userClientIds.length > 0) {
        // Para admin_client, carrega apenas os clientes vinculados
        const docs = await Promise.all(
          this.userClientIds.map(id => getDoc(doc(this.firestore, 'clients', id)))
        );
        this.clients = docs
          .filter(d => d.exists())
          .map(d => ({ id: d.id, companyName: d.data()!['companyName'] || 'Cliente sem nome' }));
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
    const assessmentId = this.assessmentControl.value;
    this.selectedAssessmentId = assessmentId || null;

    // Se não há avaliação selecionada, limpar perguntas da avaliação mas manter perguntas custom
    if (!this.selectedAssessmentId) {
      this.allQuestions = [];
      this.filteredQuestions = [];
      this.questionMap = {};
      this.dynamicColumns = [];
      // Usar setTimeout para evitar loops infinitos
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 0);
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
    this.hasUnsavedChanges = true;
    // Validar cliente primeiro (obrigatório quando não há avaliação)
    if (!this.selectedAssessmentId && !this.selectedClientId) {
      this.snackBar.open(this.t('Selecione um cliente antes de criar competências.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    // Validar apenas nome e descrição (perguntasIds é opcional quando não há avaliação)
    const nome = this.competenciaForm.get('nome')?.value || '';
    const descricao = this.competenciaForm.get('descricao')?.value || '';

    // Se está editando, usar o nome do formulário OU o nome existente da competência
    // Priorizar sempre o valor do formulário se estiver preenchido
    let nomeFinal = nome.trim();
    let descricaoFinal = descricao.trim();

    // Se está editando e o campo está vazio, usar o valor existente
    if (this.competenciaEditando.id) {
      if (!nomeFinal) {
        nomeFinal = this.competenciaEditando.nome || '';
      }
      if (!descricaoFinal) {
        descricaoFinal = this.competenciaEditando.descricao || '';
      }
    }

    // Validação final
    if (!nomeFinal || !descricaoFinal) {
      this.snackBar.open(this.t('Preencha nome e descrição da competência.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    console.log('💾 SALVANDO COMPETÊNCIA:');
    console.log('  - ID:', this.competenciaEditando.id || 'NOVO');
    console.log('  - Nome final:', nomeFinal);
    console.log('  - Descrição final:', descricaoFinal);

    // Pegar valores diretamente do FormControl para garantir que está atualizado
    const perguntasIdsControl = this.competenciaForm.get('perguntasIds');
    const perguntasIdsVinculadas = Array.isArray(perguntasIdsControl?.value)
      ? [...perguntasIdsControl.value]
      : [];

    console.log('🔍 DEBUG DROPDOWN: Perguntas selecionadas do dropdown "Questões vinculadas":');
    console.log(`  - Total de perguntas selecionadas: ${perguntasIdsVinculadas.length}`);
    perguntasIdsVinculadas.forEach((id, idx) => {
      const isCustom = id.startsWith('custom_');
      const titulo = isCustom
        ? (this.questionMap[id] || 'NÃO ENCONTRADO NO questionMap')
        : (this.questionMap[id] || 'NÃO ENCONTRADO NO questionMap');
      console.log(`  ${idx + 1}. ID: ${id}`);
      console.log(`     - É custom: ${isCustom}`);
      console.log(`     - Título no questionMap: "${titulo}"`);

      // Se é custom, tentar encontrar em customQuestionsByCompetency
      if (isCustom) {
        const todasPerguntasCustom = Object.values(this.customQuestionsByCompetency).flat();
        const perguntaCustom = todasPerguntasCustom.find(q => q.id === id);
        if (perguntaCustom) {
          console.log(`     - ✅ Encontrada em customQuestionsByCompetency: "${perguntaCustom.title}"`);
        } else {
          console.log(`     - ⚠️ NÃO encontrada em customQuestionsByCompetency`);
        }
      }
    });

    // Se não há avaliação selecionada, usar perguntas custom da competência
    let perguntasIdsFinais = perguntasIdsVinculadas;

    if (!this.selectedAssessmentId) {
      // Modo sem avaliação: usar perguntas custom da competência
      const idCompetenciaEditando = this.competenciaEditando.id;

      // Buscar perguntas custom - pode ser ID temporário ou permanente
      // Usar o método getPerguntasCustomCompetencia que já tem lógica robusta para encontrar perguntas
      let perguntasCustom: { id: string; title: string; type: string }[] = [];

      if (idCompetenciaEditando) {
        // Usar o método auxiliar que já tem lógica para encontrar perguntas
        perguntasCustom = this.getPerguntasCustomCompetencia(idCompetenciaEditando);
      } else {
        // Apenas chaves temporárias da sessão atual — evita pegar perguntas de outras competências
        const tempKeys = Object.keys(this.customQuestionsByCompetency).filter(k =>
          k.startsWith('comp_temp_')
        );
        if (tempKeys.length > 0) {
          perguntasCustom = this.customQuestionsByCompetency[tempKeys[0]] || [];
        }
      }

      // Modo sem avaliação: usar perguntas custom da competência (se houver)
      perguntasIdsFinais = perguntasCustom.map(q => q.id);
    } else {
      // Modo com avaliação: validar se há perguntas selecionadas OU perguntas custom
      const idCompetenciaEditando = this.competenciaEditando.id;
      let perguntasCustom: { id: string; title: string; type: string }[] = [];

      // Se está editando, buscar perguntas custom adicionais
      if (idCompetenciaEditando) {
        perguntasCustom = this.getPerguntasCustomCompetencia(idCompetenciaEditando);
      }

      console.log('🔍 DEBUG MODO COM AVALIAÇÃO:');
      console.log(`  - Perguntas custom encontradas: ${perguntasCustom.length}`);
      perguntasCustom.forEach((p, idx) => {
        console.log(`    ${idx + 1}. ID: ${p.id}, Título: "${p.title}"`);
      });

      // IMPORTANTE: Se há perguntas custom selecionadas no dropdown, precisamos capturar seus títulos
      // e adicioná-las ao customQuestionsByCompetency antes de salvar
      const perguntasCustomSelecionadas = perguntasIdsVinculadas.filter(id => id.startsWith('custom_'));
      if (perguntasCustomSelecionadas.length > 0) {
        console.log(`🔍 DEBUG: Encontradas ${perguntasCustomSelecionadas.length} perguntas CUSTOM selecionadas no dropdown:`);

        // Determinar onde salvar (ID temporário ou permanente)
        let idParaSalvar = idCompetenciaEditando;
        if (!idParaSalvar) {
          // Se não há ID, criar ou usar um ID temporário
          const tempKeys = Object.keys(this.customQuestionsByCompetency).filter(k =>
            k.startsWith('comp_temp_') || k.startsWith('comp_')
          );
          if (tempKeys.length > 0) {
            idParaSalvar = tempKeys[0];
            console.log(`  - Usando ID temporário existente: ${idParaSalvar}`);
          } else {
            const nomeCompetencia = this.competenciaForm.get('nome')?.value || 'temp';
            idParaSalvar = `comp_temp_${nomeCompetencia.replace(/\s+/g, '_')}_${Date.now()}`;
            console.log(`  - Criado novo ID temporário: ${idParaSalvar}`);
          }
        }

        // Buscar títulos dessas perguntas custom em todas as competências ou no questionMap
        perguntasCustomSelecionadas.forEach((id, idx) => {
          // Tentar encontrar em customQuestionsByCompetency de todas as competências
          const todasPerguntasCustom = Object.values(this.customQuestionsByCompetency).flat();
          const perguntaEncontrada = todasPerguntasCustom.find(q => q.id === id);

          if (perguntaEncontrada) {
            console.log(`  ${idx + 1}. ID: ${id} - ✅ Título encontrado: "${perguntaEncontrada.title}"`);
            // Garantir que esta pergunta está em customQuestionsByCompetency
            if (!this.customQuestionsByCompetency[idParaSalvar]) {
              this.customQuestionsByCompetency[idParaSalvar] = [];
            }
            const jaExiste = this.customQuestionsByCompetency[idParaSalvar].some(q => q.id === id);
            if (!jaExiste) {
              this.customQuestionsByCompetency[idParaSalvar].push({ ...perguntaEncontrada });
              console.log(`     - ✅ Adicionada ao customQuestionsByCompetency[${idParaSalvar}]`);
            }
          } else {
            // Tentar encontrar título no questionMap (pode ser uma pergunta custom de outra competência)
            const tituloNoMap = this.questionMap[id];
            if (tituloNoMap && tituloNoMap !== id) {
              console.log(`  ${idx + 1}. ID: ${id} - ✅ Título encontrado no questionMap: "${tituloNoMap}"`);
              // Adicionar ao customQuestionsByCompetency
              if (!this.customQuestionsByCompetency[idParaSalvar]) {
                this.customQuestionsByCompetency[idParaSalvar] = [];
              }
              const jaExiste = this.customQuestionsByCompetency[idParaSalvar].some(q => q.id === id);
              if (!jaExiste) {
                this.customQuestionsByCompetency[idParaSalvar].push({
                  id: id,
                  title: tituloNoMap,
                  type: 'rating'
                });
                console.log(`     - ✅ Adicionada ao customQuestionsByCompetency[${idParaSalvar}] com título do questionMap`);
              }
            } else {
              console.log(`  ${idx + 1}. ID: ${id} - ⚠️ Título NÃO encontrado (será criado título padrão ao salvar)`);
            }
          }
        });

        // Atualizar perguntasCustom após adicionar as selecionadas
        if (idParaSalvar) {
          perguntasCustom = this.getPerguntasCustomCompetencia(idParaSalvar);
          console.log(`  - Total de perguntas custom após adicionar selecionadas: ${perguntasCustom.length}`);
        }
      }

      // IMPORTANTE: Quando há avaliação selecionada, usar APENAS as perguntas selecionadas no dropdown
      // O dropdown já inclui todas as perguntas (da avaliação e custom) que o usuário selecionou
      // Não devemos adicionar perguntas custom que não foram selecionadas pelo usuário
      perguntasIdsFinais = perguntasIdsVinculadas;

      console.log('🔍 DEBUG: Perguntas finais (apenas do dropdown):');
      console.log(`  - Total: ${perguntasIdsFinais.length}`);
      console.log(`  - IDs:`, perguntasIdsFinais);
      console.log(`  - Perguntas custom no dropdown: ${perguntasIdsFinais.filter(id => id.startsWith('custom_')).length}`);

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
    }

    const idCompetenciaEditando = this.competenciaEditando.id;
    const idx = idCompetenciaEditando ? this.competencias.findIndex(c => c.id === idCompetenciaEditando) : -1;
    const isEditandoExistente = idx > -1;

    if (isEditandoExistente) {
      // Editando competência existente
      // Atualizar a competência com os novos dados
      const competenciaAtualizada: Competencia = {
        id: this.competenciaEditando.id,
        nome: nomeFinal,
        descricao: descricaoFinal,
        perguntasIds: perguntasIdsFinais
      };

      this.competencias[idx] = competenciaAtualizada;

      // Garantir que as perguntas custom estão migradas para o ID permanente (com ou sem avaliação)
      const perguntasCustom = this.customQuestionsByCompetency[idCompetenciaEditando] || [];

      if (perguntasCustom.length === 0) {
        // Se não há perguntas custom no ID, tentar migrar de qualquer ID temporário
        const tempKeys = Object.keys(this.customQuestionsByCompetency).filter(k =>
          k.startsWith('comp_temp_') || (k.startsWith('comp_') && k !== idCompetenciaEditando)
        );
        if (tempKeys.length > 0) {
          const perguntasTemp = this.customQuestionsByCompetency[tempKeys[0]] || [];
          if (perguntasTemp.length > 0) {
            this.customQuestionsByCompetency[idCompetenciaEditando] = [...perguntasTemp];
            // Limpar chave temporária
            delete this.customQuestionsByCompetency[tempKeys[0]];
          }
        }
      } else {
        // Garantir que as perguntas custom estão no ID permanente
        this.customQuestionsByCompetency[idCompetenciaEditando] = perguntasCustom;
      }

      console.log('✅ Competência atualizada no array:');
      console.log('  - Índice:', idx);
      console.log('  - ID:', competenciaAtualizada.id);
      console.log('  - Nome:', competenciaAtualizada.nome);
      console.log('  - Descrição:', competenciaAtualizada.descricao);
      console.log('  - Total de perguntas:', perguntasIdsFinais.length);
      console.log('  - Array completo após atualização:', this.competencias.map(c => ({ id: c.id, nome: c.nome })));
      this.snackBar.open(this.t('Competência atualizada com sucesso!'), this.t('Fechar'), { duration: 3000 });
    } else {
      // Adicionando nova competência (ou editando uma que ainda não foi salva)
      const novaId = `comp_${new Date().getTime()}`;

      // IMPORTANTE: Migrar perguntas custom temporárias para o novo ID permanente
      // Isso deve acontecer SEMPRE, com ou sem avaliação, para garantir que as perguntas custom
      // adicionadas durante a edição sejam preservadas
      let perguntasTemp: { id: string; title: string; type: string }[] = [];
      let tempKey = '';

      console.log(`🔍 DEBUG SALVAR COMPETÊNCIA: Buscando perguntas custom para migrar`);
      console.log(`  - idCompetenciaEditando: ${idCompetenciaEditando || 'VAZIO'}`);
      console.log(`  - Todas as chaves em customQuestionsByCompetency:`, Object.keys(this.customQuestionsByCompetency));
      console.log(`  - perguntasCustomCache:`, this.perguntasCustomCache.length, 'perguntas');

      // CRÍTICO: Se há perguntas no cache, usar elas (são as perguntas que o usuário acabou de editar)
      if (this.perguntasCustomCache && this.perguntasCustomCache.length > 0) {
        perguntasTemp = [...this.perguntasCustomCache];
        console.log(`✅ DEBUG SALVAR COMPETÊNCIA: Encontradas ${perguntasTemp.length} perguntas custom no CACHE`);
        console.log(`  - Perguntas no cache:`, perguntasTemp.map(p => ({ id: p.id, title: p.title })));

        // Tentar encontrar a chave onde essas perguntas estão salvas
        Object.keys(this.customQuestionsByCompetency).forEach(key => {
          const perguntasNaChave = this.customQuestionsByCompetency[key] || [];
          const idsNoCache = new Set(perguntasTemp.map(p => p.id));
          const idsNaChave = new Set(perguntasNaChave.map(p => p.id));

          // Se todas as perguntas do cache estão nesta chave, usar esta chave
          if (perguntasTemp.length > 0 && perguntasTemp.every(p => idsNaChave.has(p.id))) {
            tempKey = key;
            console.log(`  - Chave encontrada: ${tempKey}`);
          }
        });
      }

      // Se não encontrou no cache, tentar pelo ID temporário da competência sendo editada
      if (perguntasTemp.length === 0 && idCompetenciaEditando && this.customQuestionsByCompetency[idCompetenciaEditando]) {
        perguntasTemp = this.customQuestionsByCompetency[idCompetenciaEditando];
        tempKey = idCompetenciaEditando;
        console.log(`✅ DEBUG SALVAR COMPETÊNCIA: Encontradas ${perguntasTemp.length} perguntas custom no ID temporário ${idCompetenciaEditando}`);
      }

      // Se ainda não encontrou, procurar em todas as chaves temporárias
      if (perguntasTemp.length === 0) {
        const tempKeys = Object.keys(this.customQuestionsByCompetency).filter(k =>
          k.startsWith('comp_temp_') || (k.startsWith('comp_') && !this.competencias.some(c => c.id === k))
        );
        if (tempKeys.length > 0) {
          tempKey = tempKeys[0];
          perguntasTemp = this.customQuestionsByCompetency[tempKey] || [];
          console.log(`✅ DEBUG SALVAR COMPETÊNCIA: Encontradas ${perguntasTemp.length} perguntas custom em chave temporária ${tempKey}`);
        }
      }

      // Se encontrou perguntas custom temporárias, migrar para o novo ID permanente
      if (perguntasTemp.length > 0) {
        // Filtrar apenas perguntas custom que estão nos perguntasIdsFinais (para garantir consistência)
        const perguntasCustomFiltradas = perguntasTemp.filter(q => perguntasIdsFinais.includes(q.id));

        if (perguntasCustomFiltradas.length > 0) {
          // Migrar perguntas custom temporárias para o novo ID permanente
          this.customQuestionsByCompetency[novaId] = perguntasCustomFiltradas.map(q => {
            // Manter o mesmo ID da pergunta (não precisa alterar o ID da pergunta, apenas a chave)
            return { ...q };
          });

          console.log(`✅ DEBUG SALVAR COMPETÊNCIA: Migradas ${perguntasCustomFiltradas.length} perguntas custom para novo ID ${novaId}`);
          console.log(`  - Perguntas migradas:`, perguntasCustomFiltradas.map(p => ({ id: p.id, title: p.title })));

          // Limpar perguntas temporárias
          if (tempKey && tempKey !== novaId) {
            delete this.customQuestionsByCompetency[tempKey];
            console.log(`  - Chave temporária ${tempKey} removida`);
          }
        } else {
          console.warn(`⚠️ DEBUG SALVAR COMPETÊNCIA: Perguntas custom encontradas mas nenhuma está nos perguntasIdsFinais`);
          console.warn(`  - perguntasTemp:`, perguntasTemp.map(p => p.id));
          console.warn(`  - perguntasIdsFinais:`, perguntasIdsFinais);
        }
      } else {
        console.log(`⚠️ DEBUG SALVAR COMPETÊNCIA: Nenhuma pergunta custom temporária encontrada para migrar`);
        console.log(`  - Chaves disponíveis em customQuestionsByCompetency:`, Object.keys(this.customQuestionsByCompetency));
      }

      const nova: Competencia = {
        id: novaId,
        nome: nomeFinal,
        descricao: descricaoFinal,
        perguntasIds: perguntasIdsFinais
      };
      this.competencias.push(nova);

      // Garantir que as perguntas custom estão no novo ID (mesmo se não migrou acima)
      // Se há perguntas custom nos perguntasIds mas não em customQuestionsByCompetency, criar estrutura básica
      const perguntasCustomIds = perguntasIdsFinais.filter(id => id.startsWith('custom_'));
      if (perguntasCustomIds.length > 0 && !this.customQuestionsByCompetency[novaId]) {
        console.log(`⚠️ DEBUG SALVAR COMPETÊNCIA: Criando estrutura básica para ${perguntasCustomIds.length} perguntas custom`);
        // Tentar encontrar essas perguntas em outras competências
        const todasPerguntasCustom = Object.values(this.customQuestionsByCompetency).flat();
        this.customQuestionsByCompetency[novaId] = perguntasCustomIds.map((id, idx) => {
          const perguntaEncontrada = todasPerguntasCustom.find(p => p.id === id);
          return perguntaEncontrada || {
            id: id,
            title: `Pergunta Custom ${idx + 1}`,
            type: 'rating'
          };
        });
        console.log(`  - Perguntas criadas:`, this.customQuestionsByCompetency[novaId].map(p => ({ id: p.id, title: p.title })));
      }

      this.snackBar.open(this.t('Competência adicionada com sucesso!'), this.t('Fechar'), { duration: 3000 });
    }

    this.showCompForm = false;
    this.cancelarEdicaoCompetencia();
    this.atualizarPerguntasBloqueadas();

    // Salvar automaticamente no Firestore — sem necessidade de clicar "Salvar Grupo"
    setTimeout(() => {
      this.saveCompetencyGroup();
      this.cdr.detectChanges();
    }, 0);
  }

  editarCompetencia(c: Competencia): void {
    this.showCompForm = true;
    this.competenciaEditando = { ...c };

    // Garantir que perguntasIds é um array válido
    const perguntasIds = Array.isArray(c.perguntasIds) ? [...c.perguntasIds] : [];

    // Restaurar perguntas custom se a competência tem perguntasIds que são custom (ou se não há avaliação)
    // Separar perguntas da avaliação de perguntas custom
    const perguntasDaAvaliacao = this.selectedAssessmentId
      ? c.perguntasIds.filter(id => !id.startsWith('custom_'))
      : [];
    const perguntasCustomIds = c.perguntasIds.filter(id => id.startsWith('custom_') || !this.selectedAssessmentId);

    if (perguntasCustomIds.length > 0) {
      // Verificar se já existem perguntas custom para esta competência
      if (!this.customQuestionsByCompetency[c.id] || this.customQuestionsByCompetency[c.id].length === 0) {
        // Se não existem perguntas custom salvas, tentar reconstruir a partir dos IDs
        // Mas primeiro, tentar encontrar as perguntas custom em outros lugares (como quando carregadas de um grupo)
        const perguntasCustomRestauradas = perguntasCustomIds.map((id, idx) => {
          // Tentar encontrar a pergunta custom completa em algum lugar
          const perguntaExistente = Object.values(this.customQuestionsByCompetency)
            .flat()
            .find(q => q.id === id);

          if (perguntaExistente && perguntaExistente.title) {
            return { ...perguntaExistente }; // Clonar para não modificar a original
          }

          // Se não encontrou ou não tem título, criar objeto básico com título padrão
          return {
            id: id,
            title: `Pergunta Custom ${idx + 1}`,
            type: 'rating'
          };
        });

        this.customQuestionsByCompetency[c.id] = perguntasCustomRestauradas;
        console.log('✅ Perguntas custom restauradas para competência:', c.id, perguntasCustomRestauradas);
      } else {
        // Se já existem perguntas custom, garantir que todas as perguntasIds custom estão representadas
        // E que todas têm títulos válidos (não vazios e não são IDs)
        const idsExistentes = this.customQuestionsByCompetency[c.id].map(q => q.id);
        const idsFaltantes = perguntasCustomIds.filter(id => !idsExistentes.includes(id));

        // Garantir que perguntas existentes têm títulos válidos
        this.customQuestionsByCompetency[c.id].forEach((pergunta, idx) => {
          if (!pergunta.title || pergunta.title.trim() === '' || pergunta.title === pergunta.id) {
            pergunta.title = `Pergunta Custom ${idx + 1}`;
          }
        });

        if (idsFaltantes.length > 0) {
          // Adicionar perguntas faltantes
          idsFaltantes.forEach((id, idx) => {
            // Tentar encontrar a pergunta em outros lugares antes de criar uma nova
            const perguntaExistente = Object.values(this.customQuestionsByCompetency)
              .flat()
              .find(q => q.id === id);

            if (perguntaExistente && perguntaExistente.title && perguntaExistente.title !== id) {
              this.customQuestionsByCompetency[c.id].push({ ...perguntaExistente });
            } else {
              this.customQuestionsByCompetency[c.id].push({
                id: id,
                title: `Pergunta Custom ${this.customQuestionsByCompetency[c.id].length + idx + 1}`,
                type: 'rating'
              });
            }
          });
        }
      }
    } else {
      // Se não há perguntas custom ainda, garantir que o array existe para permitir adicionar novas
      // Isso se aplica tanto quando há avaliação quanto quando não há
      if (!this.customQuestionsByCompetency[c.id]) {
        this.customQuestionsByCompetency[c.id] = [];
      }
    }

    this.competenciaForm.setValue({
      nome: c.nome || '',
      descricao: c.descricao || '',
      perguntasIds: perguntasIds
    });

    // Atualizar perguntas bloqueadas antes de detectar mudanças
    this.atualizarPerguntasBloqueadas();

    // Atualizar cache de perguntas custom
    this.perguntasCustomCache = this.getPerguntasCustomCompetencia(c.id);

    // Usar setTimeout para evitar loops infinitos de detecção de mudanças
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
  }

  async removerCompetencia(c: Competencia): Promise<void> {
    const confirmado = await this.confirmDialog.confirmDelete(c.nome);
    if (!confirmado) return;
    const idx = this.competencias.findIndex(comp => comp.id === c.id);
    if (idx > -1) {
      this.competencias.splice(idx, 1);
      this.hasUnsavedChanges = true;
      this.snackBar.open(this.t('Competência removida!'), this.t('Fechar'), { duration: 3000 });
      this.atualizarPerguntasBloqueadas();
      setTimeout(() => { this.saveCompetencyGroup(); }, 0);
    }
  }

  cancelarEdicaoCompetencia(): void {
    this.showCompForm = false;
    this.competenciaEditando = { id: '', nome: '', descricao: '', perguntasIds: [] };
    this.competenciaForm.reset({ nome: '', descricao: '', perguntasIds: [] });
    this.perguntasCustomCache = []; // Limpar cache ao cancelar edição
    this.atualizarPerguntasBloqueadas();
  }

  startNewCompetencia(): void {
    this.competenciaEditando = { id: '', nome: '', descricao: '', perguntasIds: [] };
    this.competenciaForm.reset({ nome: '', descricao: '', perguntasIds: [] });
    this.perguntasCustomCache = [];
    this.atualizarPerguntasBloqueadas();
    this.showCompForm = true;
  }

  isCompetenciaSalva(id: string | null | undefined): boolean {
    return !!id && this.competencias.some(c => c.id === id);
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
      console.log('📦 CARREGANDO GRUPOS DE COMPETÊNCIAS');
      console.log('  - ClientId:', clientId);

      const groupsCollection = collection(this.firestore, 'competencyGroups');
      const groupsSnapshot = await getDocs(
        query(groupsCollection, where('clientId', '==', clientId))
      );

      console.log(`  - Total de grupos encontrados: ${groupsSnapshot.docs.length}`);

      this.competencyGroups = groupsSnapshot.docs.map((doc) => {
        const data = doc.data();
        console.log(`  - Grupo encontrado:`, {
          id: doc.id,
          name: data['name'],
          clientId: data['clientId'],
          assessmentId: data['assessmentId'],
          totalCompetencias: data['competencias']?.length || 0,
          competencias: data['competencias']
        });
        return {
          id: doc.id,
          ...data
        };
      });

      console.log(`✅ Total de grupos carregados: ${this.competencyGroups.length}`);
    } catch (error) {
      console.error('❌ Erro ao carregar grupos de competências:', error);
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

    const groupName = String(this.groupNameControl.value || '').trim();
    if (!groupName) {
      this.snackBar.open(this.t('Digite um nome para o grupo de competências.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    try {
      const assessmentIdFinal = this.selectedAssessmentId;
      const isCreatingNewGroup = !this.currentGroupId;

      // Validação removida: competências sem perguntas são permitidas (usuário vincula depois)

      // Garantir que todas as competências têm nome e descrição válidos antes de salvar
      const competenciasParaSalvar = this.competencias.map(comp => ({
        id: comp.id,
        nome: comp.nome || 'Competência sem nome',
        descricao: comp.descricao || '',
        perguntasIds: Array.isArray(comp.perguntasIds) ? [...comp.perguntasIds] : []
      }));

      console.log('💾 COMPETÊNCIAS ANTES DE SALVAR:');
      competenciasParaSalvar.forEach((c, idx) => {
        console.log(`  - Competência ${idx + 1}:`, {
          id: c.id,
          nome: c.nome,
          descricao: c.descricao,
          perguntasIds: c.perguntasIds.length
        });
      });

      const groupData: any = {
        name: groupName,
        clientId: this.selectedClientId,
        competencias: competenciasParaSalvar,
        assessmentId: assessmentIdFinal
      };

      // Preservar createdAt se estiver editando
      if (!this.currentGroupId) {
        groupData.createdAt = new Date();
      } else {
        groupData.updatedAt = new Date();
      }

      // Salvar perguntas custom se houver (para compatibilidade com grupos antigos)
      if (this.customQuestions.length > 0) {
        groupData.customQuestions = this.customQuestions;
      }

      // Salvar perguntas custom por competência (sempre que houver, com ou sem avaliação)
      // IMPORTANTE: Filtrar apenas perguntas custom das competências que estão sendo salvas
      // para evitar salvar perguntas de competências antigas que não existem mais
      const idsCompetenciasNoGrupo = new Set(competenciasParaSalvar.map(c => c.id));
      const customQuestionsFiltradas: { [key: string]: { id: string; title: string; type: string }[] } = {};

      // Primeiro, coletar perguntas custom que já estão em customQuestionsByCompetency
      Object.keys(this.customQuestionsByCompetency).forEach(compId => {
        // Apenas incluir se a competência está no grupo atual
        if (idsCompetenciasNoGrupo.has(compId)) {
          const perguntasCustom = this.customQuestionsByCompetency[compId];
          // Filtrar apenas perguntas custom que estão nos perguntasIds da competência
          const perguntasIdsDaCompetencia = new Set(competenciasParaSalvar.find(c => c.id === compId)?.perguntasIds || []);
          const perguntasCustomFiltradas = perguntasCustom.filter(p => perguntasIdsDaCompetencia.has(p.id));

          if (perguntasCustomFiltradas.length > 0) {
            customQuestionsFiltradas[compId] = perguntasCustomFiltradas;
          }
        }
      });

      // IMPORTANTE: Se uma competência tem perguntas custom nos perguntasIds mas não tem em customQuestionsByCompetency,
      // reconstruir essas perguntas antes de salvar (isso pode acontecer se não foram restauradas corretamente ao carregar)
      // Buscar em TODAS as perguntas custom (não apenas nas filtradas) para encontrar títulos
      const todasPerguntasCustomDisponiveis = Object.values(this.customQuestionsByCompetency).flat();
      console.log('🔍 DEBUG SALVAR: Todas as perguntas custom disponíveis em customQuestionsByCompetency:');
      console.log(`  - Total: ${todasPerguntasCustomDisponiveis.length}`);
      todasPerguntasCustomDisponiveis.forEach((p, idx) => {
        console.log(`    ${idx + 1}. ID: ${p.id}, Título: "${p.title || 'SEM TÍTULO'}"`);
      });

      competenciasParaSalvar.forEach(comp => {
        const perguntasCustomIds = comp.perguntasIds.filter(id => id.startsWith('custom_'));
        console.log(`🔍 DEBUG SALVAR: Processando competência ${comp.id} (${comp.nome}):`);
        console.log(`  - Total de perguntasIds: ${comp.perguntasIds.length}`);
        console.log(`  - Perguntas custom nos perguntasIds: ${perguntasCustomIds.length}`);
        perguntasCustomIds.forEach((id, idx) => {
          console.log(`    ${idx + 1}. ${id}`);
        });

        if (perguntasCustomIds.length > 0) {
          // Se não tem perguntas custom salvas para esta competência, reconstruir
          if (!customQuestionsFiltradas[comp.id] || customQuestionsFiltradas[comp.id].length === 0) {
            console.log(`  ⚠️ Nenhuma pergunta custom filtrada para ${comp.id}, reconstruindo...`);
            // Tentar encontrar perguntas custom em TODAS as competências (caso tenham sido migradas ou estejam em outras)
            const perguntasCustomReconstruidas = perguntasCustomIds.map((id, idx) => {
              // Buscar em todas as perguntas custom disponíveis (de qualquer competência)
              const perguntaEncontrada = todasPerguntasCustomDisponiveis.find(p => p.id === id);

              if (perguntaEncontrada) {
                console.log(`    ✅ Encontrada pergunta ${id} com título: "${perguntaEncontrada.title}"`);
              } else {
                console.log(`    ⚠️ Pergunta ${id} NÃO encontrada em customQuestionsByCompetency, criando título padrão: "Pergunta Custom ${idx + 1}"`);
              }

              return perguntaEncontrada || {
                id: id,
                title: `Pergunta Custom ${idx + 1}`,
                type: 'rating'
              };
            });

            customQuestionsFiltradas[comp.id] = perguntasCustomReconstruidas;
            console.log(`💾 Reconstruídas ${perguntasCustomIds.length} perguntas custom para competência ${comp.id} antes de salvar`);
            console.log(`  - Perguntas que serão salvas:`, perguntasCustomReconstruidas.map(p => ({ id: p.id, title: p.title })));
          } else {
            console.log(`  ✅ Já tem ${customQuestionsFiltradas[comp.id].length} perguntas custom filtradas`);
            console.log(`  - Perguntas filtradas:`, customQuestionsFiltradas[comp.id].map(p => ({ id: p.id, title: p.title })));
            // Garantir que todas as perguntas custom nos perguntasIds estão representadas
            const idsExistentes = new Set(customQuestionsFiltradas[comp.id].map(p => p.id));
            const idsFaltantes = perguntasCustomIds.filter(id => !idsExistentes.has(id));

            if (idsFaltantes.length > 0) {
              console.log(`  ⚠️ Faltam ${idsFaltantes.length} perguntas custom:`, idsFaltantes);
              idsFaltantes.forEach((id, idx) => {
                // Buscar em todas as perguntas custom disponíveis
                const perguntaEncontrada = todasPerguntasCustomDisponiveis.find(p => p.id === id);

                if (perguntaEncontrada) {
                  console.log(`    ✅ Encontrada pergunta faltante ${id} com título: "${perguntaEncontrada.title}"`);
                } else {
                  console.log(`    ⚠️ Pergunta faltante ${id} NÃO encontrada, criando título padrão`);
                }

                customQuestionsFiltradas[comp.id].push(perguntaEncontrada || {
                  id: id,
                  title: `Pergunta Custom ${customQuestionsFiltradas[comp.id].length + idx + 1}`,
                  type: 'rating'
                });
              });
              console.log(`💾 Adicionadas ${idsFaltantes.length} perguntas custom faltantes para competência ${comp.id}`);
            }
          }
        }
      });

      if (Object.keys(customQuestionsFiltradas).length > 0) {
        groupData.customQuestionsByCompetency = customQuestionsFiltradas;
        console.log('💾 Salvando perguntas custom por competência (filtradas):', customQuestionsFiltradas);
        console.log('  - IDs de competências no grupo:', Array.from(idsCompetenciasNoGrupo));
        console.log('  - IDs de competências com perguntas custom:', Object.keys(customQuestionsFiltradas));
      } else {
        // Se não há perguntas custom para salvar, remover do grupo (limpar dados antigos)
        groupData.customQuestionsByCompetency = {};
        console.log('💾 Nenhuma pergunta custom para salvar (todas foram filtradas ou removidas)');
      }

      console.log('📦 DADOS DO GRUPO A SER SALVO:');
      console.log('  - Editando grupo existente:', !!this.currentGroupId);
      console.log('  - ID do grupo:', this.currentGroupId || 'NOVO');
      console.log('  - Nome do grupo:', groupData.name);
      console.log('  - ClientId:', groupData.clientId);
      console.log('  - AssessmentId:', groupData.assessmentId);
      console.log('  - Total de competências:', groupData.competencias.length);
      console.log('  - Competências:', JSON.stringify(groupData.competencias, null, 2));
      console.log('  - Perguntas custom:', groupData.customQuestions?.length || 0);

      // Se está editando um grupo existente, atualizar; caso contrário, criar novo
      if (this.currentGroupId) {
        const groupDocRef = doc(this.firestore, 'competencyGroups', this.currentGroupId);
        await updateDoc(groupDocRef, groupData);
        this.hasUnsavedChanges = false;
        this.snackBar.open(this.t('Grupo atualizado com sucesso!'), this.t('Fechar'), { duration: 3000 });
      } else {
        const docRef = await addDoc(collection(this.firestore, 'competencyGroups'), groupData);
        this.currentGroupId = docRef.id;
        this.hasUnsavedChanges = false;
        this.snackBar.open(this.t('Grupo salvo com sucesso!'), this.t('Fechar'), { duration: 3000 });
      }

      // Mantém o controle sincronizado para evitar bloqueio de autosave
      this.groupNameControl.setValue(groupName, { emitEvent: false });

      // Fechar editor de grupo após salvar
      this.isGroupEditorOpen = false;

      // Atualizar lista de grupos
      await this.loadCompetencyGroups(this.selectedClientId);

      // Se criou novo grupo, seleciona explicitamente o ID retornado pelo Firestore
      if (isCreatingNewGroup && this.currentGroupId) {
        this.competencyGroupControl.setValue(this.currentGroupId, { emitEvent: false });
      }

      // Forçar atualização da view para garantir que o dropdown seja atualizado
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 0);

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

        // Armazenar o ID do grupo sendo editado
        this.currentGroupId = selectedGroupId;

        // Preencher o nome do grupo no campo de edição
        this.groupNameControl.setValue(groupData['name'] || '');

        // Carregar competências do grupo - garantir que são objetos válidos com nome e descrição
        const competenciasCarregadas = groupData['competencias'] || [];
        this.competencias = competenciasCarregadas.map((comp: any) => ({
          id: comp.id || `comp_${Date.now()}_${Math.random()}`,
          nome: comp.nome || comp.name || 'Competência sem nome',
          descricao: comp.descricao || comp.description || '',
          perguntasIds: Array.isArray(comp.perguntasIds) ? [...comp.perguntasIds] : []
        }));

        console.log('📥 COMPETÊNCIAS CARREGADAS DO GRUPO:');
        console.log('  - Total:', this.competencias.length);
        this.competencias.forEach((c, idx) => {
          console.log(`  - Competência ${idx + 1}:`, {
            id: c.id,
            nome: c.nome,
            descricao: c.descricao,
            perguntasIds: c.perguntasIds.length
          });
        });

        // Limpar perguntas custom existentes antes de carregar
        this.customQuestionsByCompetency = this.competencyQuestionsService.normalizeCustomQuestionsByCompetency(groupData);
        this.customQuestions = Array.isArray(groupData['customQuestions']) ? [...groupData['customQuestions']] : [];

        // IDs das competências que estão sendo carregadas
        const idsCompetenciasCarregadas = new Set(this.competencias.map(c => c.id));

        // Se o grupo tem assessmentId associado, selecionar a avaliação
        if (groupData['assessmentId']) {
          this.selectedAssessmentId = groupData['assessmentId'];
          this.assessmentControl.setValue(groupData['assessmentId']);

          // Carregar perguntas custom ANTES de carregar a avaliação (para compatibilidade com grupos antigos)
          if (groupData['customQuestions'] && Array.isArray(groupData['customQuestions'])) {
            this.customQuestions = groupData['customQuestions'];
          } else {
            this.customQuestions = [];
          }

          // IMPORTANTE: Restaurar customQuestionsByCompetency mesmo quando há assessmentId
          // Mas apenas para competências que estão sendo carregadas (filtrar competências antigas)
          const customQuestionsCarregadas: { [key: string]: { id: string; title: string; type: string }[] } = {};

          if (groupData['customQuestionsByCompetency'] && typeof groupData['customQuestionsByCompetency'] === 'object') {
            // Filtrar apenas perguntas custom de competências que estão sendo carregadas
            Object.keys(groupData['customQuestionsByCompetency']).forEach(compId => {
              if (idsCompetenciasCarregadas.has(compId)) {
                const perguntasCustom = groupData['customQuestionsByCompetency'][compId] || [];
                // Filtrar apenas perguntas custom que estão nos perguntasIds da competência
                const competencia = this.competencias.find(c => c.id === compId);
                if (competencia) {
                  const perguntasIdsDaCompetencia = new Set(competencia.perguntasIds || []);
                  const perguntasCustomFiltradas = perguntasCustom.filter((p: any) =>
                    perguntasIdsDaCompetencia.has(p.id)
                  );

                  if (perguntasCustomFiltradas.length > 0) {
                    // Garantir que todas as perguntas custom têm títulos válidos
                    perguntasCustomFiltradas.forEach((pergunta: any, idx: number) => {
                      if (!pergunta.title || pergunta.title.trim() === '' || pergunta.title === pergunta.id) {
                        pergunta.title = `Pergunta Custom ${idx + 1}`;
                      }
                    });
                    customQuestionsCarregadas[compId] = perguntasCustomFiltradas;
                  }
                }
              }
            });
          }

          // IMPORTANTE: Se não encontrou perguntas custom salvas, reconstruir a partir dos perguntasIds
          // Isso garante que perguntas custom que estão nos perguntasIds mas não foram salvas corretamente
          // sejam restauradas com títulos padrão
          // Buscar em TODAS as competências salvas (não apenas nas carregadas) para encontrar títulos
          const todasPerguntasCustomSalvas: { id: string; title: string; type: string }[] = [];
          if (groupData['customQuestionsByCompetency'] && typeof groupData['customQuestionsByCompetency'] === 'object') {
            console.log('🔍 DEBUG: Buscando perguntas custom em customQuestionsByCompetency salvo:');
            console.log('  - Chaves encontradas:', Object.keys(groupData['customQuestionsByCompetency']));
            Object.keys(groupData['customQuestionsByCompetency']).forEach(compId => {
              const perguntas = groupData['customQuestionsByCompetency'][compId] || [];
              console.log(`  - Competência ${compId}: ${perguntas.length} perguntas custom salvas`);
              perguntas.forEach((p: any, idx: number) => {
                console.log(`    ${idx + 1}. ID: ${p.id}, Título: "${p.title || 'SEM TÍTULO'}"`);
              });
              if (Array.isArray(perguntas)) {
                todasPerguntasCustomSalvas.push(...perguntas);
              }
            });
            console.log(`  - Total de perguntas custom encontradas em TODAS as competências: ${todasPerguntasCustomSalvas.length}`);
          } else {
            console.log('⚠️ DEBUG: Nenhum customQuestionsByCompetency encontrado no grupo salvo');
          }

          this.competencias.forEach(comp => {
            const perguntasCustomIds = comp.perguntasIds.filter(id => id.startsWith('custom_'));
            console.log(`🔍 DEBUG: Processando competência ${comp.id} (${comp.nome}):`);
            console.log(`  - Total de perguntasIds: ${comp.perguntasIds.length}`);
            console.log(`  - Perguntas custom nos perguntasIds: ${perguntasCustomIds.length}`);
            perguntasCustomIds.forEach((id, idx) => {
              console.log(`    ${idx + 1}. ${id}`);
            });

            if (perguntasCustomIds.length > 0) {
              // Se não tem perguntas custom restauradas para esta competência, reconstruir
              if (!customQuestionsCarregadas[comp.id] || customQuestionsCarregadas[comp.id].length === 0) {
                console.log(`  ⚠️ Nenhuma pergunta custom restaurada para ${comp.id}, reconstruindo...`);
                // Reconstruir perguntas custom a partir dos IDs, buscando títulos em todas as perguntas salvas
                customQuestionsCarregadas[comp.id] = perguntasCustomIds.map((id, idx) => {
                  // Tentar encontrar em todas as perguntas custom salvas (de qualquer competência)
                  const perguntaEncontrada = todasPerguntasCustomSalvas.find(p => p.id === id);

                  if (perguntaEncontrada) {
                    console.log(`    ✅ Encontrada pergunta ${id} com título: "${perguntaEncontrada.title}"`);
                  } else {
                    console.log(`    ⚠️ Pergunta ${id} NÃO encontrada, criando título padrão: "Pergunta Custom ${idx + 1}"`);
                  }

                  return perguntaEncontrada || {
                    id: id,
                    title: `Pergunta Custom ${idx + 1}`,
                    type: 'rating'
                  };
                });
                console.log(`✅ Reconstruídas ${perguntasCustomIds.length} perguntas custom para competência ${comp.id} a partir dos perguntasIds`);
                console.log(`  - Perguntas reconstruídas:`, customQuestionsCarregadas[comp.id].map(p => ({ id: p.id, title: p.title })));
              } else {
                console.log(`  ✅ Já tem ${customQuestionsCarregadas[comp.id].length} perguntas custom restauradas`);
                // Garantir que todas as perguntas custom nos perguntasIds estão representadas
                const idsExistentes = new Set(customQuestionsCarregadas[comp.id].map(p => p.id));
                const idsFaltantes = perguntasCustomIds.filter(id => !idsExistentes.has(id));

                if (idsFaltantes.length > 0) {
                  console.log(`  ⚠️ Faltam ${idsFaltantes.length} perguntas custom:`, idsFaltantes);
                  idsFaltantes.forEach((id, idx) => {
                    // Tentar encontrar em todas as perguntas custom salvas
                    const perguntaEncontrada = todasPerguntasCustomSalvas.find(p => p.id === id);

                    if (perguntaEncontrada) {
                      console.log(`    ✅ Encontrada pergunta faltante ${id} com título: "${perguntaEncontrada.title}"`);
                    } else {
                      console.log(`    ⚠️ Pergunta faltante ${id} NÃO encontrada, criando título padrão`);
                    }

                    customQuestionsCarregadas[comp.id].push(perguntaEncontrada || {
                      id: id,
                      title: `Pergunta Custom ${customQuestionsCarregadas[comp.id].length + idx + 1}`,
                      type: 'rating'
                    });
                  });
                  console.log(`✅ Adicionadas ${idsFaltantes.length} perguntas custom faltantes para competência ${comp.id}`);
                }
              }
            }
          });

          this.customQuestionsByCompetency = customQuestionsCarregadas;
          console.log('✅ Perguntas custom por competência restauradas (com assessmentId, filtradas):', Object.keys(this.customQuestionsByCompetency).length, 'competências');
          console.log('  - IDs de competências carregadas:', Array.from(idsCompetenciasCarregadas));
          console.log('  - IDs de competências com perguntas custom:', Object.keys(this.customQuestionsByCompetency));

          await this.onAssessmentChange();
        } else {
          // Se não tem assessmentId, restaurar perguntas custom por competência
          // Verificar se há customQuestionsByCompetency salvo
          const customQuestionsCarregadas: { [key: string]: { id: string; title: string; type: string }[] } = {};

          if (groupData['customQuestionsByCompetency'] && typeof groupData['customQuestionsByCompetency'] === 'object') {
            // Filtrar apenas perguntas custom de competências que estão sendo carregadas
            Object.keys(groupData['customQuestionsByCompetency']).forEach(compId => {
              if (idsCompetenciasCarregadas.has(compId)) {
                const perguntasCustom = groupData['customQuestionsByCompetency'][compId] || [];
                // Filtrar apenas perguntas custom que estão nos perguntasIds da competência
                const competencia = this.competencias.find(c => c.id === compId);
                if (competencia) {
                  const perguntasIdsDaCompetencia = new Set(competencia.perguntasIds || []);
                  const perguntasCustomFiltradas = perguntasCustom.filter((p: any) =>
                    perguntasIdsDaCompetencia.has(p.id)
                  );

                  if (perguntasCustomFiltradas.length > 0) {
                    // Garantir que todas as perguntas custom têm títulos válidos
                    perguntasCustomFiltradas.forEach((pergunta: any, idx: number) => {
                      if (!pergunta.title || pergunta.title.trim() === '' || pergunta.title === pergunta.id) {
                        pergunta.title = `Pergunta Custom ${idx + 1}`;
                      }
                    });
                    customQuestionsCarregadas[compId] = perguntasCustomFiltradas;
                  }
                }
              }
            });
          } else if (groupData['customQuestions'] && Array.isArray(groupData['customQuestions'])) {
            // Compatibilidade com formato antigo (array simples)
            this.customQuestions = groupData['customQuestions'];
          }

          // IMPORTANTE: Se não encontrou perguntas custom salvas, reconstruir a partir dos perguntasIds
          // Isso garante que perguntas custom que estão nos perguntasIds mas não foram salvas corretamente
          // sejam restauradas com títulos padrão
          // Buscar em TODAS as competências salvas (não apenas nas carregadas) para encontrar títulos
          const todasPerguntasCustomSalvas: { id: string; title: string; type: string }[] = [];
          if (groupData['customQuestionsByCompetency'] && typeof groupData['customQuestionsByCompetency'] === 'object') {
            Object.values(groupData['customQuestionsByCompetency']).forEach((perguntas: any) => {
              if (Array.isArray(perguntas)) {
                todasPerguntasCustomSalvas.push(...perguntas);
              }
            });
          }

          this.competencias.forEach(comp => {
            if (comp.perguntasIds && comp.perguntasIds.length > 0) {
              // Quando não há assessmentId, todas as perguntas são custom
              if (!customQuestionsCarregadas[comp.id] || customQuestionsCarregadas[comp.id].length === 0) {
                customQuestionsCarregadas[comp.id] = comp.perguntasIds.map((id, idx) => {
                  // Tentar encontrar em todas as perguntas custom salvas
                  const perguntaEncontrada = todasPerguntasCustomSalvas.find(p => p.id === id);

                  return perguntaEncontrada || {
                    id: id,
                    title: `Pergunta Custom ${idx + 1}`,
                    type: 'rating'
                  };
                });
                console.log(`✅ Reconstruídas ${comp.perguntasIds.length} perguntas custom para competência ${comp.id} a partir dos perguntasIds`);
              }
            }
          });

          this.customQuestionsByCompetency = customQuestionsCarregadas;
          console.log('✅ Perguntas custom por competência restauradas (filtradas):', Object.keys(this.customQuestionsByCompetency).length, 'competências');
          console.log('  - IDs de competências carregadas:', Array.from(idsCompetenciasCarregadas));
          console.log('  - IDs de competências com perguntas custom:', Object.keys(this.customQuestionsByCompetency));
        }

        // Limpar edição atual ao carregar novo grupo
        this.cancelarEdicaoCompetencia();

        this.snackBar.open(this.t('Grupo carregado com sucesso! Você pode editá-lo e salvar as alterações.'), this.t('Fechar'), { duration: 4000 });
        this.atualizarPerguntasBloqueadas();
        // Usar setTimeout para evitar loops infinitos
        setTimeout(() => {
          this.cdr.detectChanges();
        }, 0);

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
    return `${filtered} questão${filtered !== 1 ? 'ões' : ''} disponível${filtered !== 1 ? 'eis' : ''}${openExcluded > 0 ? ` · ${openExcluded} aberta${openExcluded !== 1 ? 's' : ''} (não vinculável${openExcluded !== 1 ? 'eis' : ''})` : ''}`;
  }

  private readonly openTypes = ['comment', 'text', 'file', 'fileupload'];

  getUnlinkedQuestions(): { id: string; title: string; type: string }[] {
    const linkedIds = new Set<string>();
    this.competencias.forEach(c => (c.perguntasIds || []).forEach(id => linkedIds.add(id)));
    return this.allQuestions.filter(q => !linkedIds.has(q.id));
  }

  /** Perguntas que PODEM ser vinculadas mas ainda não foram */
  getUnlinkedLinkable(): { id: string; title: string; type: string }[] {
    return this.getUnlinkedQuestions().filter(q => !this.openTypes.includes(q.type));
  }

  /** Perguntas de tipo aberto — não vinculáveis a competências */
  getUnlinkedOpen(): { id: string; title: string; type: string }[] {
    return this.getUnlinkedQuestions().filter(q => this.openTypes.includes(q.type));
  }

  getLinkedQuestionsCount(): number {
    const linkedIds = new Set<string>();
    this.competencias.forEach(c => (c.perguntasIds || []).forEach(id => linkedIds.add(id)));
    return linkedIds.size;
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

  trackByPerguntaCustom(index: number, item: { id: string; title: string; type: string }): string {
    return item.id || `pergunta-${index}`;
  }

  getQuestionsForEditing(): { id: string; title: string; type: string }[] {
    if (!this.competenciaEditando.id) return [];
    return (this.competenciaEditando.perguntasIds || []).map(id => ({
      id,
      title: this.questionMap[id] || id,
      type: this.getQuestionTypeByIdSafe(id)
    }));
  }

  getQuestionTypeIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      // raw types
      'rating': 'star_rate',
      'radiogroup': 'radio_button_checked',
      'checkbox': 'check_box',
      'dropdown': 'arrow_drop_down_circle',
      'text': 'short_text',
      'comment': 'notes',
      'file': 'attach_file',
      'fileupload': 'attach_file',
      'boolean': 'toggle_on',
      // labels traduzidos (retrocompatibilidade)
      'Avaliação': 'star_rate',
      'Múltipla Escolha': 'radio_button_checked',
      'Texto': 'short_text',
      'Comentário': 'notes',
      'Dropdown': 'arrow_drop_down_circle',
      'Checkbox': 'check_box',
      'Sim/Não': 'toggle_on'
    };
    return iconMap[type] || 'help_outline';
  }

  openEditQuestionDialog(questionId: string): void {
    if (!this.selectedAssessmentId) {
      this.snackBar.open(this.t('Selecione uma avaliação primeiro.'), this.t('Fechar'), { duration: 3000 });
      return;
    }
    const question = this.allQuestions.find(q => q.id === questionId);
    if (!question) {
      this.snackBar.open(this.t('Pergunta não encontrada.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(CreateQuestionDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: {
        assessmentId: this.selectedAssessmentId,
        existingQuestion: { id: question.id, title: question.title, type: question.type }
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        this.questionMap[result.id] = result.title;
        const idx = this.allQuestions.findIndex(q => q.id === result.id);
        if (idx > -1) {
          this.allQuestions[idx] = { ...this.allQuestions[idx], title: result.title, type: result.type };
        }
        this.cdr.detectChanges();
      }
    });
  }

  desvincularPergunta(questionId: string): void {
    this.competenciaEditando.perguntasIds = (this.competenciaEditando.perguntasIds || []).filter(id => id !== questionId);
    const ctrl = this.competenciaForm.get('perguntasIds');
    const current: string[] = ctrl?.value || [];
    ctrl?.setValue(current.filter(id => id !== questionId));
    this.cdr.detectChanges();
  }

  vincularPergunta(questionId: string): void {
    const ctrl = this.competenciaForm.get('perguntasIds');
    const current: string[] = ctrl?.value || [];
    if (!current.includes(questionId)) {
      ctrl?.setValue([...current, questionId]);
      this.competenciaEditando.perguntasIds = [...(this.competenciaEditando.perguntasIds || []), questionId];
      this.cdr.detectChanges();
    }
  }

  getFormLinkedQuestions(): { id: string; title: string; type: string }[] {
    const ids: string[] = this.competenciaForm.get('perguntasIds')?.value || [];
    return ids.map(id => ({
      id,
      title: this.questionMap[id] || id,
      type: this.getQuestionTypeByIdSafe(id)
    }));
  }

  getAvailableToAdd(): { id: string; title: string; type: string }[] {
    const selectedIds = new Set<string>(this.competenciaForm.get('perguntasIds')?.value || []);
    return this.filteredQuestions.filter(q => !selectedIds.has(q.id) && !this.perguntasBloqueadas.has(q.id));
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

  async removerPerguntaCustom(perguntaId: string): Promise<void> {
    // Verificar se a pergunta está sendo usada em alguma competência
    const estaEmUso = this.competencias.some(c => (c.perguntasIds || []).includes(perguntaId));
    if (estaEmUso) {
      this.snackBar.open(this.t('Não é possível remover uma pergunta que está vinculada a uma competência.'), this.t('Fechar'), { duration: 3000 });
      return;
    }

    const textoPergunta = this.questionMap[perguntaId]
      || this.allQuestions.find(q => q.id === perguntaId)?.title
      || perguntaId;
    const confirmado = await this.confirmDialog.confirmDelete(textoPergunta);
    if (!confirmado) return;

    try {
      // Remover do surveyJSON da avaliação (fonte principal das perguntas)
      if (this.selectedAssessmentId) {
        const assessmentRef = doc(this.firestore, 'assessments', this.selectedAssessmentId);
        const assessmentSnap = await getDoc(assessmentRef);
        if (assessmentSnap.exists()) {
          const surveyJSON = assessmentSnap.data()['surveyJSON'];
          if (surveyJSON?.pages) {
            surveyJSON.pages.forEach((page: any) => {
              if (Array.isArray(page.elements)) {
                page.elements = page.elements.filter((el: any) => el.name !== perguntaId);
              }
            });
            await updateDoc(assessmentRef, { surveyJSON });
          }
        }
      }

      // Remover também de customQuestions (legado) se existir
      const customIdx = this.customQuestions.findIndex(q => q.id === perguntaId);
      if (customIdx > -1) this.customQuestions.splice(customIdx, 1);

      // Atualizar listas locais
      const allIndex = this.allQuestions.findIndex(q => q.id === perguntaId);
      if (allIndex > -1) this.allQuestions.splice(allIndex, 1);

      delete this.questionMap[perguntaId];
      this.onQuestionFilterChange();
      this.cdr.detectChanges();

      this.snackBar.open(this.t('Pergunta removida!'), this.t('Fechar'), { duration: 3000 });
    } catch (error) {
      console.error('Erro ao remover pergunta:', error);
      this.snackBar.open(this.t('Erro ao remover pergunta.'), this.t('Fechar'), { duration: 3000 });
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

  // Métodos para gerenciar perguntas custom por competência (quando não há avaliação)
  adicionarPerguntaCustom(competenciaId: string): void {
    console.log('🔵 ADICIONAR PERGUNTA CUSTOM - INÍCIO');
    console.log('  - competenciaId recebido:', competenciaId);
    console.log('  - competenciaEditando.id atual:', this.competenciaEditando.id);
    console.log('  - Nome da competência no form:', this.competenciaForm.get('nome')?.value);
    console.log('  - Total de competências salvas:', this.competencias.length);

    // Determinar qual ID usar para armazenar as perguntas custom
    // Prioridade: 1) ID da competência sendo editada, 2) ID recebido, 3) ID temporário
    let idParaUsar = this.competenciaEditando.id || competenciaId;

    // Se a competência já foi salva e existe no array, usar o ID dela
    if (idParaUsar && this.competencias.some(c => c.id === idParaUsar)) {
      console.log('  ✅ Usando ID de competência salva:', idParaUsar);
    } else if (competenciaId && this.competencias.some(c => c.id === competenciaId)) {
      // Se o ID recebido corresponde a uma competência salva, usar ele
      idParaUsar = competenciaId;
      console.log('  ✅ Usando ID recebido de competência salva:', idParaUsar);
    } else {
      // Se não há competência salva ainda, criar ou usar um ID temporário único
      const nomeCompetencia = this.competenciaForm.get('nome')?.value || 'temp';
      console.log('  ⚠️ Nenhuma competência salva encontrada. Nome:', nomeCompetencia);

      // Verificar se já existe um ID temporário para esta sessão de edição
      if (!idParaUsar || idParaUsar === '') {
        // Criar um ID temporário único para esta sessão
        idParaUsar = `comp_temp_${nomeCompetencia.replace(/\s+/g, '_')}_${Date.now()}`;
        this.competenciaEditando.id = idParaUsar;
        console.log('  🆕 Criado novo ID temporário:', idParaUsar);
      } else {
        // Usar o ID temporário que já existe
        console.log('  ♻️ Reutilizando ID temporário existente:', idParaUsar);
      }
    }

    // Garantir que o array existe
    if (!this.customQuestionsByCompetency[idParaUsar]) {
      this.customQuestionsByCompetency[idParaUsar] = [];
      console.log('  📝 Criado novo array para perguntas custom');
    } else {
      console.log('  📋 Array já existe com', this.customQuestionsByCompetency[idParaUsar].length, 'perguntas');
    }

    // Criar nova pergunta com título padrão
    const totalPerguntas = this.customQuestionsByCompetency[idParaUsar].length;
    const novaPerguntaId = `custom_${idParaUsar}_${new Date().getTime()}_${Math.random().toString(36).substring(2, 11)}`;
    this.customQuestionsByCompetency[idParaUsar].push({
      id: novaPerguntaId,
      title: `Pergunta Custom ${totalPerguntas + 1}`,
      type: 'rating'
    });

    console.log('✅ PERGUNTA CUSTOM ADICIONADA:');
    console.log('  - ID da pergunta:', novaPerguntaId);
    console.log('  - ID da competência:', idParaUsar);
    console.log('  - Total de perguntas custom agora:', this.customQuestionsByCompetency[idParaUsar].length);
    console.log('  - Todas as perguntas:', this.customQuestionsByCompetency[idParaUsar]);
    console.log('🔵 ADICIONAR PERGUNTA CUSTOM - FIM');

    // Atualizar cache e usar setTimeout para evitar loops infinitos
    this.perguntasCustomCache = this.getPerguntasCustomCompetencia(idParaUsar);
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
  }

  async removerPerguntaCustomCompetencia(competenciaId: string, index: number): Promise<void> {
    // Se não há ID, usar o ID temporário da competência sendo editada
    let idParaUsar = competenciaId || this.competenciaEditando.id;

    // Se ainda não há ID, tentar encontrar perguntas em qualquer chave temporária
    if (!idParaUsar) {
      const tempKeys = Object.keys(this.customQuestionsByCompetency).filter(k =>
        k.startsWith('comp_temp_') || k.startsWith('comp_')
      );
      if (tempKeys.length > 0) {
        idParaUsar = tempKeys[0];
      } else {
        console.warn('Não foi possível encontrar ID da competência para remover pergunta custom');
        return;
      }
    }

    // Garantir que o array existe
    if (!this.customQuestionsByCompetency[idParaUsar]) {
      this.customQuestionsByCompetency[idParaUsar] = [];
    }

    const perguntas = this.customQuestionsByCompetency[idParaUsar];
    if (!perguntas || index < 0 || index >= perguntas.length) {
      console.warn(`Não foi possível remover pergunta custom: index ${index} fora do range (0-${perguntas?.length - 1})`);
      return;
    }

    const textoPergunta = perguntas[index]?.title || `Pergunta ${index + 1}`;
    const confirmado = await this.confirmDialog.confirmDelete(textoPergunta);
    if (!confirmado) return;

    perguntas.splice(index, 1);
    // Atualizar cache e usar setTimeout para evitar loops infinitos
    this.perguntasCustomCache = this.getPerguntasCustomCompetencia(idParaUsar);
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
  }

  atualizarPerguntaCustomCompetencia(competenciaId: string, index: number, campo: 'title' | 'type', valor: string): void {
    // Se não há ID, usar o ID temporário da competência sendo editada
    let idParaUsar = competenciaId || this.competenciaEditando.id;

    // Se ainda não há ID, tentar encontrar perguntas em qualquer chave temporária
    if (!idParaUsar) {
      const tempKeys = Object.keys(this.customQuestionsByCompetency).filter(k =>
        k.startsWith('comp_temp_') || k.startsWith('comp_')
      );
      if (tempKeys.length > 0) {
        idParaUsar = tempKeys[0];
      } else {
        console.warn('Não foi possível encontrar ID da competência para atualizar pergunta custom');
        return;
      }
    }

    // Garantir que o array existe
    if (!this.customQuestionsByCompetency[idParaUsar]) {
      this.customQuestionsByCompetency[idParaUsar] = [];
    }

    const perguntas = this.customQuestionsByCompetency[idParaUsar];
    if (perguntas && index >= 0 && index < perguntas.length) {
      perguntas[index][campo] = valor;
      // Atualizar cache (mas não chamar detectChanges - o Angular já detecta mudanças em eventos de input)
      this.perguntasCustomCache = [...perguntas];
    } else {
      console.warn(`Não foi possível atualizar pergunta custom: index ${index} fora do range (0-${perguntas.length - 1})`);
    }
  }

  getPerguntasCustomCompetencia(competenciaId: string): { id: string; title: string; type: string }[] {
    // Se não há ID fornecido, tentar usar o ID temporário da competência sendo editada
    let idParaUsar = competenciaId;
    if (!idParaUsar && this.competenciaEditando.id) {
      idParaUsar = this.competenciaEditando.id;
    }

    // Se ainda não há ID, procurar em todas as chaves temporárias
    if (!idParaUsar) {
      const tempKeys = Object.keys(this.customQuestionsByCompetency).filter(k =>
        k.startsWith('comp_temp_') || k.startsWith('comp_')
      );
      if (tempKeys.length > 0) {
        // Retornar perguntas da primeira chave temporária encontrada
        const result = this.customQuestionsByCompetency[tempKeys[0]] || [];
        this.perguntasCustomCache = result;
        return result;
      }
      this.perguntasCustomCache = [];
      return [];
    }

    // Buscar perguntas custom pelo ID da competência
    const perguntas = this.customQuestionsByCompetency[idParaUsar] || [];

    // Se não encontrou perguntas e estamos editando uma competência existente,
    // tentar reconstruir a partir dos perguntasIds da competência
    if (perguntas.length === 0 && this.competenciaEditando.id === idParaUsar) {
      const competenciaExistente = this.competencias.find(c => c.id === idParaUsar);
      if (competenciaExistente && competenciaExistente.perguntasIds && competenciaExistente.perguntasIds.length > 0) {
        // Reconstruir perguntas custom a partir dos IDs
        const result = competenciaExistente.perguntasIds.map((id, idx) => {
          // Tentar encontrar a pergunta em outras competências ou em arrays temporários
          const perguntaExistente = Object.values(this.customQuestionsByCompetency)
            .flat()
            .find(q => q.id === id);

          return perguntaExistente || {
            id: id,
            title: `Pergunta ${idx + 1}`,
            type: 'rating'
          };
        });
        this.perguntasCustomCache = result;
        return result;
      }
    }

    this.perguntasCustomCache = perguntas;
    return perguntas;
  }

  getTituloPerguntaCustom(competenciaId: string, perguntaId: string): string {
    return this.competencyQuestionsService.resolveQuestionTitle(
      perguntaId,
      competenciaId,
      this.questionMap,
      this.customQuestionsByCompetency
    );
  }

  temPerguntaCustom(competenciaId: string, perguntaId: string): boolean {
    const perguntas = this.getPerguntasCustomCompetencia(competenciaId);
    return perguntas.some(q => q.id === perguntaId);
  }

  // ─── Gerenciamento de grupos ─────────────────────────────────────────────

  startNewGroup(): void {
    this.currentGroupId = null;
    this.hasUnsavedChanges = false;
    this.groupNameControl.reset();
    this.competencias = [];
    this.customQuestions = [];
    this.customQuestionsByCompetency = {};
    this.assessmentControl.reset();
    this.selectedAssessmentId = null;
    this.cancelarEdicaoCompetencia();
    this.competencyGroupControl.reset();
    this.isGroupEditorOpen = true;
  }

  onClientSelectClose(): void {
    this.clientSearchControl.setValue('');
    this.filteredClients = [...this.clients];
  }

  async confirmAndExit(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      type: 'warning',
      title: 'Sair sem salvar?',
      message: 'Há alterações não salvas neste grupo. Se sair agora, as mudanças serão perdidas.',
      confirmText: 'Sair sem salvar',
      cancelText: 'Cancelar',
    });
    if (confirmed) {
      this.clearGroupSelection();
    }
  }

  clearGroupSelection(): void {
    this.currentGroupId = null;
    this.hasUnsavedChanges = false;
    this.competencias = [];
    this.customQuestions = [];
    this.customQuestionsByCompetency = {};
    this.cancelarEdicaoCompetencia();
    this.isGroupEditorOpen = false;
  }

  editCompetencyGroup(group: any): void {
    this.currentGroupId = group.id;
    this.hasUnsavedChanges = false;
    this.groupNameControl.setValue(group.name);
    this.competencyGroupControl.setValue(group.id);

    // Restaurar competências antes de mexer na avaliação (evita race com valueChanges)
    this.competencias = (group.competencias || []).map((c: any) => ({
      id: c.id,
      nome: c.nome,
      descricao: c.descricao || '',
      perguntasIds: c.perguntasIds || []
    }));

    // Restaurar perguntas custom por competência
    if (group.customQuestionsByCompetency) {
      this.customQuestionsByCompetency = { ...group.customQuestionsByCompetency };
    } else {
      this.customQuestionsByCompetency = {};
    }
    this.customQuestions = group.customQuestions?.length ? [...group.customQuestions] : [];

    // Restaurar avaliação vinculada
    if (group.assessmentId) {
      this.selectedAssessmentId = group.assessmentId;
      this.assessmentControl.setValue(group.assessmentId, { emitEvent: false });
      void this.onAssessmentChange();
    } else {
      this.selectedAssessmentId = null;
      this.assessmentControl.reset('', { emitEvent: false });
      this.allQuestions = [];
      this.filteredQuestions = [];
      this.questionMap = {};
      this.dynamicColumns = [];
    }

    this.cancelarEdicaoCompetencia();
    this.snackBar.open(`Editando grupo: ${group.name}`, 'OK', { duration: 2500 });
  }

  async deleteCompetencyGroup(group: any): Promise<void> {
    const confirmado = await this.confirmDialog.confirmDelete(group.name);
    if (!confirmado) return;

    try {
      await deleteDoc(doc(this.firestore, 'competencyGroups', group.id));

      // Limpar estado se o grupo excluído era o atual
      if (this.currentGroupId === group.id) {
        this.startNewGroup();
      }

      // Recarregar lista de grupos
      if (this.selectedClientId) {
        await this.loadCompetencyGroups(this.selectedClientId);
      }

      this.snackBar.open(`Grupo "${group.name}" excluído com sucesso.`, 'OK', { duration: 3000 });
    } catch (error) {
      console.error('Erro ao excluir grupo:', error);
      this.snackBar.open('Erro ao excluir grupo.', 'Fechar', { duration: 3000 });
    }
  }

  openGroupEditor(group?: any): void {
    if (group) {
      this.editCompetencyGroup(group);
    } else {
      this.startNewGroup();
    }
    this.isGroupEditorOpen = true;
  }

  closeGroupEditor(): void {
    this.isGroupEditorOpen = false;
  }

  getGroupName(): string {
    const group = this.competencyGroups.find(g => g.id === this.currentGroupId);
    return group ? group.name : (this.groupNameControl.value || '');
  }

  getActiveGroup(): any {
    return this.competencyGroups.find(g => g.id === this.currentGroupId) || null;
  }

  getAssessmentLabel(): string {
    if (!this.selectedAssessmentId) return 'Sem avaliação vinculada';
    const assessment = this.assessments.find(a => a.id === this.selectedAssessmentId);
    return assessment ? assessment.name : 'Avaliação vinculada';
  }

  async linkAssessmentToGroup(): Promise<void> {
    const assessmentId = this.assessmentControl.value;
    if (!assessmentId) {
      this.snackBar.open(this.t('Selecione uma avaliação.'), this.t('Fechar'), { duration: 3000 });
      return;
    }
    this.selectedAssessmentId = assessmentId;
    await this.onAssessmentChange();
    await this.saveCompetencyGroup();
  }

  // ─────────────────────────────────────────────────────────────────────────
}

