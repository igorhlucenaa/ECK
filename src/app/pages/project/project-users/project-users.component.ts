import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  Firestore,
  collection,
  query,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
} from '@angular/fire/firestore';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CpfPipe } from 'src/app/pipe/cpf.pipe';

@Component({
  selector: 'app-project-users',
  standalone: true,
  imports: [MaterialModule, CommonModule, FormsModule, CpfPipe],
  templateUrl: './project-users.component.html',
  styleUrls: ['./project-users.component.scss'],
})
export class ProjectUsersComponent implements OnInit {
  displayedColumns: string[] = ['name', 'email', 'cpf', 'actions'];
  dataSource = new MatTableDataSource<any>();
  projectId: string | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');
    if (this.projectId) {
      this.loadUsers(this.projectId);
    }
  }

  async loadUsers(projectId: string): Promise<void> {
    try {
      const projectUsersCollection = collection(
        this.firestore,
        `projects/${projectId}/users`
      );
      const projectUsersQuery = query(projectUsersCollection);
      const snapshot = await getDocs(projectUsersQuery);

      const users = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      this.dataSource.data = users;
      this.dataSource.paginator = this.paginator;
    } catch (error) {
      console.error('Erro ao carregar usuários do projeto:', error);
      this.snackBar.open('Erro ao carregar usuários.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  addNewUser(): void {
    const newUser = { id: null, name: '', email: '', cpf: '', isNew: true };
    this.dataSource.data = [...this.dataSource.data, newUser];
  }

  async saveUser(user: any): Promise<void> {
    if (!user.name || !user.email || !user.cpf) {
      this.snackBar.open('Preencha todos os campos obrigatórios!', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    try {
      const projectUsersCollection = collection(
        this.firestore,
        `projects/${this.projectId}/users`
      );
      const userData = {
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        createdAt: new Date(),
      };

      if (user.isNew) {
        await addDoc(projectUsersCollection, userData);
      } else {
        const userDocRef = doc(
          this.firestore,
          `projects/${this.projectId}/users/${user.id}`
        );
        await setDoc(userDocRef, userData, { merge: true });
      }

      this.snackBar.open('Usuário salvo com sucesso!', 'Fechar', {
        duration: 3000,
      });

      this.loadUsers(this.projectId!); // Recarrega os dados
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      this.snackBar.open('Erro ao salvar usuário.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      const userDocRef = doc(
        this.firestore,
        `projects/${this.projectId}/users/${userId}`
      );
      await deleteDoc(userDocRef);

      this.snackBar.open('Usuário removido com sucesso!', 'Fechar', {
        duration: 3000,
      });

      this.dataSource.data = this.dataSource.data.filter(
        (user) => user.id !== userId
      );
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
      this.snackBar.open('Erro ao remover usuário.', 'Fechar', {
        duration: 3000,
      });
    }
  }
}
