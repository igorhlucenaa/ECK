import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TranslateModule } from '@ngx-translate/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';

export interface SendHistoryParticipant {
  id: string;
  name: string;
  email: string;
  type: string;
  category: string;
  status?: string;
  projectName?: string;
  reminderCount?: number;
  nextReminderAt?: Date;
  lastReminderAt?: Date;
  maxReminders?: number;
  intervalDays?: number;
  reminderEnabled?: boolean;
}

export interface EmailHistoryEntry {
  type: 'convite' | 'lembrete';
  sentAt: any;
  status: 'enviado' | 'erro';
  templateId?: string;
  error?: string;
}

export interface AssessmentLinkDoc {
  id: string;
  assessmentId?: string;
  status?: string;
  sentAt?: any;
  completedAt?: any;
  reminderCount?: number;
  nextReminderAt?: any;
  lastReminderSentAt?: any;
  lastReminderError?: string;
  emailHistory?: EmailHistoryEntry[];
  emailTemplate?: string;
  reminderTemplateId?: string;
}

export interface HistoryRow extends EmailHistoryEntry {
  linkId: string;
  sequenceLabel: string; // "Convite" | "Lembrete 1" | "Lembrete 2" ...
}

@Component({
  selector: 'app-send-history-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TranslateModule],
  templateUrl: './send-history-dialog.component.html',
  styleUrls: ['./send-history-dialog.component.scss'],
})
export class SendHistoryDialogComponent implements OnInit {
  isLoading = true;
  links: AssessmentLinkDoc[] = [];
  history: HistoryRow[] = [];
  nextReminderDate: Date | null = null;
  hasReminderConfig = false;

  constructor(
    private firestore: Firestore,
    public dialogRef: MatDialogRef<SendHistoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { participant: SendHistoryParticipant }
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadHistory();
  }

  async loadHistory(): Promise<void> {
    this.isLoading = true;
    try {
      const snap = await getDocs(
        query(
          collection(this.firestore, 'assessmentLinks'),
          where('participantId', '==', this.data.participant.id)
        )
      );

      this.links = snap.docs.map(d => ({ id: d.id, ...d.data() } as AssessmentLinkDoc));

      // Resolve next reminder date from most recent pending link
      const pendingLink = this.links.find(l => l.status === 'pending' && l.nextReminderAt);
      this.nextReminderDate = pendingLink ? this.toDate(pendingLink.nextReminderAt) : null;
      this.hasReminderConfig = !!this.data.participant.reminderEnabled;

      // Build history rows
      const rows: HistoryRow[] = [];
      let lembreteCounter = 0;

      for (const link of this.links) {
        if (link.emailHistory && link.emailHistory.length > 0) {
          for (const entry of link.emailHistory) {
            if (entry.type === 'lembrete') lembreteCounter++;
            rows.push({
              ...entry,
              linkId: link.id,
              sequenceLabel: entry.type === 'convite'
                ? 'Convite inicial'
                : `Lembrete ${lembreteCounter}`,
            });
          }
        } else {
          // Fallback for links that predate history tracking
          if (link.sentAt) {
            rows.push({
              type: 'convite',
              sentAt: link.sentAt,
              status: 'enviado',
              templateId: link.emailTemplate,
              linkId: link.id,
              sequenceLabel: 'Convite inicial',
            });
          }
          if (link.lastReminderSentAt && link.reminderCount && link.reminderCount > 0) {
            for (let i = 1; i <= link.reminderCount; i++) {
              rows.push({
                type: 'lembrete',
                sentAt: i === link.reminderCount ? link.lastReminderSentAt : null,
                status: 'enviado',
                templateId: link.reminderTemplateId,
                linkId: link.id,
                sequenceLabel: `Lembrete ${i}`,
              });
            }
          }
        }
      }

      // Sort by sentAt descending (most recent on top)
      this.history = rows.sort((a, b) => {
        const aT = this.toDate(a.sentAt)?.getTime() ?? 0;
        const bT = this.toDate(b.sentAt)?.getTime() ?? 0;
        return bT - aT;
      });

    } catch (e) {
      console.error('[SendHistoryDialog] Erro ao carregar histórico:', e);
    } finally {
      this.isLoading = false;
    }
  }

  toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  formatDate(value: any): string {
    const d = this.toDate(value);
    if (!d) return '—';
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  relativeTime(value: any): string {
    const d = this.toDate(value);
    if (!d) return '';
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return 'agora há pouco';
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `há ${diffH}h`;
    const diffD = Math.round(diffH / 24);
    return `há ${diffD} dia${diffD !== 1 ? 's' : ''}`;
  }

  futureRelativeTime(value: any): string {
    const d = this.toDate(value);
    if (!d) return '';
    const diffMs = d.getTime() - Date.now();
    if (diffMs <= 0) return 'processando...';
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 60) return `em ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `em ${diffH}h`;
    const diffD = Math.round(diffH / 24);
    return `em ${diffD} dia${diffD !== 1 ? 's' : ''}`;
  }

  get totalSent(): number {
    return this.history.filter(h => h.status === 'enviado').length;
  }

  get totalErrors(): number {
    return this.history.filter(h => h.status === 'erro').length;
  }

  close(): void {
    this.dialogRef.close();
  }
}
