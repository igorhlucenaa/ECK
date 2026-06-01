import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Location, CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  Firestore,
  doc,
  getDoc,
  getDocs,
  collection,
  updateDoc,
  query,
  where,
} from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

@Component({
  selector: 'app-edit-group',
  standalone: true,
  imports: [MaterialModule, CommonModule, ReactiveFormsModule, RouterModule, TranslateModule],
  templateUrl: './edit-group.component.html',
  styleUrl: './edit-group.component.scss',
})
export class EditGroupComponent implements OnInit {
  isLoading = true;
  isSaving = false;
  groupForm!: FormGroup;
  groupId = '';

  // Sidebar info
  groupInitial = '?';
  groupName = '';
  memberCount = 0;

  clients: { id: string; name: string }[] = [];
  projects: { id: string; name: string }[] = [];
  users: { id: string; name: string; surname: string }[] = [];
  private currentRole: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private location: Location,
    private authService: AuthService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId') || '';
    if (this.groupId) {
      this.initForm();
      this.loadAll();
    } else {
      this.router.navigate(['/users']);
    }
  }

  private initForm(): void {
    this.groupForm = this.fb.group({
      name:        ['', Validators.required],
      description: [''],
      clientId:    ['', Validators.required],
      allProjects: [false],
      projectIds:  [[]],
      userIds:     [[]],
    });

    // Reload projects + users when client changes
    this.groupForm.get('clientId')!.valueChanges.subscribe(id => {
      if (id) { this.loadProjects(id); this.loadUsers(id); }
    });
  }

  private async loadAll(): Promise<void> {
    try {
      this.currentRole = await this.authService.getCurrentUserRole();
      const currentRole = this.currentRole;

      // Load clients
      if (currentRole === 'admin_client') {
        const clientIds = await this.authService.getCurrentUserClientIds();
        if (clientIds.length > 0) {
          const snaps = await Promise.all(clientIds.map(id => getDoc(doc(this.firestore, `clients/${id}`))));
          this.clients = snaps
            .filter(s => s.exists())
            .map(s => ({ id: s.id, name: (s.data() as any)['companyName'] || '' }));
        }
        this.groupForm.get('clientId')!.disable();
      } else {
        const snap = await getDocs(collection(this.firestore, 'clients'));
        this.clients = snap.docs.map(d => ({ id: d.id, name: (d.data() as any)['companyName'] || '' }));
      }

      // Load group
      const groupSnap = await getDoc(doc(this.firestore, `userGroups/${this.groupId}`));
      if (!groupSnap.exists()) {
        this.snackBar.open(this.translate.instant('Grupo não encontrado.'), this.translate.instant('Fechar'), { duration: 3000 });
        this.router.navigate(['/users']);
        return;
      }

      const data = groupSnap.data() as any;
      this.groupInitial = (data['name'] || '?')[0].toUpperCase();
      this.groupName    = data['name'] || '';
      const savedUserIds: string[] = data['userIds'] || [];
      this.memberCount  = savedUserIds.length;

      // Load projects + users for the saved clientId
      if (data['clientId']) {
        await Promise.all([
          this.loadProjects(data['clientId']),
          this.loadUsers(data['clientId']),
        ]);
      }

      this.groupForm.patchValue({
        name:        data['name']        || '',
        description: data['description'] || '',
        clientId:    data['clientId']    || '',
        allProjects: data['allProjects'] === true,
        projectIds:  data['projectIds']  || [],
        userIds:     savedUserIds,
      });
    } catch {
      this.snackBar.open(this.translate.instant('Erro ao carregar grupo.'), this.translate.instant('Fechar'), { duration: 3000 });
      this.router.navigate(['/users']);
    } finally {
      this.isLoading = false;
    }
  }

  async loadProjects(clientId: string): Promise<void> {
    try {
      const snap = await getDocs(
        query(collection(this.firestore, 'projects'), where('clientId', '==', clientId))
      );
      this.projects = snap.docs
        .map(d => ({ id: d.id, name: (d.data() as any)['name'] || '' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    } catch {
      this.projects = [];
    }
  }

  async loadUsers(clientId: string): Promise<void> {
    if (!this.currentRole) {
      this.currentRole = await this.authService.getCurrentUserRole();
    }
    try {
      const usersCol = collection(this.firestore, 'users');

      if (this.currentRole === 'admin_master') {
        const snap = await getDocs(
          query(usersCol, where('role', 'in', ['viewer', 'admin_client']))
        );
        const map = new Map<string, any>();
        snap.docs.forEach(d => map.set(d.id, d));
        this.users = Array.from(map.values())
          .map(d => ({ id: d.id, name: (d.data() as any)['name'] || '', surname: (d.data() as any)['surname'] || '' }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      } else {
        const [snapLegacy, snapArray] = await Promise.all([
          getDocs(query(usersCol, where('client', '==', clientId))),
          getDocs(query(usersCol, where('clients', 'array-contains', clientId))),
        ]);
        const map = new Map<string, any>();
        [...snapLegacy.docs, ...snapArray.docs].forEach(d => map.set(d.id, d));
        this.users = Array.from(map.values())
          .map(d => ({ id: d.id, name: (d.data() as any)['name'] || '', surname: (d.data() as any)['surname'] || '' }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      }
    } catch {
      this.users = [];
    }
  }

  get clientName(): string {
    const id = this.groupForm?.get('clientId')?.value;
    return this.clients.find(c => c.id === id)?.name || '—';
  }

  get selectedMemberCount(): number {
    return this.groupForm?.get('userIds')?.value?.length || 0;
  }

  async save(): Promise<void> {
    if (this.groupForm.invalid || this.isSaving) return;
    this.isSaving = true;
    try {
      const { name, description, allProjects, projectIds, userIds } = this.groupForm.value;
      const clientId = this.groupForm.get('clientId')?.value;
      await updateDoc(doc(this.firestore, `userGroups/${this.groupId}`), {
        name,
        description,
        clientId,
        allProjects: allProjects === true,
        projectIds: allProjects ? [] : (projectIds || []),
        userIds,
        updatedAt: new Date(),
      });
      this.snackBar.open(this.translate.instant('Grupo atualizado com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
      this.router.navigate(['/users']);
    } catch {
      this.snackBar.open(this.translate.instant('Erro ao salvar grupo.'), this.translate.instant('Fechar'), { duration: 3000 });
    } finally {
      this.isSaving = false;
    }
  }

  goBack(): void {
    this.location.back();
  }
}
