import {
  Component,
  computed,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ContactService } from 'src/app/services/apps/contactapp/contact.service';
import { ConfirmationDialogDeleteComponent } from '../confirmation-dialog-delete/confirmation-dialog-delete.component';
import { MatDialog } from '@angular/material/dialog';
import { ContactBox } from 'src/app/pages/apps/contact-app/contact';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgScrollbarModule } from 'ngx-scrollbar';
@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [
    MatDividerModule,
    FormsModule,
    CommonModule,
    MaterialModule,
    ConfirmationDialogDeleteComponent,
    TablerIconsModule,
    NgScrollbarModule,
  ],
  templateUrl: './detail.component.html',
})
export class DetailComponent implements OnInit {
  isEditing = signal<boolean>(false);
  contact = signal<any | null>(null);
  formData = signal<any | null>(null);
  selectedContact = computed(() => this.contactService.getSelectedContact());

  constructor(
    public dialog: MatDialog,
    private contactService: ContactService,
    private snackBar: MatSnackBar
  ) {}

  departments = [
    { id: 1, name: 'Sales' },
    { id: 2, name: 'Support' },
    { id: 2, name: 'Engineering' },
  ];

  ngOnInit(): void {
    this.contactService.selectedContact$.subscribe((contact) => {
      this.contact.set(contact);
      this.formData.set(contact ? { ...contact } : null);
    });
  }

  toggleStarred(contact: ContactBox, event: Event): void {
    this.contactService.toggleStarred(contact, event);
    this.contactService.updateContact(contact);
  }

  saveContact(): void {
    const contact = this.formData();
    if (contact) {
      this.contactService.updateContact(contact);
      this.isEditing.set(false);
    }
  }

  track(department: any) {
    return department.id;
  }

  editContact(): void {
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
    this.formData.set(this.contact() ? { ...this.contact() } : null);
  }

  deleteContact(contact: ContactBox): void {
    const dialogRef = this.dialog.open(ConfirmationDialogDeleteComponent, {
      width: '300px',
      data: {
        message: `Are you sure you want to delete ${contact.firstname} ${contact.lastname}?`,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.contactService.deleteContact(contact);
      }
    });
  }
}
