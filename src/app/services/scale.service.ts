import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Scale } from 'src/app/models/scale.model';

@Injectable({
  providedIn: 'root',
})
export class ScaleService {
  private scalesCollection = collection(this.firestore, 'scales');

  constructor(
    private firestore: Firestore
  ) {}

  // Busca todas as escalas de um cliente específico ou as escalas padrão
  async getScalesByClient(clientId: string): Promise<Scale[]> {
    const q = query(
      this.scalesCollection,
      where('clientId', '==', clientId),
      where('isDefault', '==', true)
    );

    const querySnapshot = await getDocs(q);
    const scales: Scale[] = [];
    querySnapshot.forEach((doc) => {
      scales.push({ id: doc.id, ...doc.data() } as Scale);
    });
    return scales;
  }

  // Adiciona uma nova escala
  addScale(scale: Scale): Promise<any> {
    return addDoc(this.scalesCollection, scale);
  }

  // Atualiza uma escala existente
  updateScale(id: string, scale: Partial<Scale>): Promise<void> {
    const scaleDocRef = doc(this.firestore, `scales/${id}`);
    return updateDoc(scaleDocRef, scale);
  }

  // Exclui uma escala
  deleteScale(id: string): Promise<void> {
    const scaleDocRef = doc(this.firestore, `scales/${id}`);
    return deleteDoc(scaleDocRef);
  }
}
