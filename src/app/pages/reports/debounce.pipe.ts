import { Pipe, PipeTransform } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, debounceTime } from 'rxjs';

@Pipe({
  name: 'debounce',
  pure: false
})
export class DebouncePipe implements PipeTransform {
  private cache = new Map<string, any>();
  private subjects = new Map<string, BehaviorSubject<any>>();

  transform(value: any, fn: Function, debounceMs: number = 300, ...args: any[]): any {
    const key = JSON.stringify([value, ...args]);

    if (!this.subjects.has(key)) {
      const subject = new BehaviorSubject(value);
      this.subjects.set(key, subject);

      subject.pipe(
        debounceTime(debounceMs),
        distinctUntilChanged()
      ).subscribe(val => {
        const result = fn(val, ...args);
        this.cache.set(key, result);
      });
    }

    const subject = this.subjects.get(key)!;
    subject.next(value);

    return this.cache.get(key) || fn(value, ...args);
  }
}
