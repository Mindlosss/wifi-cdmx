import { Injectable, inject, signal } from '@angular/core';
import { Firestore, collection, doc, setDoc, deleteDoc, collectionData, query, where } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { Observable, of, switchMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  private favorites$ = collectionData(
    query(
      collection(this.firestore, 'favorites'),
    ), { idField: 'id' } 
  ) as Observable<{id: string}[]>;

  favorites = toSignal(this.favorites$, { initialValue: [] });

  async toggleFavorite(wifiId: string) {
    const userId = this.authService.getUserId();
    if (!userId) return;

    const docRef = doc(this.firestore, 'favorites', wifiId); 

    const exists = this.favorites()?.some(f => f.id === wifiId);

    try {
      if (exists) {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, {
          wifiId,
          userId,
          addedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }

  isFavorite(wifiId: string): boolean {
    return this.favorites()?.some(f => f.id === wifiId) ?? false;
  }
}