import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Firestore, addDoc, updateDoc, doc, collection, getDocs, getDoc, query, where } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { ConfirmDialogService } from 'src/app/shared/confirm-dialog/confirm-dialog.service';

interface Competency {
  id: string;
  name: string;
  description: string;
  clientId: string;
  questions: Question[];
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

interface DialogData {
  competency?: Competency;
  clientId: string;
  clients: Client[];
}

@Component({
  selector: 'app-competency-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, DragDropModule, TranslateModule],
  templateUrl: './competency-dialog.component.html',
  styleUrls: ['./competency-dialog.component.scss']
})
export class CompetencyDialogComponent implements OnInit, OnDestroy {
  competencyForm: FormGroup;
  isEditing: boolean = false;
  isLoading = false;
  private destroy$ = new Subject<void>();

  // Modo Grupo
  isGroupMode: boolean = false;
  groupForm!: FormGroup;
  availableCompetencies: { id: string; name: string; description: string }[] = [];
  availableAssessments: { id: string; name: string }[] = [];
  availableQuestions: { id: string; title: string; type?: string }[] = [];
  // Perguntas custom quando não houver avaliação
  customQuestionsByCompetency: { [competencyId: string]: { id: string; title: string }[] } = {};

  questionTypes = [
    { value: 'likert', label: 'Escala Likert (1-5)', icon: 'linear_scale' },
    { value: 'multiple_choice', label: 'Múltipla Escolha', icon: 'radio_button_checked' },
    { value: 'text', label: 'Texto Livre', icon: 'text_fields' },
    { value: 'number', label: 'Número', icon: 'pin' }
  ];

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private translate: TranslateService,
    private confirmDialog: ConfirmDialogService,
    public dialogRef: MatDialogRef<CompetencyDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.competencyForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', Validators.required],
      clientId: [this.data.clientId, Validators.required],
      questions: this.fb.array([])
    });

    this.groupForm = this.fb.group({
      clientId: [this.data.clientId, Validators.required],
      groupName: ['', [Validators.required, Validators.minLength(3)]],
      selectedCompetencyIds: [[], [Validators.required, Validators.minLength(1)]],
      assessmentId: [''],
      mappings: this.fb.array([])
    });
  }

  ngOnInit(): void {
    // Aguarda um tick para garantir que o FormArray esteja inicializado
    setTimeout(() => {
      // Garante que o FormArray esteja sempre disponível
      if (!this.competencyForm.get('questions')) {
        this.competencyForm.setControl('questions', this.fb.array([]));
      }

      if (this.data.competency) {
        this.isEditing = true;
        this.loadCompetencyData(this.data.competency);
      } else {
        // Adiciona uma pergunta padrão para nova competência
        this.addQuestion();
      }

      // Carrega dados iniciais para modo grupo com base no cliente atual
      const initialClientId = this.competencyForm.get('clientId')?.value as string;
      if (initialClientId) {
        this.loadAvailableCompetencies(initialClientId);
        this.loadAvailableAssessments(initialClientId);
      }

      // Recarrega listas ao mudar cliente (modo competência)
      this.competencyForm.get('clientId')?.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((clientId: string) => {
          if (clientId) {
            this.loadAvailableCompetencies(clientId);
            this.loadAvailableAssessments(clientId);
            this.availableQuestions = [];
            this.clearMappings();
            this.customQuestionsByCompetency = {};
          } else {
            this.availableCompetencies = [];
            this.availableAssessments = [];
            this.availableQuestions = [];
            this.clearMappings();
            this.customQuestionsByCompetency = {};
          }
        });

      // Recarrega listas ao mudar cliente (modo grupo)
      this.groupForm.get('clientId')?.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((clientId: string) => {
          if (clientId) {
            this.loadAvailableCompetencies(clientId);
            this.loadAvailableAssessments(clientId);
            this.availableQuestions = [];
            this.clearMappings();
            this.customQuestionsByCompetency = {};
          } else {
            this.availableCompetencies = [];
            this.availableAssessments = [];
            this.availableQuestions = [];
            this.clearMappings();
            this.customQuestionsByCompetency = {};
          }
        });

      // Atualiza mapeamentos quando competências selecionadas mudarem
      this.groupForm.get('selectedCompetencyIds')?.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((ids: string[]) => {
          this.syncMappings(ids || []);
        });

      // Carrega perguntas da avaliação ao selecionar uma
      this.groupForm.get('assessmentId')?.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((assessmentId: string) => {
          if (assessmentId) {
            this.loadAssessmentQuestions(assessmentId);
          } else {
            this.availableQuestions = [];
          }
        });
    });
  }

  async save(): Promise<void> {
    if (this.isGroupMode) {
      return this.saveCompetencyGroup();
    }
    return this.saveCompetency();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCompetencyData(competency: Competency): void {
    // Garante que o FormArray esteja disponível
    if (!this.competencyForm.get('questions')) {
      this.competencyForm.setControl('questions', this.fb.array([]));
    }

    // Limpa o FormArray existente
    this.questionsArray.clear();

    // Atualiza os valores básicos
    this.competencyForm.patchValue({
      name: competency.name,
      description: competency.description,
      clientId: competency.clientId
    });

    // Adiciona as perguntas existentes
    if (competency.questions && Array.isArray(competency.questions)) {
      competency.questions.forEach(question => {
        this.addQuestion(question);
      });
    } else {
      // Se não há perguntas, adiciona uma padrão
      this.addQuestion();
    }
  }

  get questionsArray(): FormArray {
    const questions = this.competencyForm.get('questions');
    if (!questions || !(questions instanceof FormArray)) {
      // Se não existir ou não for um FormArray, cria um novo
      const newArray = this.fb.array([]);
      this.competencyForm.setControl('questions', newArray);
      return newArray;
    }
    return questions;
  }

  addQuestion(question?: Question): void {
    // Garante que o FormArray esteja disponível
    if (!this.competencyForm.get('questions')) {
      this.competencyForm.setControl('questions', this.fb.array([]));
    }

    // Cria um FormArray vazio para as opções
    const optionsArray = this.fb.array([]);

    // Se for múltipla escolha e tiver opções, adiciona-as
    if (question?.type === 'multiple_choice' && question?.options && question.options.length > 0) {
      question.options.forEach(opt => {
        optionsArray.push(this.fb.control(opt, Validators.required));
      });
    } else if (question?.type === 'multiple_choice') {
      // Adiciona opções padrão para múltipla escolha
      optionsArray.push(this.fb.control('Opção 1', Validators.required));
      optionsArray.push(this.fb.control('Opção 2', Validators.required));
    }

    const questionGroup = this.fb.group({
      id: [question?.id || this.generateId()],
      text: [question?.text || '', Validators.required],
      type: [question?.type || 'likert', Validators.required],
      options: optionsArray,
      required: [question?.required || false],
      order: [question?.order || this.questionsArray.length]
    });

    this.questionsArray.push(questionGroup);
  }

  async removeQuestion(index: number): Promise<void> {
    if (this.questionsArray.length <= 1 || index < 0 || index >= this.questionsArray.length) return;
    const textoQ = this.questionsArray.at(index)?.get('text')?.value || `Pergunta ${index + 1}`;
    const confirmado = await this.confirmDialog.confirmDelete(textoQ);
    if (!confirmado) return;
    this.questionsArray.removeAt(index);
    this.updateQuestionOrders();
  }

  addOption(questionIndex: number): void {
    if (questionIndex < 0 || questionIndex >= this.questionsArray.length) return;

    const question = this.questionsArray.at(questionIndex);
    if (!question) return;

    const optionsArray = question.get('options') as FormArray;
    if (optionsArray) {
      optionsArray.push(this.fb.control('', Validators.required));
    }
  }

  removeOption(questionIndex: number, optionIndex: number): void {
    if (questionIndex < 0 || questionIndex >= this.questionsArray.length) return;

    const question = this.questionsArray.at(questionIndex);
    if (!question) return;

    const optionsArray = question.get('options') as FormArray;
    if (optionsArray && optionIndex >= 0 && optionIndex < optionsArray.length && optionsArray.length > 1) {
      optionsArray.removeAt(optionIndex);
    }
  }

  onQuestionTypeChange(questionIndex: number, type: string): void {
    if (questionIndex < 0 || questionIndex >= this.questionsArray.length) return;

    const question = this.questionsArray.at(questionIndex);
    if (!question) return;

    const optionsArray = question.get('options') as FormArray;
    if (!optionsArray) return;

    // Limpa as opções existentes
    optionsArray.clear();

    if (type === 'multiple_choice') {
      // Adiciona opções padrão para múltipla escolha
      optionsArray.push(this.fb.control('Opção 1', Validators.required));
      optionsArray.push(this.fb.control('Opção 2', Validators.required));
    }
    // Para outros tipos, mantém o array vazio
  }

  onDrop(event: CdkDragDrop<Question[]>): void {
    if (event.previousIndex >= 0 && event.currentIndex >= 0 &&
        event.previousIndex < this.questionsArray.length &&
        event.currentIndex < this.questionsArray.length) {
      moveItemInArray(this.questionsArray.controls, event.previousIndex, event.currentIndex);
      this.updateQuestionOrders();
    }
  }

  private updateQuestionOrders(): void {
    this.questionsArray.controls.forEach((control, index) => {
      if (control && control.get('order')) {
        control.patchValue({ order: index });
      }
    });
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  async saveCompetency(): Promise<void> {
    if (this.competencyForm.invalid) {
      this.snackBar.open(this.translate.instant('Por favor, preencha todos os campos obrigatórios'), this.translate.instant('Fechar'), { duration: 3000 });
      return;
    }

    try {
      this.isLoading = true;
      const formValue = this.competencyForm.value;

      // Prepara os dados da competência
      const competencyData: any = {
        name: formValue.name,
        description: formValue.description,
        clientId: formValue.clientId,
        questions: (formValue.questions || []).map((q: any, index: number) => ({
          ...q,
          order: index,
          options: q.options || []
        })),
        updatedAt: new Date()
      };

      if (this.isEditing && this.data.competency) {
        // Atualiza competência existente
        const docRef = doc(this.firestore, 'competencies', this.data.competency.id);
        await updateDoc(docRef, competencyData);
      } else {
        // Cria nova competência
        competencyData.createdAt = new Date();
        const competenciesCollection = collection(this.firestore, 'competencies');
        await addDoc(competenciesCollection, competencyData);
      }

      this.dialogRef.close(true);
    } catch (error) {
      console.error('Erro ao salvar competência:', error);
      this.snackBar.open(this.translate.instant('Erro ao salvar competência'), this.translate.instant('Fechar'), { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

  // Métodos para modo Grupo
  private async loadAvailableCompetencies(clientId: string): Promise<void> {
    try {
      const competenciesCol = collection(this.firestore, 'competencies');
      const qy = query(competenciesCol, where('clientId', '==', clientId));
      const snap = await getDocs(qy);
      this.availableCompetencies = snap.docs.map(d => ({
        id: d.id,
        name: d.data()['name'] || '',
        description: d.data()['description'] || ''
      }));
    } catch (error) {
      console.error('Erro ao carregar competências do cliente:', error);
      this.availableCompetencies = [];
    }
  }

  private async loadAvailableAssessments(clientId: string): Promise<void> {
    try {
      const assessmentsCol = collection(this.firestore, 'assessments');
      const qy = query(assessmentsCol, where('clientId', '==', clientId));
      const snap = await getDocs(qy);
      this.availableAssessments = snap.docs.map(d => ({
        id: d.id,
        name: d.data()['name'] || d.id
      }));
    } catch (error) {
      console.error('Erro ao carregar avaliações do cliente:', error);
      this.availableAssessments = [];
    }
  }

  async saveCompetencyGroup(): Promise<void> {
    if (this.groupForm.invalid) {
      this.snackBar.open('Preencha os campos do grupo corretamente', 'Fechar', { duration: 3000 });
      return;
    }

    const clientId = this.groupForm.get('clientId')?.value as string;
    if (!clientId) {
      this.snackBar.open('Selecione um cliente para o grupo', 'Fechar', { duration: 3000 });
      return;
    }

    try {
      this.isLoading = true;
      const { groupName, selectedCompetencyIds, assessmentId } = this.groupForm.value as {
        groupName: string;
        selectedCompetencyIds: string[];
        assessmentId?: string;
      };

      // Monta a estrutura de competencias do grupo no padrão do reports
      const competencias = (selectedCompetencyIds || []).map(id => {
        const c = this.availableCompetencies.find(ac => ac.id === id);
        const perguntasIds = this.getPerguntasIdsForCompetency(id, !!assessmentId);
        return c ? { id: c.id, nome: c.name, descricao: c.description, perguntasIds } : null;
      }).filter((c): c is { id: string; nome: string; descricao: string; perguntasIds: string[] } => !!c);

      const groupData: any = {
        name: groupName,
        clientId,
        competencias,
        createdAt: new Date(),
      };
      if (assessmentId) {
        groupData.assessmentId = assessmentId;
      } else {
        groupData.customQuestionsByCompetency = this.customQuestionsByCompetency;
      }

      await addDoc(collection(this.firestore, 'competencyGroups'), groupData);

      this.snackBar.open('Grupo salvo com sucesso!', 'Fechar', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Erro ao salvar grupo de competências:', error);
      this.snackBar.open('Erro ao salvar grupo de competências.', 'Fechar', { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

  // Mapeamentos de perguntas por competência (semelhante ao reports)
  get mappingsArray(): FormArray {
    return this.groupForm.get('mappings') as FormArray;
  }

  private clearMappings(): void {
    this.mappingsArray.clear();
  }

  private syncMappings(competencyIds: string[]): void {
    // Remover mapeamentos que não estão mais selecionados
    for (let i = this.mappingsArray.length - 1; i >= 0; i--) {
      const fg = this.mappingsArray.at(i) as FormGroup;
      const cid = fg.get('competencyId')?.value as string;
      if (!competencyIds.includes(cid)) {
        this.mappingsArray.removeAt(i);
      }
    }
    // Adicionar mapeamentos para novos ids
    competencyIds.forEach(cid => {
      const exists = this.mappingsArray.controls.some(ctrl => (ctrl as FormGroup).get('competencyId')?.value === cid);
      if (!exists) {
        this.mappingsArray.push(this.fb.group({
          competencyId: [cid, Validators.required],
          perguntasIds: [[] as string[]]
        }));
      }
      // Inicializar estrutura de perguntas custom
      if (!this.customQuestionsByCompetency[cid]) {
        this.customQuestionsByCompetency[cid] = [];
      }
    });
  }

  getPerguntasIdsForCompetency(competencyId: string, hasAssessment: boolean): string[] {
    if (hasAssessment) {
      const fg = this.mappingsArray.controls.find(ctrl => (ctrl as FormGroup).get('competencyId')?.value === competencyId) as FormGroup | undefined;
      const ids = (fg?.get('perguntasIds')?.value as string[]) || [];
      return Array.isArray(ids) ? ids : [];
    }
    // Sem avaliação: usar perguntas custom
    const customs = this.customQuestionsByCompetency[competencyId] || [];
    return customs.map(q => q.id);
  }

  async loadAssessmentQuestions(assessmentId: string): Promise<void> {
    try {
      const assessmentRef = doc(this.firestore, 'assessments', assessmentId);
      const snap = await getDoc(assessmentRef);
      if (!snap.exists()) {
        this.availableQuestions = [];
        return;
      }
      const data = snap.data();
      const surveyJSON = data['surveyJSON'];
      const questions: { id: string; title: string; type?: string }[] = [];
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
      this.availableQuestions = questions;
    } catch (error) {
      console.error('Erro ao carregar perguntas da avaliação:', error);
      this.availableQuestions = [];
    }
  }

  // Perguntas custom (sem avaliação)
  addCustomQuestion(competencyId: string): void {
    const id = this.generateId();
    if (!this.customQuestionsByCompetency[competencyId]) this.customQuestionsByCompetency[competencyId] = [];
    this.customQuestionsByCompetency[competencyId].push({ id, title: '' });
  }

  removeCustomQuestion(competencyId: string, index: number): void {
    const arr = this.customQuestionsByCompetency[competencyId];
    if (!arr) return;
    if (index >= 0 && index < arr.length) arr.splice(index, 1);
  }

  updateCustomQuestionTitle(competencyId: string, index: number, value: string): void {
    const arr = this.customQuestionsByCompetency[competencyId];
    if (!arr) return;
    if (index >= 0 && index < arr.length) arr[index].title = value;
  }

  cancel(): void {
    this.dialogRef.close();
  }

  getQuestionTypeIcon(type: string): string {
    const questionType = this.questionTypes.find(qt => qt.value === type);
    return questionType ? questionType.icon : 'help';
  }

  canRemoveQuestion(): boolean {
    return this.questionsArray.length > 1;
  }

  // Helper method to safely get options FormArray for a question
  getQuestionOptionsArray(questionIndex: number): FormArray {
    const question = this.questionsArray.at(questionIndex);
    if (!question) {
      return this.fb.array([]);
    }
    const options = question.get('options');
    if (options && options instanceof FormArray) {
      return options;
    }
    return this.fb.array([]);
  }

  // TrackBy methods for better performance
  trackByIndex(index: number, item: any): number {
    return index;
  }

  trackByOptionIndex(index: number, item: any): number {
    return index;
  }

  // Helper methods para evitar optional chaining em templates
  getQuestionControl(index: number, controlName: string): any {
    const question = this.questionsArray.at(index);
    return question ? question.get(controlName) : null;
  }

  getQuestionTypeValue(index: number): string {
    const question = this.questionsArray.at(index);
    return question ? question.get('type')?.value : '';
  }

  getQuestionTextValue(index: number): string {
    const question = this.questionsArray.at(index);
    return question ? question.get('text')?.value : '';
  }

  getQuestionRequiredValue(index: number): boolean {
    const question = this.questionsArray.at(index);
    return question ? question.get('required')?.value : false;
  }

  getCompetencyNameById(id: string): string {
    const comp = this.availableCompetencies.find(c => c.id === id);
    return comp ? comp.name : id;
  }

  getMappingCompetencyId(index: number): string {
    const fg = this.mappingsArray.at(index) as FormGroup;
    return fg ? fg.get('competencyId')?.value || '' : '';
  }

  getSelectedCompetencyIds(): string[] {
    return (this.groupForm.get('selectedCompetencyIds')?.value as string[]) || [];
  }
}
