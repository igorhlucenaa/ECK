import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from '@angular/fire/firestore';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';
import { MaterialModule } from 'src/app/material.module';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { environment } from 'src/enviroments/environment';

interface ClientOption {
  id: string;
  name: string;
}

interface TemplateOption {
  id: string;
  name: string;
  subject: string;
  scope: 'client' | 'global';
}

interface ReminderRunSummary {
  sent: number;
  skipped: number;
  errors: number;
}

interface WeekdayOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-reminder-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, AppPageHeaderComponent],
  templateUrl: './reminder-settings.component.html',
  styleUrl: './reminder-settings.component.scss',
})
export class ReminderSettingsComponent implements OnInit {
  readonly form = this.fb.group({
    enabled: this.fb.nonNullable.control(false),
    intervalDays: this.fb.nonNullable.control(3, [
      Validators.required,
      Validators.min(1),
      Validators.max(365),
    ]),
    maxReminders: this.fb.nonNullable.control(0, [Validators.min(0), Validators.max(1000)]),
    sendTime: this.fb.nonNullable.control('09:00', [Validators.required]),
    timezone: this.fb.nonNullable.control('America/Fortaleza', [Validators.required]),
    weekdays: this.fb.nonNullable.control<number[]>([]),
    templateIdDefault: this.fb.nonNullable.control(''),
    templateIdAvaliado: this.fb.nonNullable.control(''),
    templateIdAvaliador: this.fb.nonNullable.control(''),
  });

  readonly weekdayOptions: WeekdayOption[] = [
    { value: 1, label: 'Seg' },
    { value: 2, label: 'Ter' },
    { value: 3, label: 'Qua' },
    { value: 4, label: 'Qui' },
    { value: 5, label: 'Sex' },
    { value: 6, label: 'Sab' },
    { value: 0, label: 'Dom' },
  ];

  readonly timezoneOptions = [
    'America/Fortaleza',
    'America/Sao_Paulo',
    'America/Recife',
    'America/Manaus',
    'America/Belem',
    'UTC',
  ];

  userRole = '';
  userEmail = '';
  clients: ClientOption[] = [];
  templates: TemplateOption[] = [];
  selectedClientId = '';

  isLoading = true;
  isSaving = false;

  lastRunAt: Date | null = null;
  lastRunSummary: ReminderRunSummary | null = null;

  constructor(
    private firestore: Firestore,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private authService: AuthService
  ) {}

  get isAdminMaster(): boolean {
    return this.userRole === 'admin_master';
  }

  async ngOnInit(): Promise<void> {
    this.userRole = (await this.authService.getCurrentUserRole()) || '';
    this.userEmail = (await this.authService.getCurrentUserEmail()) || '';

    await this.loadClients();

    if (!this.clients.length) {
      this.isLoading = false;
      return;
    }

    this.selectedClientId = this.clients[0].id;
    await this.loadTemplates(this.selectedClientId);
    await this.loadSettings(this.selectedClientId);
    this.isLoading = false;
  }

  isWeekdaySelected(value: number): boolean {
    return this.form.controls.weekdays.value.includes(value);
  }

  toggleWeekday(value: number, checked: boolean): void {
    const current = [...this.form.controls.weekdays.value];
    const updated = checked
      ? Array.from(new Set([...current, value]))
      : current.filter((day) => day !== value);
    this.form.controls.weekdays.setValue(updated.sort((a, b) => a - b));
  }

  selectBusinessDays(): void {
    this.form.controls.weekdays.setValue([1, 2, 3, 4, 5]);
  }

  selectAllDays(): void {
    this.form.controls.weekdays.setValue([]);
  }

  async onClientChange(clientId: string): Promise<void> {
    if (!clientId) return;
    this.selectedClientId = clientId;
    this.isLoading = true;
    await this.loadTemplates(clientId);
    await this.loadSettings(clientId);
    this.isLoading = false;
  }

  async saveSettings(): Promise<void> {
    if (!this.selectedClientId) {
      this.snackBar.open('Selecione um cliente para salvar as configuracoes.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Revise os campos antes de salvar.', 'Fechar', { duration: 3000 });
      return;
    }

    const sendTime = this.normalizeTime(this.form.controls.sendTime.value);
    if (!sendTime) {
      this.snackBar.open('Informe um horario valido no formato HH:mm.', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    if (!this.isValidTimeZone(this.form.controls.timezone.value)) {
      this.snackBar.open('Informe um timezone valido (ex.: America/Fortaleza).', 'Fechar', {
        duration: 3000,
      });
      return;
    }

    this.isSaving = true;
    try {
      const payload = {
        clientId: this.selectedClientId,
        enabled: this.form.controls.enabled.value,
        intervalDays: this.toPositiveInt(this.form.controls.intervalDays.value, 3),
        maxReminders: Math.max(0, Number(this.form.controls.maxReminders.value || 0)),
        sendTime,
        timezone: this.form.controls.timezone.value.trim(),
        weekdays: [...this.form.controls.weekdays.value],
        templateId: (this.form.controls.templateIdDefault.value || '').trim(),
        templateIdAvaliado: (this.form.controls.templateIdAvaliado.value || '').trim(),
        templateIdAvaliador: (this.form.controls.templateIdAvaliador.value || '').trim(),
        updatedAt: new Date(),
        updatedBy: this.userEmail || 'system',
      };

      await setDoc(doc(this.firestore, 'reminderSettings', this.selectedClientId), payload, {
        merge: true,
      });

      await this.triggerImmediateReminderProcessing(this.selectedClientId);

      this.snackBar.open('Configuracoes de lembrete salvas com sucesso.', 'Fechar', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Erro ao salvar configuracoes de lembrete:', error);
      this.snackBar.open('Erro ao salvar configuracoes de lembrete.', 'Fechar', {
        duration: 3000,
      });
    } finally {
      this.isSaving = false;
    }
  }

  private async loadClients(): Promise<void> {
    try {
      if (this.userRole === 'admin_client') {
        const clientIds = await this.authService.getCurrentUserClientIds();
        const docs = await Promise.all(
          clientIds.map((clientId) => getDoc(doc(this.firestore, 'clients', clientId)))
        );

        this.clients = docs
          .filter((snap) => snap.exists())
          .map((snap) => {
            const data = snap.data() || {};
            return {
              id: snap.id,
              name: String(data['companyName'] || 'Cliente sem nome'),
            };
          });
        return;
      }

      const snapshot = await getDocs(collection(this.firestore, 'clients'));
      this.clients = snapshot.docs.map((clientDoc) => {
        const data = clientDoc.data() || {};
        return {
          id: clientDoc.id,
          name: String(data['companyName'] || 'Cliente sem nome'),
        };
      });
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.snackBar.open('Nao foi possivel carregar os clientes.', 'Fechar', {
        duration: 3000,
      });
      this.clients = [];
    }
  }

  private async triggerImmediateReminderProcessing(clientId: string): Promise<void> {
    const triggerUrl = environment.functions?.triggerPendingAssessmentRemindersUrl;
    if (!triggerUrl) {
      return;
    }

    try {
      const response = await fetch(triggerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });

      if (!response.ok) {
        const details = await response.text();
        console.warn('Falha ao acionar processamento imediato de lembretes:', details);
      }
    } catch (error) {
      console.warn('Erro ao acionar processamento imediato de lembretes:', error);
    }
  }

  private async loadTemplates(clientId: string): Promise<void> {
    try {
      // Busca completa para incluir:
      // 1) templates do cliente selecionado
      // 2) templates globais (clientId vazio, nulo ou ausente)
      const snapshot = await getDocs(collection(this.firestore, 'mailTemplates'));

      const normalizedClientId = String(clientId || '').trim();
      const templates: TemplateOption[] = [];

      snapshot.docs.forEach((templateDoc) => {
        const data = templateDoc.data() || {};
        const templateClientId = String(data['clientId'] || '').trim();
        const scope: TemplateOption['scope'] = templateClientId ? 'client' : 'global';

        if (scope === 'client' && templateClientId !== normalizedClientId) {
          return;
        }

        templates.push({
          id: templateDoc.id,
          name: String(data['name'] || 'Template sem nome'),
          subject: String(data['subject'] || ''),
          scope,
        });
      });

      this.templates = templates.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      this.templates = [];
    }
  }

  private async loadSettings(clientId: string): Promise<void> {
    try {
      const settingsDoc = await getDoc(doc(this.firestore, 'reminderSettings', clientId));
      this.form.reset({
        enabled: false,
        intervalDays: 3,
        maxReminders: 0,
        sendTime: '09:00',
        timezone: 'America/Fortaleza',
        weekdays: [],
        templateIdDefault: '',
        templateIdAvaliado: '',
        templateIdAvaliador: '',
      });
      this.lastRunAt = null;
      this.lastRunSummary = null;

      if (!settingsDoc.exists()) {
        return;
      }

      const data = settingsDoc.data() || {};
      this.form.patchValue({
        enabled: !!data['enabled'],
        intervalDays: this.toPositiveInt(data['intervalDays'], 3),
        maxReminders: Math.max(0, Number(data['maxReminders'] || 0)),
        sendTime: this.normalizeTime(data['sendTime']) || '09:00',
        timezone: String(data['timezone'] || 'America/Fortaleza'),
        weekdays: this.normalizeWeekdays(data['weekdays']),
        templateIdDefault: String(data['templateId'] || ''),
        templateIdAvaliado: String(data['templateIdAvaliado'] || ''),
        templateIdAvaliador: String(data['templateIdAvaliador'] || ''),
      });

      this.lastRunAt = this.toDate(data['lastRunAt']);
      const summary = data['lastRunSummary'] as ReminderRunSummary | undefined;
      if (summary) {
        this.lastRunSummary = {
          sent: Number(summary.sent || 0),
          skipped: Number(summary.skipped || 0),
          errors: Number(summary.errors || 0),
        };
      }
    } catch (error) {
      console.error('Erro ao carregar configuracoes de lembrete:', error);
      this.snackBar.open('Nao foi possivel carregar as configuracoes.', 'Fechar', {
        duration: 3000,
      });
    }
  }

  private normalizeWeekdays(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(
        value
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
      )
    ).sort((a, b) => a - b);
  }

  private normalizeTime(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    const matched = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
    if (!matched) return null;
    return `${matched[1]}:${matched[2]}`;
  }

  private isValidTimeZone(value: string): boolean {
    try {
      Intl.DateTimeFormat('pt-BR', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }

  private toPositiveInt(value: unknown, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const rounded = Math.floor(parsed);
    return rounded < 1 ? fallback : rounded;
  }

  private toDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'object' && value !== null) {
      const maybeToDate = (value as { toDate?: unknown }).toDate;
      if (typeof maybeToDate === 'function') {
        const date = maybeToDate.call(value) as Date;
        if (date instanceof Date && !Number.isNaN(date.getTime())) {
          return date;
        }
      }
    }

    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }
}
