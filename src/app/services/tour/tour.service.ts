import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import { TOUR_REGISTRY, TourStep } from './tour-registry';

const STORAGE_KEY = 'eck_tour_completed';

export interface TourState {
  steps: TourStep[];
  currentIndex: number;
  route: string;
  force: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class TourService {
  private currentRoute = '';
  tourState$ = new BehaviorSubject<TourState | null>(null);

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentRoute = e.urlAfterRedirects?.split('?')[0] || e.url?.split('?')[0] || '';
      });
  }

  private getStorageKey(route: string): string {
    const normalized = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
    return `${STORAGE_KEY}_${normalized}`;
  }

  isTourCompleted(route: string): boolean {
    return localStorage.getItem(this.getStorageKey(route)) === 'true';
  }

  markTourCompleted(route: string): void {
    localStorage.setItem(this.getStorageKey(route), 'true');
  }

  resetAllTours(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }

  private getValidSteps(steps: TourStep[]): TourStep[] {
    return steps.filter((step) => {
      try {
        const el = document.querySelector(step.element);
        return !!el;
      } catch {
        return false;
      }
    });
  }

  private getConfigForRoute(route: string): { steps: TourStep[] } | null {
    for (const config of TOUR_REGISTRY) {
      const pattern = config.routePattern;
      const matches =
        typeof pattern === 'string'
          ? route === pattern || route.startsWith(pattern + '/')
          : pattern.test(route);
      if (matches) {
        return { steps: config.steps };
      }
    }
    return null;
  }

  startTour(route?: string, force = false): void {
    const targetRoute = route || this.currentRoute;

    if (!targetRoute || targetRoute === '/' || targetRoute.includes('/authentication') || targetRoute === '/assessment') {
      return;
    }

    const config = this.getConfigForRoute(targetRoute);
    if (!config || config.steps.length === 0) {
      return;
    }

    const validSteps = this.getValidSteps(config.steps);
    if (validSteps.length === 0 && !force) {
      return;
    }

    if (!force && this.isTourCompleted(targetRoute)) {
      return;
    }

    this.tourState$.next({
      steps: validSteps,
      currentIndex: 0,
      route: targetRoute,
      force,
    });
  }

  nextStep(): void {
    const state = this.tourState$.value;
    if (!state) return;
    if (state.currentIndex >= state.steps.length - 1) {
      this.markTourCompleted(state.route);
      this.tourState$.next(null);
      return;
    }
    this.tourState$.next({ ...state, currentIndex: state.currentIndex + 1 });
  }

  prevStep(): void {
    const state = this.tourState$.value;
    if (!state || state.currentIndex <= 0) return;
    this.tourState$.next({ ...state, currentIndex: state.currentIndex - 1 });
  }

  closeTour(): void {
    const state = this.tourState$.value;
    if (state && !state.force) {
      this.markTourCompleted(state.route);
    }
    this.tourState$.next(null);
  }

  maybeStartTourOnNavigation(route: string): void {
    if (this.isTourCompleted(route)) {
      return;
    }
    setTimeout(() => this.startTour(route, false), 500);
  }

  replayTour(): void {
    this.startTour(this.currentRoute, true);
  }
}
