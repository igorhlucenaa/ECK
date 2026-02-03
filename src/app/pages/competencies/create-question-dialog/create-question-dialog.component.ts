import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray, FormControl } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Firestore, addDoc, collection, doc, getDoc, updateDoc } from '@angular/fire/firestore';
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
    { value: 'rating', label: 'Escala (1-5)', icon: 'linear_scale' },
    { value: 'radiogroup', label: 'Múltipla Escolha', icon: 'radio_button_checked' },
    { value: 'text', label: 'Texto', icon: 'text_fields' },
    { value: 'comment', label: 'Comentário', icon: 'comment' },
    { value: 'dropdown', label: 'Dropdown', icon: 'arrow_drop_down' },
    { value: 'checkbox', label: 'Checkbox', icon: 'check_box' },
    { value: 'boolean', label: 'Sim/Não', icon: 'toggle_on' }
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
    // Inicializa com tipo padrão
    this.onQuestionTypeChange('rating');
  }

  get optionsArray(): FormArray {
    return this.questionForm.get('options') as FormArray;
  }

  onQuestionTypeChange(type: string): void {
    this.questionForm.patchValue({ type });

    // Limpa as opções existentes
    this.optionsArray.clear();

    if (type === 'radiogroup' || type === 'dropdown' || type === 'checkbox') {
      // Adiciona opções padrão para múltipla escolha, dropdown e checkbox
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

  private generateQuestionName(): string {
    // Gera um nome único para a pergunta (usado como ID no SurveyJS)
    const timestamp = new Date().getTime();
    const random = Math.random().toString(36).substring(2, 8);
    return `pergunta_${timestamp}_${random}`;
  }

  async saveQuestion(): Promise<void> {
    if (this.questionForm.invalid) {
      this.snackBar.open('Preencha todos os campos obrigatórios', 'Fechar', { duration: 3000 });
      return;
    }

    if (!this.data?.assessmentId) {
      this.snackBar.open('Erro: ID da avaliação não fornecido', 'Fechar', { duration: 3000 });
      return;
    }

    try {
      this.isLoading = true;
      const formValue = this.questionForm.value;

      // Carregar a avaliação atual
      const assessmentRef = doc(this.firestore, 'assessments', this.data.assessmentId);
      const assessmentSnap = await getDoc(assessmentRef);

      if (!assessmentSnap.exists()) {
        this.snackBar.open('Avaliação não encontrada', 'Fechar', { duration: 3000 });
        return;
      }

      const assessmentData = assessmentSnap.data();
      const surveyJSON = assessmentData['surveyJSON'] || { pages: [] };

      // Garantir que há pelo menos uma página
      if (!surveyJSON.pages || !Array.isArray(surveyJSON.pages) || surveyJSON.pages.length === 0) {
        surveyJSON.pages = [{ name: 'página1', elements: [] }];
      }

      // Criar o elemento da pergunta no formato SurveyJS
      const questionName = this.generateQuestionName();
      const newQuestionElement: any = {
        name: questionName,
        type: formValue.type,
        title: {
          pt: formValue.title
        },
        isRequired: formValue.required || false
      };

      // Adicionar configurações específicas por tipo
      if (formValue.type === 'rating') {
        newQuestionElement.rateMin = 1;
        newQuestionElement.rateMax = 5;
        newQuestionElement.minRateDescription = { pt: 'Discordo Totalmente' };
        newQuestionElement.maxRateDescription = { pt: 'Concordo Totalmente' };
      } else if ((formValue.type === 'radiogroup' || formValue.type === 'dropdown' || formValue.type === 'checkbox')
                 && formValue.options && formValue.options.length > 0) {
        newQuestionElement.choices = formValue.options.filter((opt: string) => opt && opt.trim() !== '');
      } else if (formValue.type === 'text') {
        newQuestionElement.inputType = 'text';
      }

      // Adicionar a pergunta à primeira página (ou criar uma nova se necessário)
      const firstPage = surveyJSON.pages[0];
      if (!firstPage.elements) {
        firstPage.elements = [];
      }
      firstPage.elements.push(newQuestionElement);

      // Atualizar a avaliação no Firestore
      await updateDoc(assessmentRef, {
        surveyJSON: surveyJSON
      });

      // Criar objeto de retorno com informações da pergunta
      const newQuestion = {
        id: questionName,
        title: formValue.title,
        type: formValue.type,
        required: formValue.required || false
      };

      this.snackBar.open('Pergunta criada e adicionada à avaliação com sucesso!', 'Fechar', { duration: 3000 });
      this.dialogRef.close(newQuestion);
    } catch (error) {
      console.error('Erro ao criar pergunta:', error);
      this.snackBar.open('Erro ao criar pergunta na avaliação', 'Fechar', { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }
}

