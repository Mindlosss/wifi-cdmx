import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes), provideFirebaseApp(() => initializeApp({
      projectId: "wifi-cdmx-22",
      appId: "1:347091077124:web:bae423979eaee4f14b4d51",
      storageBucket: "wifi-cdmx-22.firebasestorage.app",
      apiKey: "AIzaSyDRJKubpWeXGuPBWL8eZ7u3o0TZs8bDuIg",
      authDomain: "wifi-cdmx-22.firebaseapp.com",
      messagingSenderId: "347091077124"
    })), provideAuth(() => getAuth()), provideFirestore(() => getFirestore())
  ]
};
