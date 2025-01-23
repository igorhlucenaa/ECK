import { Component, OnInit } from '@angular/core';
import {
  FormGroup,
  FormControl,
  FormBuilder,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  Firestore,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

interface Question {
  labelControl: FormControl<string | null>;
  type: string;
  options: { control: FormControl<string | null> }[];
}

@Component({
  selector: 'app-create-assessment',
  standalone: true,
  templateUrl: './create-assessment.component.html',
  styleUrls: ['./create-assessment.component.scss'],
  imports: [
    CommonModule,
    MaterialModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    ReactiveFormsModule,
  ],
})
export class CreateAssessmentComponent implements OnInit {
  form: FormGroup;
  questionList: Question[] = [];
  clients: { id: string; name: string }[] = [];
  userRole: string | null = null;

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    this.form = this.fb.group({
      clientId: ['', Validators.required],
      name: ['', Validators.required],
      description: ['', Validators.required],
    });
  }

  async ngOnInit(): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    this.userRole = currentUser?.role || null;

    if (this.userRole === 'admin_client') {
      // Usuário admin_client só vê o cliente associado
      const clientId = currentUser?.clientId || '';

      if (clientId) {
        const clientName = await this.getClientName(clientId);
        this.clients = [
          {
            id: clientId,
            name: clientName || 'Cliente Indefinido',
          },
        ];
        this.form.get('clientId')?.setValue(clientId);
        this.form.get('clientId')?.disable();
      }
    } else if (this.userRole === 'admin_master') {
      // Usuário admin_master vê todos os clientes
      await this.loadClients();
    }
  }

  private async getClientName(clientId: string): Promise<string | null> {
    try {
      const clientDocRef = doc(this.firestore, 'clients', clientId);
      const clientDoc = await getDoc(clientDocRef);

      if (clientDoc.exists()) {
        return clientDoc.data()['companyName'] || null;
      } else {
        console.warn(`Cliente com ID ${clientId} não encontrado.`);
        return null;
      }
    } catch (error) {
      console.error('Erro ao buscar o nome do cliente:', error);
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

  onClientChange(event: any): void {
    console.log('Cliente selecionado:', event.value);
  }

  addQuestion(type: string): void {
    const newQuestion: Question = {
      labelControl: new FormControl<string | null>('', Validators.required),
      type,
      options: [],
    };

    if (type === 'select' || type === 'checkbox') {
      newQuestion.options.push({ control: new FormControl<string | null>('') });
    }

    this.questionList.push(newQuestion);
  }

  removeQuestion(index: number): void {
    this.questionList.splice(index, 1);
  }

  addOption(questionIndex: number): void {
    this.questionList[questionIndex].options.push({
      control: new FormControl<string | null>('', Validators.required),
    });
  }

  removeOption(questionIndex: number, optionIndex: number): void {
    this.questionList[questionIndex].options.splice(optionIndex, 1);
  }

  async saveForm(): Promise<void> {
    if (this.form.invalid) {
      console.error('O formulário é inválido.');
      return;
    }

    try {
      // Aguarde o retorno do usuário autenticado
      const currentUser = await this.authService.getCurrentUser();

      if (!currentUser) {
        console.error('Erro ao obter usuário autenticado.');
        return;
      }

      const formData = {
        ...this.form.value,
        questions: this.questionList.map((q) => ({
          label: q.labelControl.value,
          type: q.type,
          options: q.options.map((opt) => opt.control.value),
        })),
        createdBy: {
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
        },
        createdAt: new Date(),
      };

      const assessmentsCollection = collection(this.firestore, 'assessments');
      await addDoc(assessmentsCollection, formData);

      console.log('Formulário salvo com sucesso:', formData);
      this.snackBar.open('Formulário salvo com sucesso!', 'Fechar', {
        duration: 3000,
      });
      this.router.navigate(['/assessments']);
    } catch (error) {
      console.error('Erro ao salvar formulário:', error);
      this.snackBar.open(
        'Erro ao salvar formulário. Tente novamente.',
        'Fechar',
        {
          duration: 3000,
        }
      );
    }
  }
}
