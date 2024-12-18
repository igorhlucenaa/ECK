import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
} from '@angular/fire/firestore';
import {
  FormGroup,
  FormControl,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule, Location } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, MaterialModule],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.scss'],
})
export class ProjectDetailComponent implements OnInit {
  form: FormGroup = new FormGroup({
    name: new FormControl('', Validators.required),
    budget: new FormControl('', [
      Validators.required,
      Validators.min(1), // Certifique-se de que o orçamento seja maior que 0
    ]),
    deadline: new FormControl('', Validators.required),
    status: new FormControl('Ativo', Validators.required),
    description: new FormControl(''),
    responsible: new FormControl(''),
  });

  isEditMode = false;
  projectId: string | null = null;
  clientId: string | null = null;

  isLoading = false; // Flag para controle do carregamento

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');
    this.route.queryParamMap.subscribe((params) => {
      this.clientId = params.get('clientId'); // Captura o clientId dos queryParams
      console.log('Client ID:', this.clientId);
      if (!this.clientId) {
        this.snackBar.open(
          'Cliente não identificado. Redirecionando...',
          'Fechar',
          { duration: 3000 }
        );
        this.router.navigate(['/projects']); // Redireciona de volta à lista
        return;
      }

      if (this.projectId) {
        this.isEditMode = true;
        this.loadProjectDetails(this.projectId);
      }
    });
  }

  async loadProjectDetails(id: string): Promise<void> {
    this.isLoading = true;
    try {
      const projectDoc = doc(this.firestore, `projects/${id}`);
      const projectSnapshot = await getDoc(projectDoc);

      if (projectSnapshot.exists()) {
        this.form.patchValue(projectSnapshot.data());
      } else {
        this.snackBar.open('Projeto não encontrado!', 'Fechar', {
          duration: 3000,
        });
        this.router.navigate(['/projects']);
      }
    } catch (error) {
      console.error('Erro ao carregar projeto:', error);
      this.snackBar.open('Erro ao carregar projeto.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isLoading = false;
    }
  }

  async saveProject(): Promise<void> {
    if (this.form.invalid || !this.clientId) {
      this.snackBar.open('Preencha todos os campos obrigatórios!', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    this.isLoading = true;

    const projectData = {
      ...this.form.value,
      clientId: this.clientId, // Inclui o clientId no projeto
      updatedAt: new Date(),
    };

    try {
      if (this.isEditMode && this.projectId) {
        const projectDocRef = doc(this.firestore, `projects/${this.projectId}`);
        await setDoc(projectDocRef, projectData, { merge: true });
      } else {
        const projectsCollection = collection(this.firestore, 'projects');
        await addDoc(projectsCollection, {
          ...projectData,
          createdAt: new Date(),
        });
      }

      this.snackBar.open(
        this.isEditMode
          ? 'Projeto atualizado com sucesso!'
          : 'Projeto adicionado com sucesso!',
        'Fechar',
        { duration: 3000 }
      );
      this.router.navigate(['/projects']);
    } catch (error) {
      console.error('Erro ao salvar projeto:', error);
      this.snackBar.open('Erro ao salvar projeto.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isLoading = false;
    }
  }

  cancel() {
    this.router.navigate(['/projects']);
  }

  goBack(): void {
    this.location.back();
  }
}
