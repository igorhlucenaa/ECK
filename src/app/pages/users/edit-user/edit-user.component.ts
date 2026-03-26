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
      client: [''],
    });
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

      this.userForm.patchValue({
        name: data['name'] || '',
        surname: data['surname'] || '',
        email: data['email'] || '',
        role: data['role'] || '',
        client: data['client'] || '',
      });
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
      const { name, surname, role, client } = this.userForm.value;
      await updateDoc(doc(this.firestore, `users/${this.userId}`), {
        name,
        surname,
        role,
        client,
        updatedAt: new Date(),
      });
      this.snackBar.open(this.translate.instant('Usuário atualizado com sucesso!'), this.translate.instant('Fechar'), { duration: 3000 });
      this.router.navigate(['/users']);
    } catch {
      this.snackBar.open(this.translate.instant('Erro ao salvar usuário.'), this.translate.instant('Fechar'), { duration: 3000 });
    } finally {
      this.isSaving = false;
    }
  }

  get clientName(): string {
    const id = this.userForm?.get('client')?.value;
    return this.clients.find(c => c.id === id)?.name || '—';
  }

  goBack(): void {
    this.location.back();
  }
}
