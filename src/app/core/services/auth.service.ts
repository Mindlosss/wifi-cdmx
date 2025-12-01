import { Injectable, inject, signal } from '@angular/core';
import { Auth, signInAnonymously, user, User } from '@angular/fire/auth';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);

  user = toSignal(user(this.auth));

  constructor() {
    this.loginAnonymously();
  }

  async loginAnonymously() {
    try {
      if (!this.auth.currentUser) {
        await signInAnonymously(this.auth);
        console.log('Autenticado anónimamente para Firestore');
      }
    } catch (error) {
      console.error('Error en auth:', error);
    }
  }

  getUserId(): string | undefined {
    return this.auth.currentUser?.uid;
  }
}