import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

export interface CreditExpiryData {
  clientName: string;
  logo: string | null;
  validityDate: Date;
  credits: number;
  priority: string;
}

@Component({
  selector: 'app-project-data',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './project-data.component.html',
})
export class AppProjectDataComponent implements OnInit {
  displayedColumns2: string[] = ['client', 'credits', 'validityDate', 'priority'];
  dataSource2 = new MatTableDataSource<CreditExpiryData>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private firestore = inject(Firestore);

  async ngOnInit(): Promise<void> {
    const data = await this.fetchExpiringCredits();
    this.dataSource2.data = data;
    this.dataSource2.paginator = this.paginator; // Configura a paginação
  }

  private async fetchExpiringCredits(): Promise<CreditExpiryData[]> {
    const creditOrdersCollection = collection(this.firestore, 'creditOrders');
    const now = new Date();

    // Buscar documentos cuja validade esteja próxima (exemplo: nos próximos 30 dias)
    const expiryThreshold = new Date();
    expiryThreshold.setDate(now.getDate() + 30);

    const querySnapshot = await getDocs(
      query(creditOrdersCollection, where('validityDate', '<=', expiryThreshold))
    );

    const clientCollection = collection(this.firestore, 'clients');

    const results = await Promise.all(
      querySnapshot.docs.map(async (doc) => {
        const creditOrder = doc.data();
        const clientSnapshot = await getDocs(
          query(clientCollection, where('id', '==', creditOrder['clientId']))
        );

        const client = clientSnapshot.docs[0]?.data();

        return {
          clientName: client?.['companyName'] || 'Desconhecido',
          logo: client?.['logo'] || null,
          validityDate: new Date(creditOrder['validityDate'].seconds * 1000),
          credits: creditOrder['credits'],
          priority: this.getPriority(creditOrder['validityDate'].seconds),
        };
      })
    );

    return results;
  }

  private getPriority(validityTimestamp: number): string {
    const now = Date.now() / 1000;
    const daysToExpire = (validityTimestamp - now) / (60 * 60 * 24);

    if (daysToExpire <= 7) {
      return 'critical';
    } else if (daysToExpire <= 14) {
      return 'high';
    } else if (daysToExpire <= 30) {
      return 'medium';
    } else {
      return 'low';
    }
  }
}
