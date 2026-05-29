import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { Firestore, collection, doc, query, where, getDocs, getDoc } from '@angular/fire/firestore';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';

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
  private authService = inject(AuthService);

  async ngOnInit(): Promise<void> {
    const data = await this.fetchExpiringCredits();
    this.dataSource2.data = data;
    this.dataSource2.paginator = this.paginator;
  }

  private async fetchExpiringCredits(): Promise<CreditExpiryData[]> {
    const creditOrdersCollection = collection(this.firestore, 'creditOrders');
    const now = new Date();
    const expiryThreshold = new Date();
    expiryThreshold.setDate(now.getDate() + 30);

    const userRole = await this.authService.getCurrentUserRole();
    const userClientIds = await this.authService.getCurrentUserClientIds();

    let querySnapshot;
    if (userRole === 'admin_client' && userClientIds.length > 0) {
      querySnapshot = await getDocs(
        query(creditOrdersCollection,
          where('clientId', 'in', userClientIds),
          where('validityDate', '<=', expiryThreshold)
        )
      );
    } else {
      querySnapshot = await getDocs(
        query(creditOrdersCollection, where('validityDate', '<=', expiryThreshold))
      );
    }

    const results = await Promise.all(
      querySnapshot.docs.map(async (orderDoc) => {
        const creditOrder = orderDoc.data();
        const clientId = creditOrder['clientId'];

        let clientName = 'Desconhecido';
        let logo: string | null = null;

        if (clientId) {
          const clientRef = doc(this.firestore, 'clients', clientId);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) {
            clientName = clientSnap.data()['companyName'] || 'Desconhecido';
            logo = clientSnap.data()['logo'] || null;
          }
        }

        return {
          clientName,
          logo,
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
