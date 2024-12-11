import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-contact-form-dialog',
  templateUrl: './contact-form-dialog.component.html',
  styleUrls: ['./contact-form-dialog.component.css'],
  imports: [MaterialModule, CommonModule, FormsModule],
  standalone: true,
})
export class ContactFormDialogComponent {
  contact = {
    firstname: '',
    lastname: '',
    image: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    department: '',
  };
  departments = [
    { id: 1, name: 'Support' },
    { id: 2, name: 'Engineering' },
    { id: 3, name: 'Sales' },
  ];

  defaultImageUrl = 'assets/images/profile/user-4.jpg';
  imageUrl: string | ArrayBuffer | null = this.defaultImageUrl;

  constructor(
    public dialogRef: MatDialogRef<ContactFormDialogComponent>,
    private snackBar: MatSnackBar
  ) {}

  saveContact(): void {
    this.contact.image = this.imageUrl as string;
    this.dialogRef.close(this.contact);
    this.snackBar.open(
      `${this.contact.firstname} ${this.contact.lastname} added successfully!`,
      'Close',
      {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
      }
    );
  }

  cancel(): void {
    this.dialogRef.close();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];

    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.imageUrl = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }

  isFormValid(): any {
    return (
      this.contact.firstname &&
      this.contact.lastname &&
      this.contact.company &&
      this.contact.phone &&
      this.contact.email &&
      this.contact.address &&
      this.contact.department
    );
  }
}
