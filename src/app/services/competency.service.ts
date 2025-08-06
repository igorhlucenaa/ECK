import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  DocumentReference,
  query,
  where,
  orderBy,
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';

export interface Competency {
  id?: string;
  name: string;
  description: string;
  questionIds: string[];
  clientId?: string;
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root',
})
export class CompetencyService {
  private competenciesCollection = collection(this.firestore, 'competencies');

  constructor(private firestore: Firestore) {}

  // Buscar competências por cliente
  getCompetencies(clientId: string): Observable<Competency[]> {
    const q = query(
      this.competenciesCollection,
      where('clientId', '==', clientId),
      orderBy('name', 'asc')
    );
    return from(
      getDocs(q).then(
        (snapshot) =>
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Competency[]
      )
    );
  }

  // Adicionar uma nova competência
  addCompetency(
    competency: Omit<Competency, 'id' | 'createdAt' | 'updatedAt'>
  ): Observable<DocumentReference> {
    const newCompetency = {
      ...competency,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return from(addDoc(this.competenciesCollection, newCompetency));
  }

  // Atualizar uma competência existente
  updateCompetency(
    id: string,
    competency: Partial<Competency>
  ): Observable<void> {
    const competencyDoc = doc(this.firestore, `competencies/${id}`);
    const updatedCompetency = {
      ...competency,
      updatedAt: new Date(),
    };
    return from(updateDoc(competencyDoc, updatedCompetency));
  }

  // Deletar uma competência
  deleteCompetency(id: string): Observable<void> {
    const competencyDoc = doc(this.firestore, `competencies/${id}`);
    return from(deleteDoc(competencyDoc));
  }
}
