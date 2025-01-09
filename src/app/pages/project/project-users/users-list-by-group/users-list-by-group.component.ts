import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-users-list-by-group',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './users-list-by-group.component.html',
  styleUrls: ['./users-list-by-group.component.scss'],
})
export class UsersListByGroupComponent implements OnInit {
  displayedColumns: string[] = ['name', 'email'];
  dataSource = new MatTableDataSource<any>();
  isLoading: boolean = true;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    public dialogRef: MatDialogRef<UsersListByGroupComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: { groupName: string; groupId: string },
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    this.loadUsersByGroup(this.data.groupId);
  }

  async loadUsersByGroup(groupId: string): Promise<void> {
    if (!groupId) {
      console.error('Group ID is undefined or empty.');
      this.isLoading = false;
      return;
    }

    try {
      const userGroupsCollection = collection(this.firestore, 'userGroups');
      const usersCollection = collection(this.firestore, 'users');

      // Buscar o grupo pelo ID
      const groupQuery = query(
        userGroupsCollection,
        where('__name__', '==', groupId)
      );
      const groupSnapshot = await getDocs(groupQuery);

      if (groupSnapshot.empty) {
        console.error('No group found with the provided ID.');
        this.isLoading = false;
        return;
      }

      const groupData = groupSnapshot.docs[0].data();
      const userIds: string[] = groupData['userIds'] || [];

      if (userIds.length === 0) {
        console.warn('No users found in this group.');
        this.dataSource.data = [];
        this.isLoading = false;
        return;
      }

      // Buscar os usuários com base nos IDs
      const userQueries = userIds.map((id) =>
        query(usersCollection, where('__name__', '==', id))
      );
      const userSnapshots = await Promise.all(
        userQueries.map((q) => getDocs(q))
      );

      const users = userSnapshots
        .flatMap((snapshot) => snapshot.docs)
        .map((doc) => ({
          id: doc.id,
          ...(doc.data() as { name: string; email: string }),
        }));

      // Atualizar a tabela
      this.dataSource.data = users;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    } catch (error) {
      console.error('Erro ao carregar usuários do grupo:', error);
    } finally {
      this.isLoading = false;
    }
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  closeModal(): void {
    this.dialogRef.close();
  }
}
