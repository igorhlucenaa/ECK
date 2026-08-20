import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslateModule } from '@ngx-translate/core';
import { TourService, TourState } from '../../services/tour/tour.service';
import { Subject, takeUntil } from 'rxjs';

export interface TourStepData {
  element: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatCardModule, MatProgressBarModule, TranslateModule],
  templateUrl: './tour-overlay.component.html',
  styleUrls: ['./tour-overlay.component.scss'],
})
export class TourOverlayComponent implements OnInit, OnDestroy {
  step: TourStepData | null = null;
  currentStep = 0;
  totalSteps = 0;
  isFirst = false;
  isLast = false;
  highlightRect: DOMRect | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private tourService: TourService,
    private cdr: ChangeDetectorRef
  ) {}

  closeTour(): void {
    this.tourService.closeTour();
  }

  nextStep(): void {
    this.tourService.nextStep();
  }

  prevStep(): void {
    this.tourService.prevStep();
  }

  ngOnInit(): void {
    this.tourService.tourState$.pipe(takeUntil(this.destroy$)).subscribe((state) => {
      if (state) {
        this.updateFromState(state);
      } else {
        this.step = null;
        this.highlightRect = null;
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateFromState(state: TourState): void {
    const s = state.steps[state.currentIndex];
    if (!s) return;
    this.step = {
      element: s.element,
      title: s.popover.title,
      description: s.popover.description,
      side: s.popover.side,
    };
    this.currentStep = state.currentIndex;
    this.totalSteps = state.steps.length;
    this.isFirst = state.currentIndex === 0;
    this.isLast = state.currentIndex === state.steps.length - 1;
    this.updateHighlight();
  }

  get progressPercent(): number {
    if (this.totalSteps <= 0) return 0;
    return ((this.currentStep + 1) / this.totalSteps) * 100;
  }

  updateHighlight(): void {
    if (!this.step) {
      this.highlightRect = null;
      return;
    }
    const el = document.querySelector(this.step.element);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        this.highlightRect = el.getBoundingClientRect();
        this.cdr.detectChanges();
      }, 350);
    } else {
      this.highlightRect = null;
    }
  }
}
