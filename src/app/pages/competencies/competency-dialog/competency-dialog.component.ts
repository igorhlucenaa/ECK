import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Firestore, addDoc, updateDoc, doc, collection } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Subject, takeUntil } from 'rxjs';

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
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, DragDropModule],
  templateUrl: './competency-dialog.component.html',
  styleUrls: ['./competency-dialog.component.scss']
})
export class CompetencyDialogComponent implements OnInit, OnDestroy {
  competencyForm: FormGroup;
  isEditing: boolean = false;
  isLoading = false;
  private destroy$ = new Subject<void>();

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
    public dialogRef: MatDialogRef<CompetencyDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.competencyForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', Validators.required],
      clientId: [this.data.clientId, Validators.required],
      questions: this.fb.array([])
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
    });
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

  removeQuestion(index: number): void {
    if (this.questionsArray.length > 1 && index >= 0 && index < this.questionsArray.length) {
      this.questionsArray.removeAt(index);
      this.updateQuestionOrders();
    }
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
    return Math.random().toString(36).substr(2, 9);
  }

  async saveCompetency(): Promise<void> {
    if (this.competencyForm.invalid) {
      this.snackBar.open('Por favor, preencha todos os campos obrigatórios', 'Fechar', { duration: 3000 });
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
      this.snackBar.open('Erro ao salvar competência', 'Fechar', { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
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
}
