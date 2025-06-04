import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, getDoc, collection, getDocs } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-report-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './report-detail.component.html',
  styleUrl: './report-detail.component.scss'
})
export class ReportDetailComponent implements OnInit {
  report: any = null;
  isLoading = false;
  results: any[] = [];

  constructor(private route: ActivatedRoute, private firestore: Firestore) {}

  async ngOnInit() {
    this.isLoading = true;
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const docRef = doc(this.firestore, `assessments/${id}`);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        this.report = { id, ...docSnap.data() };
        // Buscar respostas dos participantes
        const resultsCol = collection(this.firestore, `assessments/${id}/results`);
        const resultsSnap = await getDocs(resultsCol);
        this.results = resultsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    }
    this.isLoading = false;
  }
}
