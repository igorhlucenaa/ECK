import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppSettings, defaults } from '../config';

@Injectable({
  providedIn: 'root',
})
export class CoreService {
  private optionsSignal = signal<AppSettings>(defaults);

  getOptions() {
    return this.optionsSignal();
  }

  setOptions(options: Partial<AppSettings>) {
    this.optionsSignal.update((current) => ({
      ...current,
      ...options,
    }));
  }

  get notify(): Observable<Record<string, any>> {
    return this.notify$.asObservable();
  }

  private htmlElement!: HTMLHtmlElement;

  private notify$ = new BehaviorSubject<Record<string, any>>({});

  constructor() {
    this.htmlElement = document.querySelector('html')!;
  }

  

  toggleTheme(): void {
    this.options.theme = this.options.theme === 'dark' ? 'light' : 'dark';
    if (this.options.theme === 'dark') {
      this.htmlElement.classList.add('dark-theme');
      this.htmlElement.classList.remove('light-theme');
    } else {
      this.htmlElement.classList.remove('dark-theme');
      this.htmlElement.classList.add('light-theme');
    }
    this.notify$.next(this.options);
  }

  private options = defaults;

  getLanguage() {
    return this.getOptions().language;
  }

  setLanguage(lang: string) {
    this.setOptions({ language: lang });
  }
}
