import { Component, OnInit, Inject, Optional, signal } from '@angular/core';
import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { Contact } from './contact';
import { ContactService } from 'src/app/services/apps/contact/contact.service';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface ContactData {
  contacts: Contact[];
  searchText: any;
  Contactname: string;
  ContactPost: string;
  Contactadd: string;
  Contactno: string;
  Contactinstagram: string;
  Contactlinkedin: string;
  Contactfacebook: string;
}

@Component({
  templateUrl: './contact.component.html',
  imports: [
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    TablerIconsModule,
    CommonModule,
  ],
  standalone: true,
})
export class AppContactComponent implements OnInit {
  Contactname = signal<string>('');
  ContactPost = signal<string>('');
  Contactadd = signal<string>('');
  Contactno = signal<string>('');
  Contactinstagram = signal<string>('');
  Contactlinkedin = signal<string>('');
  Contactfacebook = signal<string>('');

  contacts = signal<Contact[]>([]);
  searchText = signal<string>('');

  constructor(
    public dialog: MatDialog,
    private contactService: ContactService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.contacts.set(this.contactService.getContacts());
  }

  openDialog(action: string, obj: any): void {
    obj.action = action;
    const dialogRef = this.dialog.open(AppContactDialogContentComponent, {
      data: obj,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result.event === 'Add') {
        this.addContact(result.data);
      }
    });
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.searchText.set(filterValue);
    this.contacts.set(this.contactService.filterContacts(filterValue));
  }

  addContact(row_obj: any): void {
    const newContact: Contact = {
      contactimg: row_obj.contactimg || 'assets/images/profile/user-1.jpg',
      contactname: row_obj.Contactname,
      contactpost: row_obj.ContactPost,
      contactadd: row_obj.Contactadd,
      contactno: row_obj.Contactno,
      contactinstagram: row_obj.Contactinstagram,
      contactlinkedin: row_obj.Contactlinkedin,
      contactfacebook: row_obj.Contactfacebook,
    };

    this.contactService.addContact(newContact);
    this.contacts.set(this.contactService.getContacts());

    this.snackBar.open('New contact added successfully!', 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}

@Component({

  selector: 'app-dialog-content',
  standalone: true,
  imports: [MaterialModule, FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: 'contact-dialog-content.html',
})
export class AppContactDialogContentComponent {
  action: string;

  local_data: ContactData | any;
  selectedFile: File | null = null;

  constructor(
    public dialogRef: MatDialogRef<AppContactDialogContentComponent>,

    @Optional() @Inject(MAT_DIALOG_DATA) public data: ContactData
  ) {
    this.local_data = { ...data };
    this.action = this.local_data.action;
  }

  doAction(): void {
    // Set the selected image data to local_data before closing
    this.local_data.contactimg = this.selectedFile
      ? URL.createObjectURL(this.selectedFile)
      : null;
    this.dialogRef.close({ event: this.action, data: this.local_data });
  }

  closeDialog(): void {
    this.dialogRef.close({ event: 'Cancel' });
  }

  validateNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    // Check if the input contains non-digit characters
    if (/[^0-9]/.test(value)) {
      alert('Please enter only digits.');
      input.value = value.replace(/[^0-9]/g, '');
      this.local_data[input.name] = input.value;
    } else {
      this.local_data[input.name] = value; // Update model with valid input
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        this.local_data.contactimg = e.target?.result as string; // Set the preview image
      };

      reader.readAsDataURL(this.selectedFile); // Convert file to base64 string
    }
  }
}
