import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  private activeRequests = 0;

  constructor(private loadingService: LoadingService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Não mostrar loading para requisições específicas
    if (this.shouldSkipLoading(request)) {
      return next.handle(request);
    }

    this.activeRequests++;

    // Só mostrar loading se for a primeira requisição ativa
    if (this.activeRequests === 1) {
      this.loadingService.show('Carregando dados...');
    }

    return next.handle(request).pipe(
      tap(() => {
        // Log para debug (opcional)
        console.log(`🔄 Requisição ativa: ${request.url}`);
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Erro na requisição:', error);
        return throwError(() => error);
      }),
      finalize(() => {
        this.activeRequests--;

        // Só esconder loading se não há mais requisições ativas
        if (this.activeRequests === 0) {
          this.loadingService.hide();
        }
      })
    );
  }

  private shouldSkipLoading(request: HttpRequest<any>): boolean {
    // URLs que não devem mostrar loading
    const skipUrls = [
      '/assets/', // Arquivos estáticos
      '/api/health', // Health checks
      '/api/ping', // Ping requests
    ];

    return skipUrls.some(url => request.url.includes(url));
  }
}
