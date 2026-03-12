import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Firestore, doc, getDoc, collection, getDocs, query, where } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-user-details',
  standalone: true,
  imports: [MaterialModule, CommonModule, TranslateModule],
  templateUrl: './user-details.component.html',
  styleUrl: './user-details.component.scss'
})
export class UserDetailsComponent implements OnInit {
  user: any = null;
  clientName = '';
  groups: string[] = [];
  projects: string[] = [];
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private location: Location,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id');
    if (userId) {
      this.loadUserDetails(userId);
    } else {
      this.isLoading = false;
      this.snackBar.open(this.translate.instant('Usuário não encontrado.'), this.translate.instant('Fechar'), { duration: 3000 });
    }
  }

  async loadUserDetails(userId: string): Promise<void> {
    try {
      const userDoc = doc(this.firestore, `users/${userId}`);
      const userSnap = await getDoc(userDoc);

      if (!userSnap.exists()) {
        this.snackBar.open(this.translate.instant('Usuário não encontrado.'), this.translate.instant('Fechar'), { duration: 3000 });
        this.isLoading = false;
        return;
      }

      const data = userSnap.data();
      this.user = { id: userSnap.id, ...data };

      if (this.user.client) {
        const clientDoc = doc(this.firestore, `clients/${this.user.client}`);
        const clientSnap = await getDoc(clientDoc);
        this.clientName = clientSnap.exists() ? (clientSnap.data() as any)['companyName'] || '' : '';
      }

      const groupsCol = collection(this.firestore, 'userGroups');
      const groupsSnap = await getDocs(groupsCol);
      this.groups = groupsSnap.docs
        .filter(d => (d.data()['userIds'] || []).includes(userId))
        .map(d => d.data()['name'] || '');

      const projectsCol = collection(this.firestore, 'projects');
      const projectsSnap = await getDocs(projectsCol);
      const groupIds = groupsSnap.docs
        .filter(d => (d.data()['userIds'] || []).includes(userId))
        .map(d => d.id);
      this.projects = [];
      for (const projDoc of projectsSnap.docs) {
        const projData = projDoc.data();
        const projGroupIds = projData['groupIds'] || [];
        if (projGroupIds.some((g: string) => groupIds.includes(g))) {
          this.projects.push(projData['name'] || '');
        }
      }
    } catch (error) {
      this.snackBar.open(this.translate.instant('Erro ao carregar usuário.'), this.translate.instant('Fechar'), { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

  goBack(): void {
    this.location.back();
  }

  goToEdit(): void {
    if (this.user?.id) {
      this.router.navigate(['/users', this.user.id, 'edit']);
    }
  }
}
