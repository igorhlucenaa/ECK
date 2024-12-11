import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, deleteDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  constructor(private firestore: Firestore) {}

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
