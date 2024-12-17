import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'phone',
  standalone: true, // Torna o pipe standalone
})
export class PhonePipe implements PipeTransform {
  transform(value: string | number): string {
    if (!value) return '';

    const cleaned = value.toString().replace(/\D/g, ''); // Remove tudo que não for dígito

    if (cleaned.length === 11) {
      // Formato para celular: (XX) XXXXX-XXXX
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
    } else if (cleaned.length === 10) {
      // Formato para telefone fixo: (XX) XXXX-XXXX
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6, 10)}`;
    }

    return value.toString(); // Caso não corresponda
  }
}
