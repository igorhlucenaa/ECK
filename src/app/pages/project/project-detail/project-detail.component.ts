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
  updateDoc,
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
import { MatSelectSearchModule } from 'mat-select-search';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    MaterialModule,
    MatSelectSearchModule,
    MatSelectModule,
  ],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.scss'],
})
export class ProjectDetailComponent implements OnInit {
  form: FormGroup = new FormGroup({
    name: new FormControl('', Validators.required),
    budget: new FormControl(''),
    deadline: new FormControl('', Validators.required),
    status: new FormControl('Ativo', Validators.required),
    description: new FormControl(''),
    responsible: new FormControl(''),
    clientId: new FormControl('', Validators.required),
    groupIds: new FormControl([], Validators.required), // Novo campo para selecionar grupos
  });

  filterDates = (date: Date | null): boolean => {
    const today = new Date();
    // Zera as horas, minutos, segundos e milissegundos para comparar apenas a data
    today.setHours(0, 0, 0, 0);
    return date ? date >= today : false;
  };

  isEditMode = false;
  projectId: string | null = null;
  clientId: string | null = null;
  clients: { id: string; name: string }[] = [];
  groups: { id: string; name: string }[] = []; // Lista de grupos de usuários
  usersInGroups: { id: string; name: string }[] = []; // Lista de usuários para cada grupo
  isLoading = false;

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
        this.loadClients();
        this.loadUserGroups(); // Carregar grupos de usuários
      } else if (this.clientId) {
        this.form.get('clientId')?.setValue(this.clientId);
      } else {
        this.snackBar.open(
          'Cliente não identificado. Redirecionando...',
          'Fechar',
          { duration: 3000 }
        );
        this.router.navigate(['/projects']);
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
        name: doc.data()['companyName'] || 'Sem Nome',
      }));
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open('Erro ao carregar clientes.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async loadUserGroups(): Promise<void> {
    try {
      const groupsCollection = collection(this.firestore, 'userGroups');
      const snapshot = await getDocs(groupsCollection);
      this.groups = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data()['name'],
      }));
    } catch (error) {
      console.error('Erro ao carregar grupos de usuários:', error);
      this.snackBar.open('Erro ao carregar grupos de usuários.', 'Fechar', {
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
        const projectData = projectSnapshot.data();

        // Converter deadline para um objeto Date, se necessário
        if (projectData['deadline'] && projectData['deadline'].seconds) {
          projectData['deadline'] = new Date(
            projectData['deadline'].seconds * 1000
          );
        }

        this.form.patchValue(projectData);
        await this.updateUsersInGroups(); // Carregar usuários dos grupos selecionados
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

  async updateUsersInGroups(): Promise<void> {
    const selectedGroups = this.form.get('groupIds')?.value || [];
    const users: { id: string; name: string }[] = [];

    for (const groupId of selectedGroups) {
      const groupDocRef = doc(this.firestore, `userGroups/${groupId}`);
      const groupDoc = await getDoc(groupDocRef);
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        const userIds = groupData?.['userIds'] || [];
        for (const userId of userIds) {
          const userDocRef = doc(this.firestore, `users/${userId}`);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            users.push({ id: userDoc.id, name: userDoc.data()['name'] });
          }
        }
      }
    }
    this.usersInGroups = users;
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
        const projectRef = await addDoc(projectsCollection, {
          ...projectData,
          createdAt: new Date(),
        });
        this.projectId = projectRef.id; // Atualiza o projectId
      }

      // Atualizar os usuários associados aos grupos
      await this.updateUserProjects();

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

  async updateUserProjects(): Promise<void> {
    const selectedGroups = this.form.get('groupIds')?.value || [];

    for (const groupId of selectedGroups) {
      // Carregar o grupo
      const groupDocRef = doc(this.firestore, `userGroups/${groupId}`);
      const groupDoc = await getDoc(groupDocRef);

      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        const userIds = groupData?.['userIds'] || [];

        // Iterar sobre os usuários do grupo e atualizar o campo "project"
        for (const userId of userIds) {
          const userDocRef = doc(this.firestore, `users/${userId}`);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const userProject = userData?.['project'] || null;

            // Se o projeto estiver vazio, atribuir o ID do projeto
            if (!userProject) {
              await updateDoc(userDocRef, { project: this.projectId });
            } else {
              // Caso contrário, garantir que o projeto esteja atualizado
              await updateDoc(userDocRef, { project: this.projectId });
            }
          }
        }
      }
    }
  }
}
