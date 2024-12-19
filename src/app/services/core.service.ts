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

  private rootElement: HTMLElement = document.documentElement;

  setDynamicTheme(primaryColor: string): void {
    const root = document.documentElement;

    // Atualizar variáveis CSS do tema primário
    root.style.setProperty('--theme-primary', primaryColor);

    // Definir as variações de cor (claro, escuro e contraste)
    root.style.setProperty(
      '--theme-primary-light',
      this.adjustColor(primaryColor, 40)
    );
    root.style.setProperty(
      '--theme-primary-dark',
      this.adjustColor(primaryColor, -40)
    );
    root.style.setProperty(
      '--theme-primary-contrast',
      this.getContrastColor(primaryColor)
    );
  }

  // Ajusta a cor (mais clara ou mais escura)
  private adjustColor(color: string, amount: number): string {
    let usePound = false;

    if (color[0] === '#') {
      color = color.slice(1);
      usePound = true;
    }

    const num = parseInt(color, 16);
    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00ff) + amount;
    let b = (num & 0x0000ff) + amount;

    r = Math.min(Math.max(0, r), 255);
    g = Math.min(Math.max(0, g), 255);
    b = Math.min(Math.max(0, b), 255);

    return (
      (usePound ? '#' : '') +
      ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
    );
  }

  // Obter cor de contraste (preto ou branco)
  private getContrastColor(hex: string): string {
    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 125 ? '#000000' : '#FFFFFF';
  }
}
