import { Component, OnInit } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-report-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './report-list.component.html',
  styleUrl: './report-list.component.scss'
})
export class ReportListComponent implements OnInit {
  reports: any[] = [];
  isLoading = false;

  constructor(private firestore: Firestore) {}

  async ngOnInit() {
    this.isLoading = true;
    const assessmentsCol = collection(this.firestore, 'assessments');
    const snapshot = await getDocs(assessmentsCol);
    this.reports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    this.isLoading = false;
  }
}
