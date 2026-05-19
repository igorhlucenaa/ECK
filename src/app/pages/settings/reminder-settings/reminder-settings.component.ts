import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  DocumentData,
  FieldValue,
  Firestore,
  QueryDocumentSnapshot,
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppPageHeaderComponent } from 'src/app/components/page-header/page-header.component';
import { MaterialModule } from 'src/app/material.module';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { environment } from 'src/enviroments/environment';

interface ClientOption {
  id: string;
  name: string;
}

interface ProjectOption {
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
    startDate: this.fb.control<Date | null>(null, [Validators.required]),
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

  readonly today: Date = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  readonly filterStartDates = (d: Date | null): boolean => !d || d >= this.today;

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
  clientsFiltered: ClientOption[] = [];
  clientSearchCtrl = new FormControl('');
  projects: ProjectOption[] = [];
  templates: TemplateOption[] = [];
  viewerProjectIds = new Set<string>();
  selectedClientId = '';
  selectedProjectId = '';
  isLoadingProjects = false;

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

  /** Chave do documento Firestore: sempre por projeto */
  get settingsDocId(): string {
    return `${this.selectedClientId}_${this.selectedProjectId}`;
  }

  get selectedClientName(): string {
    return this.clients.find(c => c.id === this.selectedClientId)?.name || '';
  }

  get selectedProjectName(): string {
    return this.projects.find(p => p.id === this.selectedProjectId)?.name || '';
  }

  async ngOnInit(): Promise<void> {
    this.userRole = (await this.authService.getCurrentUserRole()) || '';
    this.userEmail = (await this.authService.getCurrentUserEmail()) || '';
    if (this.userRole === 'viewer') {
      await this.loadViewerProjectIds();
    }

    await this.loadClients();
    this.resetClientSearch();
    this.clientSearchCtrl.valueChanges.subscribe(s => {
      const q = (s || '').toLowerCase();
      this.clientsFiltered = this.clients.filter(c => c.name.toLowerCase().includes(q));
    });

    if (!this.clients.length) {
      this.isLoading = false;
      return;
    }

    this.selectedClientId = this.clients[0].id;
    // Carrega projetos e templates; settings só carregam depois que o usuário selecionar um projeto
    await Promise.all([
      this.loadTemplates(this.selectedClientId),
      this.loadProjects(this.selectedClientId),
    ]);
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
    this.selectedProjectId = '';
    this.projects = [];
    // Limpa o formulário ao trocar de cliente (nenhum projeto selecionado ainda)
    this.form.reset({ enabled: false, startDate: null, intervalDays: 3, maxReminders: 0, sendTime: '09:00', timezone: 'America/Fortaleza', weekdays: [], templateIdDefault: '', templateIdAvaliado: '', templateIdAvaliador: '' });
    this.lastRunAt = null;
    this.lastRunSummary = null;
    this.isLoading = true;
    await Promise.all([
      this.loadTemplates(clientId),
      this.loadProjects(clientId),
    ]);
    this.isLoading = false;
  }

  async onProjectChange(projectId: string): Promise<void> {
    this.selectedProjectId = projectId;
    if (!projectId) {
      // Sem projeto selecionado: limpa o formulário
      this.form.reset({ enabled: false, startDate: null, intervalDays: 3, maxReminders: 0, sendTime: '09:00', timezone: 'America/Fortaleza', weekdays: [], templateIdDefault: '', templateIdAvaliado: '', templateIdAvaliador: '' });
      this.lastRunAt = null;
      this.lastRunSummary = null;
      return;
    }
    this.isLoading = true;
    await this.loadSettings();
    this.isLoading = false;
  }

  private async loadProjects(clientId: string): Promise<void> {
    if (!clientId) { this.projects = []; return; }
    this.isLoadingProjects = true;
    try {
      const snap = await getDocs(
        query(collection(this.firestore, 'projects'), where('clientId', '==', clientId))
      );
      this.projects = snap.docs
        .filter(d => !['Cancelado', 'Inativo'].includes(d.data()['status'] || ''))
        .map(d => ({ id: d.id, name: String(d.data()['name'] || 'Projeto sem nome') }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      if (this.userRole === 'viewer' && this.viewerProjectIds.size > 0) {
        this.projects = this.projects.filter((project) =>
          this.viewerProjectIds.has(project.id)
        );
      }
    } catch (e) {
      console.error('Erro ao carregar projetos:', e);
      this.projects = [];
    } finally {
      this.isLoadingProjects = false;
    }
  }

  async saveSettings(): Promise<void> {
    if (!this.selectedClientId || !this.selectedProjectId) {
      this.snackBar.open('Selecione um cliente e um projeto para salvar as configuracoes.', 'Fechar', {
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

    const startDateValue = this.form.controls.startDate.value;
    if (!startDateValue) {
      this.snackBar.open('Selecione a data de início dos lembretes.', 'Fechar', { duration: 3000 });
      return;
    }
    const startDate = new Date(startDateValue);
    startDate.setHours(0, 0, 0, 0);

    this.isSaving = true;
    try {
      const payload = {
        clientId: this.selectedClientId,
        enabled: this.form.controls.enabled.value,
        startDate: Timestamp.fromDate(startDate),
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

      const payloadWithScope = { ...payload, projectId: this.selectedProjectId };

      await setDoc(
        doc(this.firestore, 'reminderSettings', this.settingsDocId),
        payloadWithScope,
        { merge: true }
      );

      await this.propagateSettingsToLinks(
        this.selectedClientId,
        this.selectedProjectId,
        payload.enabled,
        startDate,
        payload.intervalDays,
        payload.maxReminders,
        sendTime,
        payload.timezone,
        payload.weekdays
      );

      await this.triggerImmediateReminderProcessing(this.selectedClientId, this.selectedProjectId);

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

  /**
   * Retorna o instante UTC correspondente a `sendTime` no `timezone` do dia
   * que fica `offsetDays` dias após `base` (adição em ms, sem arredondar para
   * meia-noite, de forma que cruzamentos de DST sejam tratados corretamente).
   * Usa formatToParts para ser imune a separadores de locale.
   */
  private buildOccurrenceAt(base: Date, offsetDays: number, sendTime: string, timezone: string): Date {
    const targetDay = new Date(base.getTime() + offsetDays * 86_400_000);

    const dateFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const dp = dateFmt.formatToParts(targetDay);
    const year  = dp.find(p => p.type === 'year')?.value  ?? '2000';
    const month = dp.find(p => p.type === 'month')?.value ?? '01';
    const day   = dp.find(p => p.type === 'day')?.value   ?? '01';
    const datePart = `${year}-${month}-${day}`;

    // Offset UTC: verificamos o que o meio-dia UTC parece no timezone alvo
    const noonUtc = new Date(`${datePart}T12:00:00Z`);
    const timeFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: false,
    });
    const tp = timeFmt.formatToParts(noonUtc);
    const tzH = Number(tp.find(p => p.type === 'hour')?.value   ?? '0');
    const tzM = Number(tp.find(p => p.type === 'minute')?.value ?? '0');
    const offsetMin = tzH * 60 + tzM - 720; // ex: -180 para UTC-3

    const [sh, sm] = sendTime.split(':').map(Number);
    const utcMin = sh * 60 + sm - offsetMin;
    const dayStartUtc = new Date(`${datePart}T00:00:00Z`).getTime();
    return new Date(dayStartUtc + utcMin * 60_000);
  }

  /**
   * Encontra o próximo disparo futuro em O(1):
   * - Se lastSent existe: próxima ocorrência a partir de lastSent + intervalDays
   * - Se não: primeira ocorrência a partir de startDate (disparo no próprio startDate)
   * - Se o resultado ainda estiver no passado, salta para frente pelo número mínimo
   *   de intervalos necessários para ultrapassar `now`.
   */
  private computeNextReminder(
    lastSent: Date | null,
    startDate: Date,
    intervalDays: number,
    sendTime: string,
    timezone: string,
    now: Date,
    weekdays: number[] = [],
  ): Date {
    // Âncora e offset inicial
    const anchor      = lastSent ?? startDate;
    const firstOffset = lastSent ? intervalDays : 0; // sem lastSent → dispara no próprio startDate

    let next = this.buildOccurrenceAt(anchor, firstOffset, sendTime, timezone);
    next = this.advanceToAllowedWeekday(next, timezone, weekdays);

    if (next > now) return next;

    // Salta direto para o slot futuro mais próximo (O(1))
    const msPerInterval = intervalDays * 86_400_000;
    const gap   = now.getTime() - next.getTime();
    const extra = Math.ceil(gap / msPerInterval);          // quantos intervalos a pular
    next = this.buildOccurrenceAt(anchor, firstOffset + intervalDays * extra, sendTime, timezone);
    next = this.advanceToAllowedWeekday(next, timezone, weekdays);

    // Margem de segurança para bordas de DST
    if (next <= now) {
      next = this.buildOccurrenceAt(anchor, firstOffset + intervalDays * (extra + 1), sendTime, timezone);
      next = this.advanceToAllowedWeekday(next, timezone, weekdays);
    }

    return next;
  }

  private advanceToAllowedWeekday(date: Date, timezone: string, weekdays: number[] = []): Date {
    const allowedWeekdays = this.normalizeWeekdays(weekdays);
    if (!allowedWeekdays.length) return date;

    for (let offset = 0; offset < 7; offset++) {
      const candidate = new Date(date.getTime() + offset * 86_400_000);
      if (allowedWeekdays.includes(this.getWeekdayInTimezone(candidate, timezone))) {
        return candidate;
      }
    }

    return date;
  }

  private getWeekdayInTimezone(date: Date, timezone: string): number {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(date).toLowerCase();
    const map: Record<string, number> = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };
    return map[weekday.slice(0, 3)] ?? date.getDay();
  }

  private async propagateSettingsToLinks(
    clientId: string,
    projectId: string,
    enabled: boolean,
    startDate: Date,
    intervalDays: number,
    maxReminders: number,
    sendTime: string,
    timezone: string,
    weekdays: number[],
  ): Promise<void> {
    try {
      // Busca links por clientId+projectId (novos) E por assessmentId (legados sem esses campos).
      // Ambas as queries rodam em paralelo; o resultado é deduplicado por ID de documento.
      const projectSnap = await getDoc(doc(this.firestore, 'projects', projectId));
      const assessmentId: string | null = projectSnap.exists()
        ? (projectSnap.data()['assessmentId'] || null)
        : null;

      const [newSnap, oldSnap] = await Promise.all([
        getDocs(query(
          collection(this.firestore, 'assessmentLinks'),
          where('clientId', '==', clientId),
          where('projectId', '==', projectId),
          where('status', '==', 'pending'),
        )),
        assessmentId
          ? getDocs(query(
              collection(this.firestore, 'assessmentLinks'),
              where('assessmentId', '==', assessmentId),
              where('status', '==', 'pending'),
            ))
          : Promise.resolve(null),
      ]);

      const docsMap = new Map<string, QueryDocumentSnapshot<DocumentData>>();
      newSnap.docs.forEach(d => docsMap.set(d.id, d));
      oldSnap?.docs.forEach(d => docsMap.set(d.id, d));

      if (docsMap.size === 0) return;

      const now   = new Date();
      const BATCH = 400;
      let batch   = writeBatch(this.firestore);
      let ops     = 0;

      for (const linkDoc of docsMap.values()) {
        const data: DocumentData = linkDoc.data();
        const reminderCount: number = data['reminderCount'] ?? 0;
        const update: { [field: string]: FieldValue | Timestamp } = {};

        if (!enabled) {
          update['nextReminderAt'] = deleteField();
        } else if (maxReminders > 0 && reminderCount >= maxReminders) {
          update['nextReminderAt'] = deleteField();
        } else {
          // Usa lastReminderSentAt quando disponível (mantém cadência real);
          // caso contrário ancora em startDate (configura a partir do zero).
          const lastSent = this.toDate(data['lastReminderSentAt']);
          const next = this.computeNextReminder(
            lastSent,
            startDate,
            intervalDays,
            sendTime,
            timezone,
            now,
            weekdays
          );
          update['nextReminderAt'] = Timestamp.fromDate(next);
        }

        batch.update(linkDoc.ref, update);
        if (++ops >= BATCH) {
          await batch.commit();
          batch = writeBatch(this.firestore);
          ops   = 0;
        }
      }

      if (ops > 0) await batch.commit();
    } catch (error) {
      console.error('Erro ao propagar configurações para assessmentLinks:', error);
    }
  }

  resetClientSearch(): void {
    this.clientSearchCtrl.setValue('', { emitEvent: false });
    this.clientsFiltered = [...this.clients];
  }

  private async loadClients(): Promise<void> {
    try {
      if (this.userRole === 'admin_client' || this.userRole === 'viewer') {
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

  private async loadViewerProjectIds(): Promise<void> {
    this.viewerProjectIds.clear();
    if (!this.userEmail) return;

    const usersSnap = await getDocs(
      query(collection(this.firestore, 'users'), where('email', '==', this.userEmail))
    );
    if (usersSnap.empty) return;

    const userData = usersSnap.docs[0].data() || {};
    const fromArray = Array.isArray(userData['projects']) ? userData['projects'] : [];
    const fromSingle =
      typeof userData['project'] === 'string' && userData['project'].trim()
        ? [userData['project']]
        : [];

    [...fromArray, ...fromSingle].forEach((projectId) => this.viewerProjectIds.add(projectId));
  }

  private async triggerImmediateReminderProcessing(clientId: string, projectId?: string): Promise<void> {
    const triggerUrl = environment.functions?.triggerPendingAssessmentRemindersUrl;
    if (!triggerUrl) {
      return;
    }

    try {
      const body: Record<string, string> = { clientId };
      if (projectId) body['projectId'] = projectId;

      const response = await fetch(triggerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  private async loadSettings(): Promise<void> {
    try {
      // Carrega exclusivamente a config do projeto selecionado
      const settingsDoc = await getDoc(doc(this.firestore, 'reminderSettings', this.settingsDocId));

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
        startDate: this.toDate(data['startDate']),
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
