import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';

export interface User {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'client-admin' | 'project-manager' | 'project-supervisor' | 'project-viewer';
  clientId?: string;
  projectIds?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private user$ = new BehaviorSubject<User | null>(null);
  private initialized = false;

  constructor(
    private auth: Auth,
    private firestore: Firestore
  ) {
    this.initAuth();
  }

  private initAuth(): void {
    if (this.initialized) return;

    onAuthStateChanged(this.auth, (firebaseUser) => {
      if (firebaseUser) {
        this.getUserData(firebaseUser.uid)
          .subscribe(userData => {
            if (userData) {
              const user: User = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: userData.name || '',
                role: userData.role || 'project-viewer',
                clientId: userData.clientId,
                projectIds: userData.projectIds
              };
              this.user$.next(user);
            } else {
              this.user$.next(null);
            }
          });
      } else {
        this.user$.next(null);
      }
    });

    this.initialized = true;
  }

  getCurrentUser(): User | null {
    return this.user$.getValue();
  }

  get user(): Observable<User | null> {
    return this.user$.asObservable();
  }

  get isLoggedIn(): Observable<boolean> {
    return this.user.pipe(
      map(user => !!user)
    );
  }

  get isAdmin(): Observable<boolean> {
    return this.user.pipe(
      map(user => user?.role === 'admin')
    );
  }

  get isClientAdmin(): Observable<boolean> {
    return this.user.pipe(
      map(user => user?.role === 'client-admin')
    );
  }

  login(email: string, password: string): Observable<User> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      switchMap(credential => this.getUserData(credential.user.uid)),
      map(userData => {
        if (!userData) throw new Error('Usuário não encontrado');

        const user: User = {
          uid: userData.uid,
          email: userData.email || '',
          name: userData.name || '',
          role: userData.role || 'project-viewer',
          clientId: userData.clientId,
          projectIds: userData.projectIds
        };

        this.user$.next(user);
        return user;
      })
    );
  }

  logout(): Observable<void> {
    return from(signOut(this.auth)).pipe(
      tap(() => this.user$.next(null))
    );
  }

  registerUser(email: string, password: string, userData: Partial<User>): Observable<User> {
    return from(createUserWithEmailAndPassword(this.auth, email, password)).pipe(
      switchMap(credential => {
        const uid = credential.user.uid;
        const user: User = {
          uid,
          email,
          name: userData.name || '',
          role: userData.role || 'project-viewer',
          clientId: userData.clientId,
          projectIds: userData.projectIds
        };

        return from(setDoc(doc(this.firestore, 'users', uid), user)).pipe(
          map(() => user)
        );
      }),
      tap(user => this.user$.next(user))
    );
  }

  updateUserProfile(uid: string, userData: Partial<User>): Observable<void> {
    return from(updateDoc(doc(this.firestore, 'users', uid), { ...userData })).pipe(
      tap(() => {
        const currentUser = this.user$.getValue();
        if (currentUser && currentUser.uid === uid) {
          this.user$.next({ ...currentUser, ...userData });
        }
      })
    );
  }

  private getUserData(uid: string): Observable<any> {
    return from(getDoc(doc(this.firestore, 'users', uid))).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          return { uid, ...docSnap.data() };
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }
}
