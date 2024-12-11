import {
  Component,
  computed,
  HostListener,
  NgModule,
  OnInit,
  signal,
  Signal,
  ViewChild,
} from '@angular/core';
import { Category, filter, label } from './categories';
import { DetailComponent } from '../detail/detail.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ContactFormDialogComponent } from '../contact-form-dialog/contact-form-dialog.component';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { NgScrollbarModule } from 'ngx-scrollbar';

import { ContactService } from 'src/app/services/apps/contactapp/contact.service';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ContactBox } from 'src/app/pages/apps/contact-app/contact';

import { ConfirmationDialogDeleteComponent } from '../confirmation-dialog-delete/confirmation-dialog-delete.component';
import { MatSidenav } from '@angular/material/sidenav';
import { AppSearchDialogComponent } from 'src/app/layouts/full/vertical/header/header.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-listening',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DetailComponent,
    MaterialModule,
    ReactiveFormsModule,
    ConfirmationDialogDeleteComponent,
    TablerIconsModule,
    NgScrollbarModule,
    CommonModule,
  ],
  templateUrl: './listening.component.html',
  styleUrls: ['./listing.component.css'],
})
export class ListeningComponent implements OnInit {
  constructor(
    public dialog: MatDialog,
    public contactService: ContactService,
    private snackBar: MatSnackBar
  ) {}

  searchTerm = signal<string>('');
  private mediaMatcher: MediaQueryList = matchMedia(`(max-width: 1199px)`);
  filters: Category[] = [];
  labels: Category[] = [];
  selectedFilter: Category | null = null;
  selectedCategory: Category | null = null;
  selectedContact = signal<ContactBox | null>(null);
  isActiveContact: boolean = false;

  isOver(): boolean {
    return this.mediaMatcher.matches;
  }

  openDialog() {
    const dialogRef = this.dialog.open(AppSearchDialogComponent);

    dialogRef.afterClosed().subscribe((result) => {
      console.log(`Dialog result: ${result}`);
    });
  }

  filteredContacts = computed(() => {
    let filtered = this.contactService.contactList();

    // Apply category filter if selected
    if (
      this.contactService.selectedCategory() &&
      this.contactService.selectedCategory()?.name !== 'All'
    ) {
      filtered = filtered.filter(
        (contact) =>
          contact.department === this.contactService.selectedCategory()?.name
      );
    }

    // Apply filter based on selectedFilter only if no category is selected
    if (
      !this.contactService.selectedCategory() ||
      this.contactService.selectedCategory()?.name === 'All'
    ) {
      if (this.contactService.selectedFilter()) {
        if (this.contactService.selectedFilter()?.name === 'Frequent') {
          filtered = filtered.filter((contact) => contact.frequentlycontacted);
        } else if (this.contactService.selectedFilter()?.name === 'Starred') {
          filtered = filtered.filter((contact) => contact.starred);
        }
      }
    }

    // Apply search term filter
    const searchTermLower = this.searchTerm().toLowerCase();
    filtered = filtered.filter(
      (contact) =>
        contact.firstname.toLowerCase().includes(searchTermLower) ||
        contact.lastname.toLowerCase().includes(searchTermLower)
    );
    return filtered;
  });

  ngOnInit() {
    // Set up the data after the service has been initialized

    this.filters = this.contactService.filters();
    this.labels = this.contactService.labels();
    this.selectedFilter = this.contactService.selectedFilter();
    this.selectedCategory = this.contactService.selectedCategory();

    this.contactService.contactList.set(this.contactService.contactList());

    // Set the selected contact to the first contact if available
    const contacts = this.contactService.contactList();
    this.selectedContact.set(contacts[0]);

    // Initialize labels and filters from the data file
    this.contactService.labels.set(label);
    this.contactService.filters.set(filter);

    // Set the first filter as active by default
    const firstFilter = this.contactService.filters()[0];
    if (firstFilter) {
      this.contactService.selectedFilter.set(firstFilter);
      this.contactService.filters.set(
        this.contactService
          .filters()
          .map((f) => ({ ...f, active: f === firstFilter }))
      );
    }
  }

  goBack() {
    this.selectedContact.set(null);
    this.isActiveContact = false;
  }
  selectContact(contact: ContactBox): void {
    this.isActiveContact = true;
    this.selectedContact.set(contact);
    this.contactService.setSelectedContact(contact);
  }

  applyFilter(filter: Category): void {
    this.contactService.applyFilter(filter);
  }

  applyCategory(category: Category): void {
    this.contactService.applyCategory(category);
  }

  toggleStarred(contact: ContactBox, $event: any): void {
    this.contactService.toggleStarred(contact, $event);
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
        // Delete the contact
        this.contactService.deleteContact(contact);
        // Check if the deleted contact was selected and clear selection if so
        if (
          this.selectedContact() &&
          this.selectedContact()?.id === contact.id
        ) {
          this.contactService.setSelectedContact(null);
          this.selectedContact.set(null);
        }
        this.snackBar.open(
          `${contact.firstname} ${contact.lastname} deleted successfully!`,
          'Close',
          {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
          }
        );
      }
    });
  }

  openAddContactDialog(): void {
    const dialogRef = this.dialog.open(ContactFormDialogComponent, {
      width: '400px',
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.contactService.contactList.set([
          result,
          ...this.contactService.contactList(),
        ]);

        this.contactService.setSelectedContact(result);
        this.selectedContact.set(result);
      }
    });
  }
}
