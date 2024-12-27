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
      const usersCollection = collection(this.firestore, 'users');
      const usersQuery = query(usersCollection, where('group', '==', groupId));
      const querySnapshot = await getDocs(usersQuery);

      const users = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

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
