import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  arrayUnion,
  arrayRemove,
} from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';

@Component({
  selector: 'app-edit-user',
  standalone: true,
  imports: [MaterialModule, CommonModule, ReactiveFormsModule, RouterModule, TranslateModule, AppPageHeaderComponent],
  templateUrl: './edit-user.component.html',
  styleUrl: './edit-user.component.scss',
})
export class EditUserComponent implements OnInit {
  isLoading = true;
  isSaving = false;
  userForm!: FormGroup;
  userId = '';
  userInitial = '?';
  userName = '';

  clients: { id: string; name: string }[] = [];
  projects: { id: string; name: string }[] = [];

  // Grupos para viewer
  allGroups: { id: string; name: string; clientId: string; clientName: string; projectIds: string[]; projectNames: string[] }[] = [];
  filteredGroups: typeof this.allGroups = [];
  clientFilterValue = '';
  derivedClientName = '';
  derivedProjectNames: string[] = [];

  roles = [
    { label: 'Admin Master', value: 'admin_master' },
    { label: 'Admin Cliente', value: 'admin_client' },
    { label: 'Visualizador', value: 'viewer' },
  ];

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
    this.userId = this.route.snapshot.paramMap.get('id') || '';
    if (this.userId) {
      this.initForm();
      this.loadAll();
    } else {
      this.router.navigate(['/users']);
    }
  }

  private initForm(): void {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      surname: ['', Validators.required],
      email: [{ value: '', disabled: true }],
      role: ['', Validators.required],
      clients: [[] as string[]],
      groups: [[] as string[]],
      project: [''],
    });
  }

  private groupsRequiredValidator() {
    return (ctrl: any) =>
      Array.isArray(ctrl.value) && ctrl.value.length > 0 ? null : { groupRequired: true };
  }

  get selectedRole(): string { return this.userForm.get('role')?.value || ''; }

  get projectName(): string {
    const id = this.userForm.get('project')?.value;
    return this.projects.find(p => p.id === id)?.name || '';
  }

  onRoleChange(role: string): void {
    const clientsCtrl = this.userForm.get('clients')!;
    const groupsCtrl = this.userForm.get('groups')!;
    const projectCtrl = this.userForm.get('project')!;

    clientsCtrl.clearValidators(); groupsCtrl.clearValidators(); projectCtrl.clearValidators();
    projectCtrl.setValue(''); this.projects = [];
    this.derivedClientName = ''; this.derivedProjectNames = [];

    if (role === 'viewer') {
      groupsCtrl.setValidators([this.groupsRequiredValidator()]);
      if (this.allGroups.length === 0) this.loadAllGroups().then(() => { this.filteredGroups = [...this.allGroups]; });
      else this.filteredGroups = [...this.allGroups];
    } else if (role === 'admin_client') {
      clientsCtrl.setValidators([Validators.required]);
    }

    clientsCtrl.updateValueAndValidity();
    groupsCtrl.updateValueAndValidity();
  }

  onClientFilterChange(clientId: string): void {
    this.clientFilterValue = clientId;
    this.filteredGroups = clientId ? this.allGroups.filter(g => g.clientId === clientId) : [...this.allGroups];
    const cur: string[] = this.userForm.get('groups')?.value || [];
    const valid = cur.filter(id => this.filteredGroups.some(g => g.id === id));
    if (valid.length !== cur.length) { this.userForm.get('groups')?.setValue(valid); this.onGroupsChange(valid); }
  }

  onGroupsChange(groupIds: string[]): void {
    if (!groupIds?.length) { this.derivedClientName = ''; this.derivedProjectNames = []; return; }
    const selected = this.allGroups.filter(g => groupIds.includes(g.id));
    this.derivedClientName = selected[0]?.clientName || '';
    const ps = new Set<string>();
    selected.forEach(g => g.projectNames.forEach(p => ps.add(p)));
    this.derivedProjectNames = [...ps];
  }

  private async loadAllGroups(): Promise<void> {
    try {
      const currentRole = await this.authService.getCurrentUserRole();
      const groupsSnap = currentRole === 'admin_client'
        ? await getDocs(query(collection(this.firestore, 'userGroups'),
            where('clientId', 'in', await this.authService.getCurrentUserClientIds())))
        : await getDocs(collection(this.firestore, 'userGroups'));

      const clientsSnap = await getDocs(collection(this.firestore, 'clients'));
      const clientMap = new Map(clientsSnap.docs.map(d => [d.id, (d.data() as any)['companyName'] || '']));
      const projectsSnap = await getDocs(collection(this.firestore, 'projects'));
      const projectMap = new Map(projectsSnap.docs.map(d => [d.id, (d.data() as any)['name'] || '']));

      this.allGroups = groupsSnap.docs.map(d => {
        const data = d.data() as any;
        const projectIds: string[] = data['projectIds'] || [];
        return {
          id: d.id, name: data['name'] || '',
          clientId: data['clientId'] || '', clientName: clientMap.get(data['clientId']) || '',
          projectIds, projectNames: projectIds.map(pid => projectMap.get(pid) || '').filter(Boolean),
        };
      }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      this.filteredGroups = [...this.allGroups];
    } catch (e) { console.error('Erro ao carregar grupos:', e); }
  }

  private async loadAll(): Promise<void> {
    try {
      const currentRole = await this.authService.getCurrentUserRole();

      if (currentRole === 'admin_client') {
        this.roles = this.roles.filter(r => ['admin_client', 'viewer'].includes(r.value));
        const clientId = await this.authService.getCurrentClientId();
        if (clientId) {
          const clientDoc = await getDoc(doc(this.firestore, `clients/${clientId}`));
          this.clients = clientDoc.exists()
            ? [{ id: clientId, name: (clientDoc.data() as any)['companyName'] || '' }]
            : [];
        }
      } else {
        const snap = await getDocs(collection(this.firestore, 'clients'));
        this.clients = snap.docs.map(d => ({ id: d.id, name: (d.data() as any)['companyName'] || '' }));
      }

      const userSnap = await getDoc(doc(this.firestore, `users/${this.userId}`));
      if (!userSnap.exists()) {
        this.snackBar.open(this.translate.instant('Usuário não encontrado.'), this.translate.instant('Fechar'), { duration: 3000 });
        this.router.navigate(['/users']);
        return;
      }

      const data = userSnap.data() as any;
      this.userInitial = (data['name'] || '?')[0].toUpperCase();
      this.userName = `${data['name'] || ''} ${data['surname'] || ''}`.trim();

      const existingClients: string[] = Array.isArray(data['clients'])
        ? data['clients'] : data['client'] ? [data['client']] : [];

      this.userForm.patchValue({
        name: data['name'] || '',
        surname: data['surname'] || '',
        email: data['email'] || '',
        role: data['role'] || '',
        clients: existingClients,
      });

      if (data['role'] === 'viewer') {
        // Carregar grupos e detectar grupos atuais do viewer via Firestore
        await this.loadAllGroups();
        const currentGroupsSnap = await getDocs(
          query(collection(this.firestore, 'userGroups'), where('userIds', 'array-contains', this.userId))
        );
        const currentGroupIds = currentGroupsSnap.docs.map(d => d.id);
        this.userForm.get('groups')?.setValue(currentGroupIds);
        this.onGroupsChange(currentGroupIds);
        this.filteredGroups = [...this.allGroups];
      }

      this.onRoleChange(data['role'] || '');
    } catch {
      this.snackBar.open(this.translate.instant('Erro ao carregar usuário.'), this.translate.instant('Fechar'), { duration: 3000 });
      this.router.navigate(['/users']);
    } finally {
      this.isLoading = false;
    }
  }

  async save(): Promise<void> {
    if (this.userForm.invalid || this.isSaving) return;
    this.isSaving = true;
    try {
      const { name, surname, role, clients } = this.userForm.value;
      const selectedGroups: string[] = this.userForm.get('groups')?.value || [];
      const updateData: any = { name, surname, role, updatedAt: new Date() };

      if (role === 'viewer') {
        // Derivar cliente e projetos dos grupos selecionados
        const groupObjs = this.allGroups.filter(g => selectedGroups.includes(g.id));
        const derivedClientId = groupObjs[0]?.clientId || '';
        const derivedProjectIds = [...new Set(groupObjs.flatMap(g => g.projectIds))];
        updateData.groups = selectedGroups;
        updateData.clients = derivedClientId ? [derivedClientId] : [];
        updateData.client = derivedClientId;
        updateData.projects = derivedProjectIds;

        // Sincronizar userIds nos grupos
        const oldGroupsSnap = await getDocs(
          query(collection(this.firestore, 'userGroups'), where('userIds', 'array-contains', this.userId))
        );
        const oldGroupIds = oldGroupsSnap.docs.map(d => d.id);
        const removed = oldGroupIds.filter(id => !selectedGroups.includes(id));
        const added = selectedGroups.filter(id => !oldGroupIds.includes(id));
        await Promise.all([
          ...removed.map(gId => updateDoc(doc(this.firestore, 'userGroups', gId), { userIds: arrayRemove(this.userId) })),
          ...added.map(gId => updateDoc(doc(this.firestore, 'userGroups', gId), { userIds: arrayUnion(this.userId) })),
        ]);
      } else {
        updateData.clients = clients || [];
      }

      await updateDoc(doc(this.firestore, `users/${this.userId}`), updateData);
      this.snackBar.open(this.translate.instant('Usuário atualizado com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
      this.router.navigate(['/users']);
    } catch (e) {
      console.error(e);
      this.snackBar.open(this.translate.instant('Erro ao salvar usuário.'), this.translate.instant('Fechar'), { duration: 3000 });
    } finally {
      this.isSaving = false;
    }
  }

  get clientNames(): string {
    const ids: string[] = this.userForm?.get('clients')?.value || [];
    if (!ids.length) return '—';
    return ids
      .map(id => this.clients.find(c => c.id === id)?.name || id)
      .join(', ');
  }

  goBack(): void {
    this.location.back();
  }
}
