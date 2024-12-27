import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
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
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

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
    clientId: new FormControl('', Validators.required), // Dropdown de cliente
  });

  isEditMode = false;
  projectId: string | null = null;
  clientId: string | null = null;
  clients: { id: string; name: string }[] = []; // Lista de clientes
  isLoading = false; // Flag para controle do carregamento

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private location: Location,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');
    this.route.queryParamMap.subscribe(async (params) => {
      this.clientId = params.get('clientId');

      const currentUser = await this.authService.getCurrentUser();

      if (!currentUser) {
        this.snackBar.open('Erro ao obter dados do usuário.', 'Fechar', {
          duration: 3000,
        });
        return;
      }

      if (currentUser.role === 'admin_master') {
        this.loadClients(); // Carregar lista de clientes para admin_master
      } else if (this.clientId) {
        this.form.get('clientId')?.setValue(this.clientId);
      } else {
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

  async loadClients(): Promise<void> {
    try {
      const clientsCollection = collection(this.firestore, 'clients');
      const snapshot = await getDocs(clientsCollection);
      this.clients = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'] || 'Sem Nome',
      }));
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open('Erro ao carregar clientes.', 'Fechar', {
        duration: 3000,
      });
    }
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
    if (this.form.invalid) {
      this.snackBar.open('Preencha todos os campos obrigatórios!', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    this.isLoading = true;

    const projectData = {
      ...this.form.value,
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
