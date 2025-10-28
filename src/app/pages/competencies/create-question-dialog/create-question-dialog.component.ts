import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Firestore, addDoc, collection } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';

interface Question {
  id: string;
  title: string;
  type: string;
  options?: string[];
  required?: boolean;
}

@Component({
  selector: 'app-create-question-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './create-question-dialog.component.html',
  styleUrls: ['./create-question-dialog.component.scss']
})
export class CreateQuestionDialogComponent implements OnInit {
  questionForm: FormGroup;
  isLoading = false;

  questionTypes = [
    { value: 'likert', label: 'Escala Likert (1-5)', icon: 'linear_scale' },
    { value: 'multiple_choice', label: 'Múltipla Escolha', icon: 'radio_button_checked' },
    { value: 'text', label: 'Texto Livre', icon: 'text_fields' },
    { value: 'comment', label: 'Comentário', icon: 'comment' },
    { value: 'number', label: 'Número', icon: 'pin' }
  ];

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<CreateQuestionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.questionForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      type: ['likert', Validators.required],
      options: this.fb.array([]),
      required: [false]
    });
  }

  ngOnInit(): void {
    // Inicializa com opções padrão para múltipla escolha
    this.onQuestionTypeChange('likert');
  }

  get optionsArray(): FormArray {
    return this.questionForm.get('options') as FormArray;
  }

  onQuestionTypeChange(type: string): void {
    this.questionForm.patchValue({ type });

    // Limpa as opções existentes
    this.optionsArray.clear();

    if (type === 'multiple_choice') {
      // Adiciona opções padrão para múltipla escolha
      this.optionsArray.push(this.fb.control('Opção 1', Validators.required));
      this.optionsArray.push(this.fb.control('Opção 2', Validators.required));
    }
  }

  addOption(): void {
    this.optionsArray.push(this.fb.control('', Validators.required));
  }

  removeOption(index: number): void {
    if (this.optionsArray.length > 1) {
      this.optionsArray.removeAt(index);
    }
  }

  private generateId(): string {
    return `custom_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveQuestion(): Promise<void> {
    if (this.questionForm.invalid) {
      this.snackBar.open('Preencha todos os campos obrigatórios', 'Fechar', { duration: 3000 });
      return;
    }

    try {
      this.isLoading = true;
      const formValue = this.questionForm.value;

      // Cria a nova pergunta
      const newQuestion: Question = {
        id: this.generateId(),
        title: formValue.title,
        type: formValue.type,
        required: formValue.required || false
      };

      // Adiciona opções se for múltipla escolha
      if (formValue.type === 'multiple_choice' && formValue.options) {
        newQuestion.options = formValue.options;
      }

      // Salva a pergunta customizada no Firestore
      const customQuestionsCollection = collection(this.firestore, 'customQuestions');
      await addDoc(customQuestionsCollection, {
        ...newQuestion,
        clientId: this.data.clientId,
        createdAt: new Date()
      });

      this.snackBar.open('Pergunta criada com sucesso!', 'Fechar', { duration: 3000 });
      this.dialogRef.close(newQuestion);
    } catch (error) {
      console.error('Erro ao criar pergunta:', error);
      this.snackBar.open('Erro ao criar pergunta', 'Fechar', { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }
}

