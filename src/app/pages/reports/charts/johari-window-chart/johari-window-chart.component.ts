import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';

// Interface para os dados da Janela de Johari
export interface JohariWindowData {
  arena: string[];        // Eu sei, Outros sabem (Aberto)
  pontoCego: string[];  // Eu não sei, Outros sabem (Cego)
  fachada: string[];      // Eu sei, Outros não sabem (Oculto)
  desconhecido: string[]; // Eu não sei, Outros não sabem (Desconhecido)
}

@Component({
  selector: 'app-johari-window-chart',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './johari-window-chart.component.html',
  styleUrls: ['./johari-window-chart.component.scss'],
})
export class JohariWindowChartComponent implements OnChanges {
  @Input() data: JohariWindowData = {
    arena: [],
    pontoCego: [],
    fachada: [],
    desconhecido: [],
  };

  // Cores para cada quadrante
  quadrantColors = {
    arena: '#A5D6A7',       // Verde claro
    pontoCego: '#FFCC80', // Laranja claro
    fachada: '#90CAF9',     // Azul claro
    desconhecido: '#E0E0E0', // Cinza claro
  };

  constructor() {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && changes['data'].currentValue) {
      // Validação ou processamento adicional dos dados pode ser feito aqui
      this.data = changes['data'].currentValue;
    }
  }

  get allCompetenciesEmpty(): boolean {
    return (
      this.data.arena.length === 0 &&
      this.data.pontoCego.length === 0 &&
      this.data.fachada.length === 0 &&
      this.data.desconhecido.length === 0
    );
  }
}

