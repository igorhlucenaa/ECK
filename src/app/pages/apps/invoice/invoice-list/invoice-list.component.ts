import {
  Component,
  AfterViewInit,
  ViewChild,
  Signal,
  signal,
} from '@angular/core';
import { ServiceinvoiceService } from 'src/app/services/apps/invoice/serviceinvoice.service';
import { InvoiceList } from '../invoice';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { RouterModule } from '@angular/router';
import { ConfirmDeleteDialogComponent } from './confirm-delete-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-invoice-list',
  templateUrl: './invoice-list.component.html',
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
export class AppInvoiceListComponent implements AfterViewInit {
  allComplete = signal<boolean>(false);
  invoiceList = new MatTableDataSource<InvoiceList>([]);
  activeTab = signal<string>('All');
  allInvoices = signal<InvoiceList[]>([]);
  searchQuery = signal<string>('');
  displayedColumns: string[] = [
    'chk',
    'id',
    'billFrom',
    'billTo',
    'totalCost',
    'status',
    'action',
  ];

  @ViewChild(MatSort) sort: MatSort = Object.create(null);
  @ViewChild(MatPaginator) paginator: MatPaginator = Object.create(null);

  constructor(private invoiceService: ServiceinvoiceService,private dialog: MatDialog, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    // Fetch all invoices and initialize the data source
    this.allInvoices.set(this.invoiceService.getInvoiceList());
    this.invoiceList = new MatTableDataSource(this.allInvoices());
  }

  ngAfterViewInit(): void {
    this.invoiceList.paginator = this.paginator;
    this.invoiceList.sort = this.sort;
  }

  handleTabClick(tab: string): void {
    this.activeTab.set(tab);
    this.filterInvoices(); // Filter when tab is clicked
  }

  filter(filterValue: string): void {
    this.searchQuery.set(filterValue);
    this.filterInvoices(); 
  }
  filterInvoices(): void {
    const currentTab = this.activeTab();
    const filteredInvoices = this.allInvoices().filter((invoice) => {
      const matchesTab = currentTab === 'All' || invoice.status === currentTab;

      // Search filtering
      const matchesSearch =
        invoice.billFrom
          .toLowerCase()
          .includes(this.searchQuery().toLowerCase()) ||
        invoice.billTo.toLowerCase().includes(this.searchQuery().toLowerCase());

      return matchesTab && matchesSearch; // Return true if both conditions are met
    });

    this.invoiceList.data = filteredInvoices; // Update the data source
    this.updateAllComplete();
  }

  updateAllComplete(): void {
    const allInvoices = this.invoiceList.data;
    this.allComplete.set(
      allInvoices.length > 0 && allInvoices.every((t) => t.completed)
    ); // Update the allComplete signal
  }

  someComplete(): boolean {
    return (
      this.invoiceList.data.filter((t) => t.completed).length > 0 &&
      !this.allComplete()
    );
  }

  setAll(completed: boolean): void {
    this.allComplete.set(completed);
    this.invoiceList.data.forEach((t) => (t.completed = completed));
    this.invoiceList._updateChangeSubscription();
  }

  countInvoicesByStatus(status: string): number {
    return this.allInvoices().filter((invoice) => invoice.status === status)
      .length;
  }

 
  deleteInvoice(id: number): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent);
  
    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        this.invoiceService.deleteInvoice(id);
        this.allInvoices.set(this.invoiceService.getInvoiceList()); 
        this.filterInvoices(); 
        this.showSnackbar('Invoice deleted successfully!');
      }
    });
  }

  showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000, 
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
  
}
