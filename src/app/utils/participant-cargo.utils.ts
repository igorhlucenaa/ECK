export interface ParticipantCargoSetor {
  cargo?: string;
}

/** Armazena cargo/setor como texto livre no campo cargo. */
export function parseCargoSetorInput(value: string | undefined | null): ParticipantCargoSetor {
  const raw = (value || '').trim();
  return raw ? { cargo: raw } : {};
}

/** Lê a coluna Cargo/Setor da planilha (coluna E; mescla E+F legado em um único texto). */
export function parseCargoSetorFromExcelRow(row: unknown[]): ParticipantCargoSetor {
  const col4 = row[4]?.toString().trim() || '';
  const col5 = row[5]?.toString().trim() || '';

  if (!col4 && !col5) {
    return {};
  }

  if (col4 && col5) {
    return { cargo: `${col4} ${col5}`.trim() };
  }

  return { cargo: col4 || col5 };
}

export function appendCargoSetorFields(
  target: Record<string, unknown>,
  cargoSetor: ParticipantCargoSetor | { cargo?: string; setor?: string }
): void {
  const legacySetor = 'setor' in cargoSetor ? cargoSetor.setor : undefined;
  const display = getCargoSetorDisplay(cargoSetor.cargo, legacySetor);
  if (display) {
    target['cargo'] = display;
  }
}

/** Exibe valor único para registros legados com cargo/setor separados. */
export function formatCargoSetorForInput(cargo?: string, setor?: string): string {
  if (cargo && setor) {
    return `${cargo} ${setor}`.trim();
  }
  return cargo || setor || '';
}

export function getCargoSetorDisplay(cargo?: string, setor?: string): string {
  return formatCargoSetorForInput(cargo, setor);
}
