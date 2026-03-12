import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Firestore, doc, getDoc, collection, getDocs } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CreateUserComponent } from '../create-user/create-user.component';

@Component({
  selector: 'app-edit-user',
  standalone: true,
  imports: [MaterialModule, CommonModule, TranslateModule],
  templateUrl: './edit-user.component.html',
  styleUrl: './edit-user.component.scss'
})
export class EditUserComponent implements OnInit {
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private location: Location,
    private dialog: MatDialog,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id');
    if (userId) {
      this.loadAndOpenEdit(userId);
    } else {
      this.isLoading = false;
      this.snackBar.open(this.translate.instant('Usuário não encontrado.'), this.translate.instant('Fechar'), { duration: 3000 });
      this.router.navigate(['/users']);
    }
  }

  async loadAndOpenEdit(userId: string): Promise<void> {
    try {
      const userDoc = doc(this.firestore, `users/${userId}`);
      const userSnap = await getDoc(userDoc);

      if (!userSnap.exists()) {
        this.snackBar.open(this.translate.instant('Usuário não encontrado.'), this.translate.instant('Fechar'), { duration: 3000 });
        this.router.navigate(['/users']);
        return;
      }

      const data = userSnap.data() as any;
      let clientName = '';
      if (data['client']) {
        const clientDoc = doc(this.firestore, `clients/${data['client']}`);
        const clientSnap = await getDoc(clientDoc);
        clientName = clientSnap.exists() ? (clientSnap.data() as any)['companyName'] || '' : '';
      }

      const groupsCol = collection(this.firestore, 'userGroups');
      const groupsSnap = await getDocs(groupsCol);
      const userGroups = groupsSnap.docs
        .filter(d => (d.data()['userIds'] || []).includes(userId))
        .map(d => d.data()['name'] || '');

      const user = {
        id: userSnap.id,
        name: data['name'] || '',
        surname: data['surname'] || '',
        email: data['email'] || '',
        role: data['role'] || '',
        client: clientName,
        group: userGroups.join(', '),
        groups: userGroups,
      };

      this.isLoading = false;

      const dialogRef = this.dialog.open(CreateUserComponent, {
        width: '500px',
        data: { user },
      });

      dialogRef.afterClosed().subscribe((result) => {
        this.router.navigate(['/users']);
      });
    } catch (error) {
      this.isLoading = false;
      this.snackBar.open(this.translate.instant('Erro ao carregar usuário.'), this.translate.instant('Fechar'), { duration: 3000 });
      this.router.navigate(['/users']);
    }
  }

  goBack(): void {
    this.location.back();
  }
}
