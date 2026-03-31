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
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { UsersComponent } from '../../users/users.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    MaterialModule,
    MatSelectSearchModule,
    MatSelectModule,
    AppPageHeaderComponent,
    TranslateModule,
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

  readonly today: Date = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  filterDates = (date: Date | null): boolean => {
    return date ? date >= this.today : false;
  };

  isEditMode = false;
  projectId: string | null = null;
  clientId: string | null = null;
  clients: { id: string; name: string }[] = [];
  groups: { id: string; name: string }[] = [];
  usersInGroups: { id: string; name: string; groupNames: string[] }[] = [];
  isLoading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private location: Location,
    private authService: AuthService,
    private dialog: MatDialog
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
        this.loadUserGroups(); // Também carrega grupos para admin_client
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
    const selectedGroupIds: string[] = this.form.get('groupIds')?.value || [];
    // Map keyed by userId garante deduplicação — usuários em múltiplos grupos
    // aparecem uma única vez, acumulando os grupos a que pertencem
    const userMap = new Map<string, { id: string; name: string; groupNames: string[] }>();

    for (const groupId of selectedGroupIds) {
      const groupName = this.groups.find(g => g.id === groupId)?.name ?? groupId;
      const groupDocRef = doc(this.firestore, `userGroups/${groupId}`);
      const groupDoc = await getDoc(groupDocRef);
      if (!groupDoc.exists()) continue;

      const userIds: string[] = groupDoc.data()?.['userIds'] ?? [];
      for (const userId of userIds) {
        if (userMap.has(userId)) {
          // Já carregado — só adiciona o grupo ao array
          userMap.get(userId)!.groupNames.push(groupName);
        } else {
          const userDoc = await getDoc(doc(this.firestore, `users/${userId}`));
          if (userDoc.exists()) {
            userMap.set(userId, {
              id: userDoc.id,
              name: userDoc.data()['name'],
              groupNames: [groupName],
            });
          }
        }
      }
    }
    this.usersInGroups = Array.from(userMap.values());
  }

  async saveProject(): Promise<void> {
    if (this.form.invalid) {
      this.snackBar.open('Preencha todos os campos obrigatórios!', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    const deadlineValue = this.form.get('deadline')?.value;
    const deadlineDate = deadlineValue ? new Date(deadlineValue) : null;
    if (deadlineDate) deadlineDate.setHours(0, 0, 0, 0);
    if (!deadlineDate || deadlineDate < this.today) {
      this.snackBar.open('O prazo de preenchimento não pode ser uma data anterior a hoje.', 'Fechar', {
        duration: 4000,
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

  openUsersDialog(): void {
    const ref = this.dialog.open(UsersComponent, {
      width: '90vw',
      maxWidth: '1200px',
      height: '85vh',
      panelClass: 'users-dialog-panel',
    });
    ref.afterClosed().subscribe(() => {
      this.loadUserGroups();
    });
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
