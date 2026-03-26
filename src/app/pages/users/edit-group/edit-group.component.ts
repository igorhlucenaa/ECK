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
  users: { id: string; name: string; surname: string }[] = [];

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
      userIds:     [[]],
    });

    // Reload users when client changes
    this.groupForm.get('clientId')!.valueChanges.subscribe(id => {
      if (id) this.loadUsers(id);
    });
  }

  private async loadAll(): Promise<void> {
    try {
      const currentRole = await this.authService.getCurrentUserRole();

      // Load clients
      if (currentRole === 'admin_client') {
        const clientId = await this.authService.getCurrentClientId();
        if (clientId) {
          const snap = await getDoc(doc(this.firestore, `clients/${clientId}`));
          this.clients = snap.exists()
            ? [{ id: clientId, name: (snap.data() as any)['companyName'] || '' }]
            : [];
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

      // Load users for the saved clientId
      if (data['clientId']) {
        await this.loadUsers(data['clientId']);
      }

      this.groupForm.patchValue({
        name:        data['name']        || '',
        description: data['description'] || '',
        clientId:    data['clientId']    || '',
        userIds:     savedUserIds,
      });
    } catch {
      this.snackBar.open(this.translate.instant('Erro ao carregar grupo.'), this.translate.instant('Fechar'), { duration: 3000 });
      this.router.navigate(['/users']);
    } finally {
      this.isLoading = false;
    }
  }

  async loadUsers(clientId: string): Promise<void> {
    try {
      const snap = await getDocs(
        query(collection(this.firestore, 'users'), where('client', '==', clientId))
      );
      this.users = snap.docs.map(d => ({
        id:      d.id,
        name:    (d.data() as any)['name']    || '',
        surname: (d.data() as any)['surname'] || '',
      }));
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
      const { name, description, userIds } = this.groupForm.value;
      const clientId = this.groupForm.get('clientId')?.value;
      await updateDoc(doc(this.firestore, `userGroups/${this.groupId}`), {
        name,
        description,
        clientId,
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
