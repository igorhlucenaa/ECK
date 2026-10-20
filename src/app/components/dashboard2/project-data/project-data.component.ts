import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, inject, OnInit, ViewChild } from '@angular/core';
import { Firestore, collection, doc, query, where, getDocs, getDoc } from '@angular/fire/firestore';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { AuthService } from 'src/app/services/apps/authentication/auth.service';
import { ViewerScopeService } from 'src/app/services/viewer-scope.service';
import { TranslateModule } from '@ngx-translate/core';
import {
  CREDIT_EXPIRY_ALERT_WINDOW_DAYS,
  computeDaysRemaining,
  getCreditExpiryPriority,
  isCreditOrderExpired,
} from 'src/app/utils/credit-validity.util';
import { calculateCreditOrderBalance } from 'src/app/utils/client-credit-aggregate.util';

export interface CreditExpiryData {
  clientId: string;
  clientName: string;
  logo: string | null;
  validityDate: Date;
  credits: number;
  daysRemaining: number;
  priority: ReturnType<typeof getCreditExpiryPriority>;
}

@Component({
  selector: 'app-project-data',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './project-data.component.html',
})
export class AppProjectDataComponent implements OnInit, AfterViewInit {
  displayedColumns2: string[] = ['client', 'credits', 'validityDate', 'priority'];
  dataSource2 = new MatTableDataSource<CreditExpiryData>([]);
  loadError = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private viewerScopeService = inject(ViewerScopeService);

  ngAfterViewInit(): void {
    this.dataSource2.paginator = this.paginator;
  }

  async ngOnInit(): Promise<void> {
    try {
      this.dataSource2.data = await this.fetchExpiringCredits();
    } catch (error) {
      console.error('Erro ao carregar créditos próximos do vencimento:', error);
      this.loadError = true;
    }
  }

  private async fetchExpiringCredits(): Promise<CreditExpiryData[]> {
    const creditOrdersCollection = collection(this.firestore, 'creditOrders');
    const now = new Date();
    const expiryThreshold = new Date(now);
    expiryThreshold.setDate(
      expiryThreshold.getDate() + CREDIT_EXPIRY_ALERT_WINDOW_DAYS
    );
    expiryThreshold.setHours(23, 59, 59, 999);

    const userRole = await this.authService.getCurrentUserRole();
    if (!userRole) return [];

    let orderSnapshots;
    if (userRole === 'admin_master') {
      orderSnapshots = [await getDocs(creditOrdersCollection)];
    } else {
      const clientIds =
        await this.viewerScopeService.getScopedClientIdsForRole(userRole);
      if (clientIds.length === 0) return [];

      const clientIdChunks: string[][] = [];
      for (let i = 0; i < clientIds.length; i += 30) {
        clientIdChunks.push(clientIds.slice(i, i + 30));
      }
      orderSnapshots = await Promise.all(
        clientIdChunks.map((clientIdChunk) =>
          getDocs(
            query(creditOrdersCollection, where('clientId', 'in', clientIdChunk))
          )
        )
      );
    }

    const orderRows = orderSnapshots.flatMap((snapshot) => snapshot.docs);
    const eligibleOrders = orderRows.flatMap((orderDoc) => {
      const data = orderDoc.data();
      if (data['status'] !== 'Aprovado') return [];

      const rawValidityDate = data['validityDate'];
      const validityDate =
        rawValidityDate && typeof rawValidityDate.toDate === 'function'
          ? rawValidityDate.toDate() as Date
          : null;
      if (!validityDate || isCreditOrderExpired(validityDate, now)) return [];

      const daysRemaining = computeDaysRemaining(validityDate, now);
      const balance = calculateCreditOrderBalance(data, now);
      if (
        daysRemaining === null ||
        daysRemaining > CREDIT_EXPIRY_ALERT_WINDOW_DAYS ||
        balance.creditsAvailable <= 0
      ) {
        return [];
      }

      const clientId = data['clientId'];
      if (typeof clientId !== 'string' || !clientId) return [];

      return [{
        clientId,
        validityDate,
        credits: balance.creditsAvailable,
        daysRemaining,
        priority: getCreditExpiryPriority(daysRemaining),
      }];
    });

    const clientIds = [...new Set(eligibleOrders.map((order) => order.clientId))];
    const clientSnapshots = await Promise.all(
      clientIds.map((clientId) =>
        getDoc(doc(this.firestore, 'clients', clientId))
      )
    );
    const clients = new Map(
      clientSnapshots.flatMap((snapshot) =>
        snapshot.exists()
          ? [[snapshot.id, snapshot.data()] as const]
          : []
      )
    );

    return eligibleOrders
      .map((order) => {
        const client = clients.get(order.clientId);
        return {
          ...order,
          clientName: client?.['companyName'] || 'Desconhecido',
          logo: client?.['logo'] || null,
        };
      })
      .sort(
        (a, b) =>
          a.validityDate.getTime() - b.validityDate.getTime() ||
          a.clientName.localeCompare(b.clientName)
      );
  }
}
