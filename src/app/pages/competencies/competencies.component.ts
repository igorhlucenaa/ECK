import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import {
  Competency,
  CompetencyService,
} from '../../services/competency.service';
import { Client, ClientService } from '../../services/client/client.service';
import {
  collection,
  getDocs,
  Firestore,
  query,
  where,
  doc,
  getDoc,
} from '@angular/fire/firestore';

interface Question {
  id: string;
  title: string;
}

interface Assessment {
  id: string;
  name: string;
}

@Component({
  selector: 'app-competencies',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './competencies.component.html',
  styleUrls: ['./competencies.component.scss'],
})
export class CompetenciesComponent implements OnInit {
  clients: Client[] = [];
  selectedClientId: string | null = null;
  assessments: Assessment[] = [];
  selectedAssessmentId: string | null = null;

  competencies: Competency[] = [];
  questions: Question[] = [];
  isLoading = false;
  isEditing = false;
  editingId: string | null = null;

  displayedColumns: string[] = [
    'name',
    'description',
    'questionCount',
    'actions',
  ];
  competencyForm: FormGroup;

  // FormControls para seleção de cliente e avaliação
  clientControl = new FormControl('', [Validators.required]);
  assessmentControl = new FormControl('', [Validators.required]);

  constructor(
    private competencyService: CompetencyService,
    private clientService: ClientService,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {
    this.competencyForm = new FormGroup({
      name: new FormControl('', [Validators.required, Validators.minLength(3)]),
      description: new FormControl('', [
        Validators.required,
        Validators.minLength(10),
      ]),
      questionIds: new FormControl<string[]>([], [Validators.required]),
    });
  }

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    this.isLoading = true;
    this.clientService.getClients().subscribe({
      next: (data) => {
        this.clients = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading clients:', err);
        this.isLoading = false;
        this.snackBar.open('Erro ao carregar clientes.', 'Fechar', {
          duration: 3000,
        });
      },
    });
  }

  onClientChange(clientId: string): void {
    this.selectedClientId = clientId;
    this.selectedAssessmentId = null; // Reset assessment selection
    this.assessmentControl.reset(); // Reset assessment form control
    this.assessments = [];
    this.questions = [];
    this.competencies = [];
    this.competencyForm.get('questionIds')?.reset([]);
    this.loadAssessments(clientId);
    this.loadCompetencies(clientId);
  }

  async loadAssessments(clientId: string): Promise<void> {
    this.isLoading = true;
    try {
      const q = query(
        collection(this.firestore, 'assessments'),
        where('clientId', '==', clientId)
      );
      const assessmentsSnap = await getDocs(q);
      this.assessments = assessmentsSnap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Avaliação sem nome',
      }));
    } catch (error) {
      console.error('Error loading assessments:', error);
      this.snackBar.open('Erro ao carregar as avaliações.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  onAssessmentChange(assessmentId: string): void {
    this.selectedAssessmentId = assessmentId;
    this.loadQuestions(assessmentId);
    this.loadCompetencies(this.selectedClientId!); // Recarregar competências para a avaliação selecionada
  }

  loadCompetencies(clientId: string): void {
    this.isLoading = true;
    this.competencyService.getCompetencies(clientId, this.selectedAssessmentId || undefined).subscribe({
      next: (data) => {
        this.competencies = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading competencies:', err);
        this.isLoading = false;
        this.snackBar.open('Erro ao carregar competências.', 'Fechar', {
          duration: 3000,
        });
      },
    });
  }

  async loadQuestions(assessmentId: string): Promise<void> {
    this.isLoading = true;
    this.questions = [];
    try {
      const assessmentRef = doc(
        this.firestore,
        'assessments',
        assessmentId
      );
      const assessmentSnap = await getDoc(assessmentRef);
      if (assessmentSnap.exists()) {
        const surveyJSON = assessmentSnap.data()['surveyJSON'];
        const questionMap = new Map<string, string>();

        if (surveyJSON && surveyJSON.pages) {
          surveyJSON.pages.forEach((page: any) => {
            if (page.elements) {
              page.elements.forEach((element: any) => {
                if (element.type === 'matrix' && element.rows) {
                  element.rows.forEach((row: any) => {
                    if (row.value && row.text) {
                      const questionId = `${element.name}_${row.value}`;
                      const questionText =
                        typeof row.text === 'object'
                          ? row.text.pt || row.value
                          : row.text;
                      if (!questionMap.has(questionId)) {
                        questionMap.set(questionId, questionText);
                      }
                    }
                  });
                } else if (element.name && element.title) {
                  const questionText =
                    typeof element.title === 'object'
                      ? element.title.pt || element.name
                      : element.title;
                  if (!questionMap.has(element.name)) {
                    questionMap.set(element.name, questionText);
                  }
                }
              });
            }
          });
        }
        this.questions = Array.from(questionMap, ([id, title]) => ({
          id,
          title,
        })).sort((a, b) => a.title.localeCompare(b.title));
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      this.snackBar.open(
        'Falha ao carregar a lista de perguntas.',
        'Fechar',
        {
          duration: 3000,
        }
      );
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  startEdit(competency: Competency): void {
    this.isEditing = true;
    this.editingId = competency.id ?? null;
    this.competencyForm.setValue({
      name: competency.name,
      description: competency.description,
      questionIds: competency.questionIds || [],
    });
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.editingId = null;
    this.competencyForm.reset();
  }

  saveCompetency(): void {
    if (!this.selectedClientId) {
      this.snackBar.open('Selecione um cliente primeiro.', 'Fechar', {
        duration: 3000,
      });
      return;
    }
    if (!this.selectedAssessmentId) {
      this.snackBar.open('Selecione uma avaliação primeiro.', 'Fechar', {
        duration: 3000,
      });
      return;
    }
    if (this.competencyForm.invalid) {
      this.snackBar.open(
        'Por favor, preencha todos os campos obrigatórios.',
        'Fechar',
        { duration: 3000 }
      );
      return;
    }

    // Verificar se há perguntas duplicadas
    const selectedQuestionIds = this.competencyForm.get('questionIds')?.value || [];
    const usedQuestionIds = new Set<string>();

    this.competencies.forEach(competency => {
      if (competency.id !== this.editingId) {
        competency.questionIds?.forEach(questionId => {
          usedQuestionIds.add(questionId);
        });
      }
    });

    const duplicateQuestions = selectedQuestionIds.filter((id: string) => usedQuestionIds.has(id));
    if (duplicateQuestions.length > 0) {
      const duplicateQuestionTitles = duplicateQuestions
        .map((id: string) => this.questions.find(q => q.id === id)?.title || id)
        .join(', ');

      this.snackBar.open(
        `As seguintes perguntas já estão sendo utilizadas em outras competências: ${duplicateQuestionTitles}`,
        'Fechar',
        { duration: 5000 }
      );
      return;
    }

    const formValue = {
      ...this.competencyForm.value,
      clientId: this.selectedClientId,
      assessmentId: this.selectedAssessmentId,
    };

    if (this.editingId) {
      this.competencyService
        .updateCompetency(this.editingId, formValue)
        .subscribe(() => {
          this.snackBar.open('Competência atualizada com sucesso!', 'Fechar', {
            duration: 2000,
          });
          this.loadCompetencies(this.selectedClientId!);
          this.cancelEdit();
        });
    } else {
      this.competencyService.addCompetency(formValue).subscribe(() => {
        this.snackBar.open('Competência criada com sucesso!', 'Fechar', {
          duration: 2000,
        });
        this.loadCompetencies(this.selectedClientId!);
        this.cancelEdit();
      });
    }
  }

  deleteCompetency(id: string): void {
    if (confirm('Tem certeza que deseja excluir esta competência?')) {
      this.competencyService.deleteCompetency(id).subscribe(() => {
        this.snackBar.open('Competência excluída com sucesso!', 'Fechar', {
          duration: 2000,
        });
        this.loadCompetencies(this.selectedClientId!);
      });
    }
  }

  getQuestionText(questionId: string): string {
    const question = this.questions.find((q) => q.id === questionId);
    return question ? question.title : questionId;
  }

  // Método para obter perguntas disponíveis (não utilizadas em outras competências)
  getAvailableQuestions(): Question[] {
    // Obter todas as perguntas já utilizadas em outras competências
    const usedQuestionIds = new Set<string>();

    this.competencies.forEach(competency => {
      // Não incluir a competência atual sendo editada
      if (competency.id !== this.editingId) {
        competency.questionIds?.forEach(questionId => {
          usedQuestionIds.add(questionId);
        });
      }
    });

    // Filtrar perguntas disponíveis
    return this.questions.filter(question => !usedQuestionIds.has(question.id));
  }

  // Método para obter perguntas já selecionadas na competência atual
  getSelectedQuestions(): Question[] {
    const selectedIds = this.competencyForm.get('questionIds')?.value || [];
    return this.questions.filter(question => selectedIds.includes(question.id));
  }

  // Método para obter todas as perguntas (disponíveis + selecionadas)
  getAllAvailableQuestions(): Question[] {
    const availableQuestions = this.getAvailableQuestions();
    const selectedQuestions = this.getSelectedQuestions();

    // Combinar perguntas disponíveis com as já selecionadas
    const allQuestions = [...availableQuestions, ...selectedQuestions];

    // Remover duplicatas e ordenar
    const uniqueQuestions = allQuestions.filter((question, index, self) =>
      index === self.findIndex(q => q.id === question.id)
    );

    return uniqueQuestions.sort((a, b) => a.title.localeCompare(b.title));
  }

  // Método para obter perguntas já utilizadas em outras competências
  getUsedQuestions(): Question[] {
    const usedQuestionIds = new Set<string>();

    this.competencies.forEach(competency => {
      // Não incluir a competência atual sendo editada
      if (competency.id !== this.editingId) {
        competency.questionIds?.forEach(questionId => {
          usedQuestionIds.add(questionId);
        });
      }
    });

    // Retornar perguntas utilizadas que existem na lista de perguntas
    return this.questions
      .filter(question => usedQuestionIds.has(question.id))
      .sort((a, b) => a.title.localeCompare(b.title));
  }
}
