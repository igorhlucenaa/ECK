import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PerformanceMonitorService {
  private timers = new Map<string, number>();
  private measurements = new Map<string, number[]>();

  startTimer(label: string): void {
    performance.mark(`${label}-start`);
    this.timers.set(label, performance.now());
  }

  endTimer(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      console.warn(`Timer "${label}" não foi iniciado`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);

    // Armazenar medição
    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
    this.measurements.get(label)!.push(duration);

    console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
    this.timers.delete(label);

    return duration;
  }

  getAverageTime(label: string): number {
    const times = this.measurements.get(label);
    if (!times || times.length === 0) return 0;

    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  getPerformanceReport(): { [key: string]: { avg: number, count: number, total: number } } {
    const report: { [key: string]: { avg: number, count: number, total: number } } = {};

    for (const [label, times] of this.measurements.entries()) {
      const total = times.reduce((a, b) => a + b, 0);
      report[label] = {
        avg: total / times.length,
        count: times.length,
        total
      };
    }

    return report;
  }

  logPerformanceReport(): void {
    const report = this.getPerformanceReport();
    console.table(report);
  }

  clearMeasurements(): void {
    this.measurements.clear();
    this.timers.clear();
    performance.clearMarks();
    performance.clearMeasures();
  }

  // Decorator para medir performance automaticamente
  static measureTime(label?: string) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const method = descriptor.value;
      const timerLabel = label || `${target.constructor.name}.${propertyName}`;

      descriptor.value = function (...args: any[]) {
        const monitor = new PerformanceMonitorService();
        monitor.startTimer(timerLabel);

        try {
          const result = method.apply(this, args);

          // Se é uma Promise, aguardar antes de parar o timer
          if (result && typeof result.then === 'function') {
            return result.finally(() => monitor.endTimer(timerLabel));
          }

          monitor.endTimer(timerLabel);
          return result;
        } catch (error) {
          monitor.endTimer(timerLabel);
          throw error;
        }
      };
    };
  }
}
