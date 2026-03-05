import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'columnValue', standalone: true })
export class ColumnValuePipe implements PipeTransform {
  transform(value: any): any {
    if (typeof value === 'string' && value.startsWith('Column ')) {
      return value.replace('Column ', '').trim();
    }
    return value;
  }
}
