import { Injectable } from '@angular/core';
import { Firestore, collection, getDocs, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from '@angular/fire/firestore';
import { LoadingService } from '../services/loading.service';
import { TranslateService } from '@ngx-translate/core';
import { Observable, from } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';

@Injectable()
export class FirestoreLoadingInterceptor {
  private activeRequests = 0;

  constructor(
    private firestore: Firestore,
    private loadingService: LoadingService,
    private translate: TranslateService
  ) {}

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  // Método para interceptar operações do Firestore
  intercept<T>(operation: () => Promise<T>, message?: string): Observable<T> {
    this.activeRequests++;

    if (this.activeRequests === 1) {
      this.loadingService.show(message || this.t('Carregando dados...'));
    }

    return from(operation()).pipe(
      tap(() => {
        console.log(`🔥 Operação Firestore ativa`);
      }),
      finalize(() => {
        this.activeRequests--;

        if (this.activeRequests === 0) {
          this.loadingService.hide();
        }
      })
    );
  }

  // Métodos específicos para operações comuns do Firestore
  getDocsWithLoading(collectionPath: string, message?: string) {
    return this.intercept(
      () => getDocs(collection(this.firestore, collectionPath)),
      message || this.t('Carregando {{path}}...', { path: collectionPath })
    );
  }

  getDocWithLoading(docPath: string, message?: string) {
    return this.intercept(
      () => getDoc(doc(this.firestore, docPath)),
      message || this.t('Carregando documento...')
    );
  }

  addDocWithLoading(collectionPath: string, data: any, message?: string) {
    return this.intercept(
      () => addDoc(collection(this.firestore, collectionPath), data),
      message || this.t('Salvando dados...')
    );
  }

  setDocWithLoading(docPath: string, data: any, message?: string) {
    return this.intercept(
      () => setDoc(doc(this.firestore, docPath), data),
      message || this.t('Salvando dados...')
    );
  }

  updateDocWithLoading(docPath: string, data: any, message?: string) {
    return this.intercept(
      () => updateDoc(doc(this.firestore, docPath), data),
      message || this.t('Atualizando dados...')
    );
  }

  deleteDocWithLoading(docPath: string, message?: string) {
    return this.intercept(
      () => deleteDoc(doc(this.firestore, docPath)),
      message || this.t('Excluindo dados...')
    );
  }
}
