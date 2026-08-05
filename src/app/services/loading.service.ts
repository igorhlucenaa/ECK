import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
  type?: 'spinner' | 'skeleton' | 'progress';
}

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<LoadingState>({
    isLoading: false,
    message: '',
    type: 'spinner'
  });

  private loadingStates = new Map<string, LoadingState>();
  private globalLoadingCount = 0;

  // Observable público para componentes
  public loading$ = this.loadingSubject.asObservable().pipe(
    debounceTime(100), // Evita flickering
    distinctUntilChanged()
  );

  // Métodos para loading global
  show(message?: string, type: 'spinner' | 'skeleton' | 'progress' = 'spinner'): void {
    this.globalLoadingCount++;
    this.loadingSubject.next({
      isLoading: true,
      message: message || 'Carregando...',
      type
    });
  }

  hide(): void {
    this.globalLoadingCount = Math.max(0, this.globalLoadingCount - 1);

    if (this.globalLoadingCount === 0) {
      this.loadingSubject.next({
        isLoading: false,
        message: '',
        type: 'spinner'
      });
    }
  }

  /** Atualiza a mensagem do loading global sem incrementar o contador. */
  updateMessage(message: string): void {
    if (this.globalLoadingCount <= 0 && this.loadingStates.size === 0) {
      return;
    }
    const current = this.loadingSubject.value;
    this.loadingSubject.next({
      ...current,
      isLoading: true,
      message: message || current.message,
    });
  }

  // Métodos para loading específico por chave
  showFor(key: string, message?: string, type: 'spinner' | 'skeleton' | 'progress' = 'spinner'): void {
    this.loadingStates.set(key, {
      isLoading: true,
      message: message || 'Carregando...',
      type
    });
    this.updateGlobalState();
  }

  hideFor(key: string): void {
    this.loadingStates.delete(key);
    this.updateGlobalState();
  }

  updateProgress(key: string, progress: number): void {
    const state = this.loadingStates.get(key);
    if (state) {
      state.progress = progress;
      this.updateGlobalState();
    }
  }

  // Métodos para loading com timeout
  showWithTimeout(message?: string, timeout: number = 30000): Observable<boolean> {
    this.show(message);

    return new Observable(observer => {
      const timer$ = timer(timeout);
      timer$.subscribe(() => {
        this.hide();
        observer.next(false);
        observer.complete();
      });
    });
  }

  // Método para loading condicional (só mostra se demorar mais de X ms)
  showDelayed(message?: string, delay: number = 300): Observable<boolean> {
    return new Observable(observer => {
      const timer$ = timer(delay);
      timer$.subscribe(() => {
        this.show(message);
        observer.next(true);
        observer.complete();
      });
    });
  }

  // Método para loading com progresso
  showWithProgress(message?: string): { updateProgress: (progress: number) => void; hide: () => void } {
    this.show(message, 'progress');

    return {
      updateProgress: (progress: number) => {
        this.loadingSubject.next({
          isLoading: true,
          message,
          type: 'progress',
          progress
        });
      },
      hide: () => this.hide()
    };
  }

  // Método para loading de skeleton
  showSkeleton(message?: string): void {
    this.show(message, 'skeleton');
  }

  // Método para resetar todos os estados
  reset(): void {
    this.globalLoadingCount = 0;
    this.loadingStates.clear();
    this.loadingSubject.next({
      isLoading: false,
      message: '',
      type: 'spinner'
    });
  }

  // Método para verificar se está carregando
  get isLoading(): boolean {
    return this.loadingSubject.value.isLoading;
  }

  // Método para obter estado atual
  get currentState(): LoadingState {
    return this.loadingSubject.value;
  }

  // Método para obter contagem de loading ativos
  get activeLoadingCount(): number {
    return this.globalLoadingCount + this.loadingStates.size;
  }

  private updateGlobalState(): void {
    const hasLocalLoading = this.loadingStates.size > 0;
    const hasGlobalLoading = this.globalLoadingCount > 0;

    if (hasGlobalLoading || hasLocalLoading) {
      // Se há loading global, usa ele. Senão, usa o primeiro loading local
      if (hasGlobalLoading) {
        // Mantém o estado global
        return;
      } else {
        // Usa o primeiro loading local
        const firstLocalState = Array.from(this.loadingStates.values())[0];
        this.loadingSubject.next(firstLocalState);
      }
    } else {
      // Não há loading ativo
      this.loadingSubject.next({
        isLoading: false,
        message: '',
        type: 'spinner'
      });
    }
  }
}
