import {
  Component,
  OnInit,
  Inject,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TicketService } from 'src/app/services/apps/tickets/ticket.service';
import { TicketElement } from 'src/app/pages/apps/ticketlist/ticket';
import { MatSnackBar } from '@angular/material/snack-bar';
@Component({
  selector: 'app-ticket-list',
  templateUrl: './ticketlist.component.html',
  standalone: true,
  imports: [MaterialModule, CommonModule, TablerIconsModule],
})
export class AppTicketlistComponent implements OnInit, AfterViewInit {
  @ViewChild(MatTable, { static: true }) table: MatTable<any>;
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;

  searchText: string = '';
  totalCount = 0;
  Closed = 0;
  Inprogress = 0;
  Open = 0;

  displayedColumns: string[] = [
    'id',
    'title',
    'assignee',
    'status',
    'date',
    'action',
  ];

  dataSource = new MatTableDataSource<TicketElement>([]);

  constructor(
    private ticketService: TicketService,
    public dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.loadTickets(); // Load the initial tickets
  }
  
  private loadTickets(): void {
    const tickets = this.ticketService.tickets$; // Get tickets from the service
    this.dataSource.data = tickets; // Set the dataSource to the tickets
  
    // Update counts based on the current tickets
    this.updateCounts();
  }
  
  private updateCounts(): void {
    this.totalCount = this.dataSource.data.length;
    this.Open = this.countTicketsByStatus('open');
    this.Closed = this.countTicketsByStatus('closed');
    this.Inprogress = this.countTicketsByStatus('inprogress');
  }
 

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  onKeyup(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    this.applyFilter(input.value);
  }
  applyFilter(filterValue: string): void {
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  btnCategoryClick(val: string): number {
    this.dataSource.filter = val.trim().toLowerCase();
    return this.dataSource.filteredData.length;

  }

  openDialog(action: string, ticket: TicketElement | any): void {
    const dialogRef = this.dialog.open(TicketDialogComponent, {
      data: { action, ticket },
    });

    dialogRef.afterClosed().subscribe(() => {
      this.loadTickets(); 

    });
  }



 countTicketsByStatus(status: string): number {
  
  return this.dataSource.data.filter(ticket => ticket.status.toLowerCase() === status.toLowerCase()).length;
 }
}

@Component({
  // tslint:disable-next-line - Disables all
  selector: 'app-dialog-content',
  templateUrl: 'ticket-dialog-content.html',
  standalone: true,
  imports: [
    MaterialModule,
    CommonModule,
    TablerIconsModule,
    FormsModule,
    ReactiveFormsModule,
  ],
})
export class TicketDialogComponent {
  action: string;
  local_data: TicketElement;
  users: any[] = [];
  dateControl = new FormControl();


  constructor(
    public dialogRef: MatDialogRef<TicketDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private ticketService: TicketService,
    private snackBar: MatSnackBar 
  ) {
    this.action = data.action;
    this.local_data = { ...data.ticket };
  }

  ngOnInit(): void {
    this.users = this.ticketService.getUsers(); // Get users from the service

    if (this.local_data.date) {
      this.dateControl.setValue(
        new Date(this.local_data.date).toISOString().split('T')[0]
      ); //  existing date
    } else {
      // Set to today's date if no existing date is available
      this.dateControl.setValue(new Date().toISOString().split('T')[0]);
    }
  }

  doAction(): void {
    this.local_data.date = this.dateControl.value; // Update local_data with the new date

    if (this.action === 'Update') {
      this.ticketService.updateTicket(this.local_data);
      this.openSnackBar('Ticket updated successfully!', 'Close'); 
    } else if (this.action === 'Add') {
      this.ticketService.addTicket(this.local_data);
      this.openSnackBar('Ticket added successfully!', 'Close'); 
    } else if (this.action === 'Delete') {
      this.ticketService.deleteTicket(this.local_data.id);
      this.openSnackBar('Ticket deleted successfully!', 'Close'); 
    }
    this.dialogRef.close();
  }


  openSnackBar(message: string, action: string): void {
    this.snackBar.open(message, action, {
      duration: 3000, 
      horizontalPosition: 'center',
      verticalPosition: 'top',  
    });
  }
  closeDialog(): void {
    this.dialogRef.close();
  }

  trackByUser(index: number, user: any): number {
    return user.id; 
  }
  
}
