import { Injectable, inject, signal, Injector, runInInjectionContext } from '@angular/core'; // <--- Importar Injector y runInInjectionContext
import { Firestore, collection, doc, setDoc, deleteDoc, collectionData, query, where } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth'; 
import { Observable, of, switchMap, catchError } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private injector = inject(Injector);

  private favorites$ = authState(this.auth).pipe(
    switchMap(user => {
      if (!user) return of([]);

      const col = collection(this.firestore, 'favorites');
      const q = query(col, where('userId', '==', user.uid));
      
      return runInInjectionContext(this.injector, () => 
        collectionData(q, { idField: 'docId' })
      );
    }),
    catchError(err => {
      console.error('Error en favoritos:', err);
      return of([]);
    })
  ) as Observable<any[]>;

  favorites = toSignal(this.favorites$, { initialValue: [] });

  async toggleFavorite(wifiId: string) {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return;

    const uniqueDocId = `${userId}_${wifiId}`; 
    const docRef = doc(this.firestore, 'favorites', uniqueDocId); 

    const exists = this.isFavorite(wifiId);

    try {
      if (exists) {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, {
          wifiId,
          userId,
          addedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }

  isFavorite(wifiId: string): boolean {
    return this.favorites()?.some((f: any) => f.wifiId === wifiId) ?? false;
  }
}