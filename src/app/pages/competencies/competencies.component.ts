import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { Firestore, collection, getDocs, getDoc, addDoc, doc, updateDoc, deleteDoc, query, where } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../services/apps/authentication/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { CompetencyDialogComponent } from './competency-dialog/competency-dialog.component';

interface Competency {
  id: string;
  name: string;
  description: string;
  clientId: string;
  questions?: Question[]; // Torna opcional
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

@Component({
  selector: 'app-competencies',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './competencies.component.html',
  styleUrls: ['./competencies.component.scss']
})
export class CompetenciesComponent implements OnInit {
  competencies: Competency[] = []; // Sempre inicializa como array vazio
  clients: Client[] = []; // Sempre inicializa como array vazio
  selectedClientId: string = '';
  userRole: string = '';
  userClientId: string = '';
  isLoading = false;

  constructor(
    private firestore: Firestore,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadUserData();
    await this.loadClients();
    await this.loadCompetencies();
  }

  private async loadUserData(): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (currentUser) {
      this.userRole = currentUser.role;
      this.userClientId = currentUser.clientId || '';

      // Se for admin_client, define o cliente automaticamente
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

  private async loadCompetencies(): Promise<void> {
    if (!this.selectedClientId) {
      this.competencies = []; // Garante que seja sempre um array vazio
      return;
    }

    try {
      this.isLoading = true;
      const competenciesCollection = collection(this.firestore, 'competencies');
      const q = query(competenciesCollection, where('clientId', '==', this.selectedClientId));
      const snapshot = await getDocs(q);

      this.competencies = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data['name'] || 'Sem Nome',
          description: data['description'] || 'Sem Descrição',
          clientId: data['clientId'] || this.selectedClientId,
          questions: data['questions'] || [], // Garante que questions seja sempre um array
          createdAt: data['createdAt'] ? new Date(data['createdAt'].seconds * 1000) : new Date(),
          updatedAt: data['updatedAt'] ? new Date(data['updatedAt'].seconds * 1000) : new Date()
        } as Competency;
      });

      // Ordena por data de criação
      this.competencies.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.error('Erro ao carregar competências:', error);
      this.snackBar.open('Erro ao carregar competências', 'Fechar', { duration: 3000 });
      this.competencies = []; // Em caso de erro, garante que seja um array vazio
    } finally {
      this.isLoading = false;
    }
  }

  onClientChange(): void {
    // Garante que competencies seja limpo antes de carregar novos dados
    this.competencies = [];
    this.loadCompetencies();
  }

  openCompetencyDialog(competency?: Competency): void {
    const dialogRef = this.dialog.open(CompetencyDialogComponent, {
      width: '800px',
      data: {
        competency,
        clientId: this.selectedClientId,
        clients: this.clients
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        await this.loadCompetencies();
        this.snackBar.open(
          competency ? 'Competência atualizada com sucesso!' : 'Competência criada com sucesso!',
          'Fechar',
          { duration: 3000 }
        );
      }
    });
  }

  async deleteCompetency(competency: Competency): Promise<void> {
    if (confirm(`Tem certeza que deseja excluir a competência "${competency.name}"?`)) {
      try {
        await deleteDoc(doc(this.firestore, 'competencies', competency.id));
        await this.loadCompetencies();
        this.snackBar.open('Competência excluída com sucesso!', 'Fechar', { duration: 3000 });
      } catch (error) {
        console.error('Erro ao excluir competência:', error);
        this.snackBar.open('Erro ao excluir competência', 'Fechar', { duration: 3000 });
      }
    }
  }

  canEdit(): boolean {
    return this.userRole === 'admin_master' || this.userRole === 'admin_client';
  }

  // Método helper para verificar se uma competência é válida
  isValidCompetency(competency: Competency | undefined): boolean {
    if (!competency || !competency.id || !competency.name) {
      return false;
    }
    return Array.isArray(competency.questions);
  }

  // Método helper para obter o número seguro de perguntas
  getSafeQuestionsCount(competency: Competency | undefined): number {
    return this.isValidCompetency(competency) && competency?.questions ? competency.questions.length : 0;
  }

  // Helper methods for template expressions
  getRequiredQuestionsCount(questions: Question[] | undefined): number {
    return questions && Array.isArray(questions) ? questions.filter(q => q && q.required).length : 0;
  }

  getLikertQuestionsCount(questions: Question[] | undefined): number {
    return questions && Array.isArray(questions) ? questions.filter(q => q && q.type === 'likert').length : 0;
  }

  getMultipleChoiceQuestionsCount(questions: Question[] | undefined): number {
    return questions && Array.isArray(questions) ? questions.filter(q => q && q.type === 'multiple_choice').length : 0;
  }

  getQuestionNumber(index: number): number {
    return index + 1;
  }

  getQuestionText(question: Question | undefined): string {
    return question && question.text ? question.text : '';
  }

  getQuestionTypeLabel(question: Question | undefined): string {
    if (!question || !question.type) return '';
    const types = {
      'likert': 'Escala Likert',
      'multiple_choice': 'Múltipla Escolha',
      'text': 'Texto Livre',
      'number': 'Número'
    };
    return types[question.type as keyof typeof types] || question.type;
  }

  isQuestionRequired(question: Question | undefined): boolean {
    return question ? question.required : false;
  }

  isMultipleChoiceQuestion(question: Question | undefined): boolean {
    return question ? question.type === 'multiple_choice' : false;
  }

  getQuestionOptions(question: Question | undefined): string[] {
    return question && question.options && Array.isArray(question.options) ? question.options : [];
  }
}
