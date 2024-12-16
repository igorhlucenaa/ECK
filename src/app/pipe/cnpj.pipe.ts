import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'cnpj',
  standalone: true, // Torna o pipe standalone
})
export class CnpjPipe implements PipeTransform {
  transform(value: string | number): string {
    if (!value) return '';

    const cleaned = value.toString().replace(/\D/g, ''); // Remove tudo que não for dígito

    if (cleaned.length === 14) {
      return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12, 14)}`;
    }

    return value.toString(); // Caso não corresponda
  }
}
