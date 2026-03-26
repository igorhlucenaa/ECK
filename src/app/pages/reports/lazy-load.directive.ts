import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';

@Directive({
  selector: '[appLazyLoad]'
})
export class LazyLoadDirective implements OnInit, OnDestroy {
  @Input() rootMargin = '50px';
  @Input() threshold = 0.1;
  @Output() inView = new EventEmitter<boolean>();

  private observer?: IntersectionObserver;

  constructor(private element: ElementRef) {}

  ngOnInit() {
    this.createObserver();
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private createObserver() {
    const options = {
      rootMargin: this.rootMargin,
      threshold: this.threshold
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.inView.emit(true);
        } else {
          this.inView.emit(false);
        }
      });
    }, options);

    this.observer.observe(this.element.nativeElement);
  }
}
