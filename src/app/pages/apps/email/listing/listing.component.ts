import { Component, OnInit, Inject, signal } from '@angular/core';
import { Category, mailbox, filter, label } from './categories';
import { MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  mailGlobalVariable,
  mailService,
} from 'src/app/services/apps/email/email.service';
import { getUser, User } from '../user-data';
import { mailboxList } from '../email-data';
import { Mailbox } from '../email';
import { Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import {
  AngularEditorConfig,
  AngularEditorModule,
} from '@kolkov/angular-editor';
import {
  FormsModule,
  ReactiveFormsModule,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { NgxPaginationModule } from 'ngx-pagination';
import { DetailComponent } from '../detail/detail.component';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar } from '@angular/material/snack-bar';

type MailboxType = 'Inbox' | 'Sent' | 'Draft' | 'Spam' | 'Trash';

@Component({
  selector: 'app-dialog-data-example-dialog',
  templateUrl: 'compose-dialog-content.html',
  standalone: true,
  imports: [
    MaterialModule,
    AngularEditorModule,
    FormsModule,
    ReactiveFormsModule,
  ],
})
export class ListingDialogDataExampleDialogComponent {
  form: UntypedFormGroup;

  htmlContent1 = '';

  config1: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    minHeight: '9rem',
    maxHeight: '20rem',
    placeholder: 'Enter text here...',
    translate: 'no',
    sanitize: false,
    // toolbarPosition: 'top',
    outline: true,
    defaultFontName: 'Comic Sans MS',
    defaultFontSize: '5',
    // showToolbar: false,
    defaultParagraphSeparator: 'p',
    customClasses: [
      {
        name: 'quote',
        class: 'quote',
      },
      {
        name: 'redText',
        class: 'redText',
      },
      {
        name: 'titleText',
        class: 'titleText',
        tag: 'h1',
      },
    ],
    toolbarPosition: 'top',
    toolbarHiddenButtons: [['bold', 'italic'], ['fontSize']],
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private formBuilder: UntypedFormBuilder
  ) {}

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      signature: ['', Validators.required],
    });
    console.log(this.htmlContent1);
  }

  onChange(event: any) {
    console.log('changed');
  }

  onBlur(event: any) {
    console.log('blur ' + event);
  }
}

@Component({
  selector: 'app-listing',
  standalone: true,
  templateUrl: './listing.component.html',
  styleUrls: ['./listing.component.scss'],
  imports: [
    MaterialModule,
    CommonModule,
    NgScrollbarModule,
    TablerIconsModule,
    NgxPaginationModule,
    DetailComponent,
    MatCheckboxModule,
    FormsModule,
  ],
})
export class ListingComponent implements OnInit {
  searchText = signal('');
  private mediaMatcher: MediaQueryList = matchMedia(`(max-width: 960px)`);
  sidePanelOpened = signal(true);
  displayMode = signal('default');
  p = signal(1);

  mailboxes = signal<Category[] | any>(mailbox);
  filters = signal<Category[]>(filter);
  labels = signal<Category[]>(label);
  selectedIndex = signal<string>('');
  activeFilter = signal<string | null>(null);
  activeLabel = signal<string | null>(null);
  isChecked = false;
  showDetail = signal(false);

  constructor(
    public ms: mailGlobalVariable,
    public mailService: mailService,
    public router: Router,
    public dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    if (!this.ms.type()) {
      this.router.navigate(['apps/email/inbox']);
    }
    this.ms.type.set('inbox');
  }

  isOver(): boolean {
    return window.innerWidth < 1199;
  }

  ngOnInit(): void {
    this.loadMailboxes();
    this.ms.topLabel.set('Inbox');
    this.selectFirstMail();
    window.addEventListener('resize', () => {
      this.showDetail.set(false); // Hide detail when resizing to a larger screen
    });
  }

  private selectFirstMail(): void {
    const inboxMails = this.ms.inboxList();
    if (inboxMails.length > 0) {
      this.mailSelected(inboxMails[0]);
    }
  }

  private loadMailboxes(): void {
    this.ms.inboxList.set(this.mailService.getInbox());
    this.ms.sentList.set(this.mailService.getSent());
    this.ms.draftList.set(this.mailService.getDraft());
    this.ms.spamList.set(this.mailService.getSpam());
    this.ms.trashList.set(this.mailService.getTrash());

    this.updateMailListAndUsers(this.ms.inboxList());
  }

  private updateMailListAndUsers(mailList: Mailbox[]): void {
    this.ms.mailList.set(mailList);
    this.ms.collectionSize.set(mailList.length);
    this.ms.users.set(this.extractUsers(mailList));
  }

  private extractUsers(mailList: Mailbox[]): User[] | any {
    return mailList
      .map((mail) => getUser(mail.fromId))
      .filter((user) => user !== null);
  }

  mailSelected(mail: Mailbox): void {
    const currentMailbox = this.ms.mailList(); // Get the current mailbox
    const mailExists = currentMailbox.some(
      (item: { MailId: string }) => item.MailId === mail.MailId
    );

    if (!mailExists) {
      this.ms.selectedMail.set(null); // Clear selected mail if it doesn't exist
      this.selectedIndex.set(''); // Clear selected index
      return; // Exit early if the mail does not exist
    }

    // Set the selected mail and mark it as seen
    this.ms.selectedMail.set(mail);
    mail.seen = true;
    this.ms.selectedUser.set(getUser(mail.fromId));
    this.selectedIndex.set(mail.MailId);

    if (this.isOver()) {
      this.showDetail.set(true); // Show detail on smaller screens
    }
  }

  mailboxesChanged(type: MailboxType): void {
    const listMap: Record<MailboxType, () => Mailbox[]> = {
      Inbox: this.ms.inboxList,
      Sent: this.ms.sentList,
      Draft: this.ms.draftList,
      Spam: this.ms.spamList,
      Trash: this.ms.trashList,
    };

    this.updateMailListAndUsers(listMap[type]());
    this.ms.topLabel.set(type);
    this.mailActiveClass(type);
    this.ms.type.set(type.toLowerCase());
    this.router.navigate([`apps/email/${type.toLowerCase()}`]);
  }

  mailActiveClass(type: string): void {
    mailbox.forEach((mail) => (mail.active = mail.name === type));
  }
  iconsClick(name: string): void {
    this.ms.toggleStar(name);
  }

  filtersClick(type: string): void {
    this.activeLabel.set(null);
    this.activeFilter.set(type);
    this.mailActiveClass('');
    const filteredMails = mailboxList.filter((mail) =>
      mail.filter.includes(type)
    );
    this.updateMailListAndUsers(filteredMails);
    this.ms.topLabel.set(type);
    this.mailActiveClass(type);
    this.ms.type.set(type.toLowerCase());
    this.router.navigate([`apps/email/${type.toLowerCase()}`]);
  }
  labelChange(type: string): void {
    this.activeFilter.set(null);
    this.activeLabel.set(type);
    this.mailActiveClass('');
    const labeledMails = mailboxList.filter((mail) =>
      mail.label.includes(type)
    );
    this.updateMailListAndUsers(labeledMails);
    this.ms.topLabel.set(type);
    this.ms.type.set(type);
    this.router.navigate([`apps/email/${type.toLowerCase()}`]);
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(
      ListingDialogDataExampleDialogComponent,
      {}
    );
    dialogRef.afterClosed().subscribe((result) => {
      console.log(`Dialog result: ${result}`);
    });
  }

  deleteItem(mail: Mailbox): void {
    const snackBarRef = this.snackBar.open(
      'Are you sure you want to delete this mail?',
      'Delete',
      {
        duration: 15000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
      }
    );
    snackBarRef.onAction().subscribe(() => {
      // This code runs when the user clicks the 'Delete' button
      const currentInbox = this.ms.inboxList();
      const updatedInbox = currentInbox.filter(
        (item: { MailId: string }) => item.MailId !== mail.MailId
      );

      this.ms.inboxList.set(updatedInbox);
      this.updateMailListAndUsers(updatedInbox);
    });
  }

  onCheckboxChange(selectedMail: Mailbox): void {
    this.mailboxes().forEach((mail: { MailId: string; isChecked: boolean }) => {
      if (mail.MailId !== selectedMail.MailId) {
        mail.isChecked = false;
      }
    });

    selectedMail.isChecked = true;
  }
}
