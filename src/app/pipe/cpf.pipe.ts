import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'cpf',
  standalone: true, // Para uso em componentes standalone
})
export class CpfPipe implements PipeTransform {
  transform(value: string | number | null | undefined): string {
    if (!value) return '';
    let cpf = value.toString().replace(/\D/g, ''); // Remove caracteres não numéricos
    if (cpf.length !== 11) return value.toString(); // Retorna como está se o tamanho não for válido

    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
}
