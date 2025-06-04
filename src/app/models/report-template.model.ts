export type ReportSectionType = 'logo' | 'text' | 'summary' | 'highlights' | 'lows' | 'customText';

export interface ReportSection {
  type: ReportSectionType;
  imageUrl?: string; // Para logo
  content?: string; // Para textos
  dataKey?: string; // Para seções dinâmicas
}

export interface ReportTemplate {
  id?: string;
  name: string;
  sections: ReportSection[];
  createdAt?: Date;
  updatedAt?: Date;
}
