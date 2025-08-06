import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';

export interface Client {
  id: string;
  companyName: string;
  // Adicione outros campos conforme necessário
}

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  private clientsCollection = collection(this.firestore, 'clients');

  constructor(private firestore: Firestore) {}

  getClients(): Observable<Client[]> {
    const q = query(this.clientsCollection, orderBy('companyName', 'asc'));
    return from(
      getDocs(q).then(
        (snapshot) =>
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Client[]
      )
    );
  }

  addClient(client: any) {
    const clientsRef = collection(this.firestore, 'clients');
    return addDoc(clientsRef, client);
  }

  updateClient(clientId: string, clientData: any) {
    const clientDoc = doc(this.firestore, `clients/${clientId}`);
    return updateDoc(clientDoc, clientData);
  }

  deleteClient(clientId: string) {
    const clientDoc = doc(this.firestore, `clients/${clientId}`);
    return deleteDoc(clientDoc);
  }
}
