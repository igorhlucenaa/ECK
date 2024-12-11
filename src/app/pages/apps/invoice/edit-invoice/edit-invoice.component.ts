import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ServiceinvoiceService } from 'src/app/services/apps/invoice/serviceinvoice.service';
import { InvoiceList, order } from '../invoice';
import {
  UntypedFormGroup,
  UntypedFormArray,
  UntypedFormBuilder,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { OkDialogComponent } from './ok-dialog/ok-dialog.component';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatSnackBar } from '@angular/material/snack-bar';
@Component({
  selector: 'app-edit-invoice',
  templateUrl: './edit-invoice.component.html',
  standalone: true,
  imports: [
    MaterialModule,
    CommonModule,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    TablerIconsModule,
  ],
})
export class AppEditInvoiceComponent {
  id = signal<any>(null);
  subTotal = signal<number>(0);
  vat = signal<number>(0);
  grandTotal = signal<number>(0);
  addForm: UntypedFormGroup | any;
  invoice = signal<InvoiceList | any>([]);
  constructor(
    activatedRouter: ActivatedRoute,
    private invoiceService: ServiceinvoiceService,
    private router: Router,
    private fb: UntypedFormBuilder,
    public dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.id.set(activatedRouter.snapshot.paramMap.get('id'));
    this.loadInvoice(); // Load invoice here
    this.subTotal.set(this.invoice()?.totalCost || 0);
    this.vat.set(this.invoice()?.vat || 0);
    this.grandTotal.set(this.invoice()?.grandTotal || 0);
    this.addForm = this.fb.group({
      item: this.fb.array([this.itemControl()]),
    });

    this.fillAddControls();
  }

  loadInvoice(): void {
    const invoiceData = this.invoiceService
      .getInvoiceList()
      .find((x) => x.id === +this.id());
    this.invoice.set(invoiceData); // Set the invoice signal
  }
  itemControl(): UntypedFormGroup {
    return this.fb.group({
      itemName: ['', Validators.required],
      itemCost: ['', Validators.required],
      itemSold: ['', Validators.required],
      itemTotal: ['0'],
    });
  }

  fillAddControls(): void {
    this.addForm.setControl('item', this.setItem(this.invoice()?.orders));
  }

  setItem(order: any): UntypedFormArray {
    const fa = new UntypedFormArray([]);
    order?.forEach((s: any) => {
      fa.push(
        this.fb.group({
          itemName: s.itemName,
          itemCost: s.unitPrice,
          itemSold: s.units,
          itemTotal: s.unitTotalPrice,
        })
      );
    });
    return fa;
  }

  btnAddItemClick(): void {
    (<UntypedFormArray>this.addForm.get('item')).push(this.itemControl());
  }

  btnRemoveClick(i: number): void {
    const totalCostOfItem =
      this.addForm.get('item')?.value[i].itemCost *
      this.addForm.get('item')?.value[i].itemSold;

    this.subTotal.set(this.subTotal() - totalCostOfItem);
    this.vat.set(this.subTotal() / 10);
    this.grandTotal.set(this.subTotal() + this.vat());

    (<UntypedFormArray>this.addForm.get('item')).removeAt(i);
  }

  itemsChanged(): void {
    let total = 0;
    for (
      let t = 0;
      t < (<UntypedFormArray>this.addForm.get('item')).length;
      t++
    ) {
      if (
        this.addForm.get('item')?.value[t].itemCost != '' &&
        this.addForm.get('item')?.value[t].itemSold
      ) {
        total +=
          this.addForm.get('item')?.value[t].itemCost *
          this.addForm.get('item')?.value[t].itemSold;
      }
    }
    this.subTotal.set(total);
    this.vat.set(this.subTotal() / 10);
    this.grandTotal.set(this.subTotal() + this.vat());
  }

  saveDetail(event: Event): void {
    event.preventDefault();
    const currentInvoice = this.invoice();
    if (currentInvoice) {
      currentInvoice.grandTotal = this.grandTotal();
      currentInvoice.totalCost = this.subTotal();
      currentInvoice.vat = this.vat();
      currentInvoice.orders = [];

      for (
        let t = 0;
        t < (<UntypedFormArray>this.addForm.get('item')).length;
        t++
      ) {
        const o: order = new order();
        o.itemName = this.addForm.get('item')?.value[t].itemName;
        o.unitPrice = this.addForm.get('item')?.value[t].itemCost;
        o.units = this.addForm.get('item')?.value[t].itemSold;
        o.unitTotalPrice = o.units * o.unitPrice;
        currentInvoice.orders.push(o);
      }
      this.dialog.open(OkDialogComponent);
      this.invoiceService.updateInvoice(currentInvoice.id, currentInvoice);
      this.router.navigate(['/apps/invoice']);
      this.showSnackbar('Invoice updated  successfully!');
    }
  }

  showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}
