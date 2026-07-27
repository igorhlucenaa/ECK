import { Injectable, OnDestroy } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

const PAGINATOR_KEYS = [
  'paginator.itemsPerPage',
  'paginator.nextPage',
  'paginator.previousPage',
  'paginator.firstPage',
  'paginator.lastPage',
] as const;

@Injectable()
export class PaginatorIntlService extends MatPaginatorIntl implements OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(private translate: TranslateService) {
    super();
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.loadLabels());
    this.translate.onTranslationChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.loadLabels());
    this.loadLabels();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return this.translate.instant('paginator.range', { start: 0, end: 0, length: 0 });
    }

    length = Math.max(length, 0);
    const startIndex = page * pageSize;
    const endIndex =
      startIndex < length ? Math.min(startIndex + pageSize, length) : startIndex + pageSize;

    return this.translate.instant('paginator.range', {
      start: startIndex + 1,
      end: endIndex,
      length,
    });
  };

  private loadLabels(): void {
    this.translate.get([...PAGINATOR_KEYS]).subscribe((labels) => {
      this.itemsPerPageLabel = labels['paginator.itemsPerPage'];
      this.nextPageLabel = labels['paginator.nextPage'];
      this.previousPageLabel = labels['paginator.previousPage'];
      this.firstPageLabel = labels['paginator.firstPage'];
      this.lastPageLabel = labels['paginator.lastPage'];
      this.changes.next();
    });
  }
}
