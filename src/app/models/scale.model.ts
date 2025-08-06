export interface Scale {
  id?: string;
  name: string;
  description: string;
  options: ScaleOption[];
  clientId?: string;
  isDefault?: boolean;
}

export interface ScaleOption {
  value: any;
  text: string;
}
