import { Component, signal } from '@angular/core';
import { ServiceinvoiceService } from 'src/app/services/apps/invoice/serviceinvoice.service';
import { InvoiceList } from '../invoice';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-invoice-view',
  templateUrl: './invoice-view.component.html',
  styleUrls: ['./invoice-view.component.scss'],
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
export class AppInvoiceViewComponent {
  id = signal<number>(0);
  invoiceDetail = signal<InvoiceList | null>(null);
  displayedColumns: string[] = ['itemName', 'unitPrice', 'unit', 'total'];

  constructor(
    private activatedRouter: ActivatedRoute,
    private invoiceService: ServiceinvoiceService
  ) {}

  ngOnInit(): void {
    this.id.set(+this.activatedRouter.snapshot.paramMap.get('id')!);

    this.loadInvoiceDetail();
  }

  private loadInvoiceDetail(): void {
    const invoiceList = this.invoiceService.getInvoiceList(); // Get the list of invoices
    const invoiceId = this.id();
    const invoice = invoiceList.find((x) => x.id === invoiceId);
    this.invoiceDetail.set(invoice || null);
  }
}
