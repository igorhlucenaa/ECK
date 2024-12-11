import { Component, signal } from '@angular/core';
import { getUser } from '../user-data';
import {
  mailGlobalVariable,
  mailService,
} from 'src/app/services/apps/email/email.service';
import { Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { CommonModule } from '@angular/common';
import { NgScrollbarModule } from 'ngx-scrollbar';

@Component({
  selector: 'app-maildetail',
  templateUrl: './detail.component.html',
  standalone: true,
  imports: [MaterialModule, TablerIconsModule, CommonModule, NgScrollbarModule],
})
export class DetailComponent {
  // tslint:disable-next-line: no-shadowed-variable

  selectedMail = this.ms.selectedMail;
  users = signal<any[]>([]);
  topLabel = signal<string>('Inbox');
  type = signal<string>('inbox');

  constructor(
    public ms: mailGlobalVariable,
    public mailService: mailService,
    public router: Router
  ) {}

  labelClick(type: string): void {
    const mail = this.selectedMail();
    if (mail) {
      if (!mail.label.includes(type)) {
        mail.label.push(type);
      } else {
        mail.label = mail.label.filter((label: string) => label !== type);
      }
    }
  }

  ddlRemoveClick(st: string): void {
    const mail = this.selectedMail();
    if (mail) {
      if (st === 'Spam') {
        mail.mailbox = 'Spam';
        this.ms.spamList().push(mail);
        this.resetSelectedMail();
      } else if (st === 'Trash') {
        mail.mailbox = 'Trash';
        this.ms.trashList().push(mail);
        this.resetSelectedMail();
      } else if (st === 'Read') {
        mail.seen = !mail.seen;
      }
    }
  }
  resetSelectedMail(): void {
    this.selectedMail.set(null);
  }

  iconsClick(name: string): void {
    this.ms.toggleStar(name);
  }
  resetCount(): void {
    this.ms.inboxList.set(this.mailService.getInbox());
    this.ms.sentList.set(this.mailService.getSent());
    this.ms.draftList.set(this.mailService.getDraft());
    this.ms.spamList.set(this.mailService.getSpam());
    this.ms.trashList.set(this.mailService.getTrash());

    const usersArray: any[] = [];
    for (const mail of this.ms.mailList()) {
      const user = getUser(mail.fromId);
      if (user) {
        usersArray.push(user);
      }
    }

    this.users.set(usersArray);
    this.ms.collectionSize.set(this.ms.inboxList.length);
    this.resetSelectedMail();
    this.topLabel.set('Inbox');
    this.type.set('inbox');
  }

  reply(): void {
    this.ms.replyShow.set(true);
  }

  sendButtonClick(): void {
    this.ms.replyShow.set(false);
  }

  removeClass(): void {
    this.ms.selectedMail.set(null);
  }
}
