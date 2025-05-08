import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';

export interface Report {
  id: string;
  name: string;
  assessmentId: string;
  clientId?: string;
  createdBy?: string;
  isPublic?: boolean;
  createdAt: Date;
  updatedAt: Date;
  metrics: any[];
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  constructor(private firestore: Firestore) {}

  getReports(): Observable<Report[]> {
    const reportsRef = collection(this.firestore, 'reports');
    const q = query(reportsRef, orderBy('createdAt', 'desc'));

    return from(getDocs(q)).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: this.convertTimestamp(doc.data()['createdAt']),
          updatedAt: this.convertTimestamp(doc.data()['updatedAt'])
        } as Report))
      )
    );
  }

  getReport(id: string): Observable<Report | null> {
    const reportRef = doc(this.firestore, `reports/${id}`);

    return from(getDoc(reportRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: this.convertTimestamp(data['createdAt']),
            updatedAt: this.convertTimestamp(data['updatedAt'])
          } as Report;
        }
        return null;
      })
    );
  }

  createReport(report: any): Observable<string> {
    const reportsRef = collection(this.firestore, 'reports');

    return from(addDoc(reportsRef, {
      ...report,
      createdAt: new Date(),
      updatedAt: new Date()
    })).pipe(
      map(docRef => docRef.id)
    );
  }

  updateReport(id: string, report: any): Observable<void> {
    const reportRef = doc(this.firestore, `reports/${id}`);

    return from(updateDoc(reportRef, {
      ...report,
      updatedAt: new Date()
    }));
  }

  deleteReport(id: string): Observable<void> {
    const reportRef = doc(this.firestore, `reports/${id}`);
    return from(deleteDoc(reportRef));
  }

  exportReport(id: string): Observable<any> {
    // Implementação do método de exportação
    return this.getReport(id).pipe(
      map(report => {
        if (!report) throw new Error('Relatório não encontrado');
        // Lógica para exportar o relatório
        return {
          report,
          exportDate: new Date(),
          format: 'pdf'
        };
      })
    );
  }

  private convertTimestamp(timestamp: any): Date {
    if (!timestamp) return new Date();

    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }

    if (timestamp && timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }

    return new Date(timestamp);
  }
}
