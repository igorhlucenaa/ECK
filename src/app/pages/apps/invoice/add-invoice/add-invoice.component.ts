import { Component, signal } from '@angular/core';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  Validators,
  UntypedFormArray,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { order, InvoiceList } from '../invoice';
import { ServiceinvoiceService } from 'src/app/services/apps/invoice/serviceinvoice.service';
import { Router, RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AddedDialogComponent } from './added-dialog/added-dialog.component';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-add-invoice',
  templateUrl: './add-invoice.component.html',
  standalone: true,
  imports: [
    MaterialModule,
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    TablerIconsModule,
  ],
})
export class AppAddInvoiceComponent {
  addForm: UntypedFormGroup | any;
  rows: UntypedFormArray;
  invoice = signal<InvoiceList[] | any>([]);
  subTotal = signal(0);
  vat = signal(0);
  grandTotal = signal(0);

  constructor(
    private fb: UntypedFormBuilder,
    private invoiceService: ServiceinvoiceService,
    private router: Router,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {
    this.invoice.set(this.invoiceService.getInvoiceList());

    const maxId = Math.max.apply(
      Math,
      this.invoiceService.getInvoiceList().map((o) => o.id)
    );
    this.invoice.set({
      id: maxId + 1,
      status: 'Pending',
      orders: [],
      orderDate: new Date(),
    });
    this.addForm = this.fb.group({});

    this.rows = this.fb.array([]);
    this.addForm.addControl('rows', this.rows);
    this.rows.push(this.createItemFormGroup());
  }

  onAddRow(): void {
    this.rows.push(this.createItemFormGroup());
  }

  onRemoveRow(rowIndex: number): void {
    const totalCostOfItem =
      this.addForm.get('rows')?.value[rowIndex].unitPrice *
      this.addForm.get('rows')?.value[rowIndex].units;
    this.subTotal.update((value) => value - totalCostOfItem);
    this.vat.update((value) => this.subTotal() / 10);
    this.grandTotal.update((value) => this.subTotal() + this.vat());
    this.rows.removeAt(rowIndex);
  }

  createItemFormGroup(): UntypedFormGroup {
    return this.fb.group({
      itemName: ['', Validators.required],
      units: ['', Validators.required],
      unitPrice: ['', Validators.required],
      itemTotal: ['0'],
    });
  }

  itemsChanged(): void {
    let total: number = 0;
    // tslint:disable-next-line - Disables all
    for (
      let t = 0;
      t < (<UntypedFormArray>this.addForm.get('rows')).length;
      t++
    ) {
      if (
        this.addForm.get('rows')?.value[t].unitPrice !== '' &&
        this.addForm.get('rows')?.value[t].units
      ) {
        total =
          this.addForm.get('rows')?.value[t].unitPrice *
            this.addForm.get('rows')?.value[t].units +
          total;
      }
    }
    this.subTotal.set(total);
    this.vat.set(this.subTotal() / 10);
    this.grandTotal.set(this.subTotal() + this.vat());
  }

  saveDetail(event: Event): void {
    event.preventDefault();
    this.invoice().grandTotal = this.grandTotal();
    this.invoice().totalCost = this.subTotal();
    this.invoice().vat = this.vat();

    // tslint:disable-next-line - Disables all
    for (
      let t = 0;
      t < (<UntypedFormArray>this.addForm.get('rows')).length;
      t++
    ) {
      const o: order = new order();
      o.itemName = this.addForm.get('rows')?.value[t].itemName;
      o.unitPrice = this.addForm.get('rows')?.value[t].unitPrice;
      o.units = this.addForm.get('rows')?.value[t].units;
      o.unitTotalPrice = o.units * o.unitPrice;
      this.invoice()?.orders.push(o);
    }
    this.dialog.open(AddedDialogComponent);
    this.invoiceService.addInvoice(this.invoice());
    this.router.navigate(['/apps/invoice']);
    this.showSnackbar('Invoice added successfully!');

  }

  showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}
