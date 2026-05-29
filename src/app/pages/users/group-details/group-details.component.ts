import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Firestore, doc, getDoc, collection, getDocs } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { CreateUserGroupComponent } from '../create-user-group/create-user-group.component';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';

@Component({
  selector: 'app-group-details',
  standalone: true,
  imports: [MaterialModule, CommonModule, RouterModule, TranslateModule, AppPageHeaderComponent],
  templateUrl: './group-details.component.html',
  styleUrl: './group-details.component.scss'
})
export class GroupDetailsComponent implements OnInit {
  group: any = null;
  clientName = '';
  members: { id: string; name: string; email: string }[] = [];
  displayedColumns = ['name', 'email', 'actions'];
  dataSource = new MatTableDataSource<any>([]);
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private location: Location,
    private translate: TranslateService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    const groupId = this.route.snapshot.paramMap.get('groupId');
    if (groupId) {
      this.loadGroupDetails(groupId);
    } else {
      this.isLoading = false;
      this.snackBar.open(this.translate.instant('Grupo não encontrado.'), this.translate.instant('Fechar'), { duration: 3000 });
    }
  }

  async loadGroupDetails(groupId: string): Promise<void> {
    try {
      const groupDoc = doc(this.firestore, `userGroups/${groupId}`);
      const groupSnap = await getDoc(groupDoc);

      if (!groupSnap.exists()) {
        this.snackBar.open(this.translate.instant('Grupo não encontrado.'), this.translate.instant('Fechar'), { duration: 3000 });
        this.isLoading = false;
        return;
      }

      const data = groupSnap.data();
      this.group = { id: groupSnap.id, ...data };

      if (this.group.clientId) {
        const clientDoc = doc(this.firestore, `clients/${this.group.clientId}`);
        const clientSnap = await getDoc(clientDoc);
        this.clientName = clientSnap.exists() ? (clientSnap.data() as any)['companyName'] || '' : '';
      }

      const userIds = this.group.userIds || [];
      this.members = [];
      for (const uid of userIds) {
        const userDoc = doc(this.firestore, `users/${uid}`);
        const userSnap = await getDoc(userDoc);
        if (userSnap.exists()) {
          const u = userSnap.data() as any;
          this.members.push({
            id: userSnap.id,
            name: `${u.name || ''} ${u.surname || ''}`.trim(),
            email: u.email || ''
          });
        }
      }
      this.dataSource.data = this.members;
    } catch (error) {
      this.snackBar.open(this.translate.instant('Erro ao carregar grupo.'), this.translate.instant('Fechar'), { duration: 3000 });
    } finally {
      this.isLoading = false;
    }
  }

  goBack(): void {
    this.location.back();
  }

  editGroup(): void {
    if (this.group) {
      const dialogRef = this.dialog.open(CreateUserGroupComponent, {
        width: '500px',
        data: this.group,
      });
      dialogRef.afterClosed().subscribe(async (result) => {
        if (result && this.group?.id) {
          await this.loadGroupDetails(this.group.id);
        }
      });
    }
  }
}
