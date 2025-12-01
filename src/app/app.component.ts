import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MapComponent } from './features/map/map.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MapComponent],
  template: `
    <main class="w-full h-screen">
      <app-map></app-map>
    </main>
    
    <router-outlet></router-outlet>
  `
})
export class AppComponent {
  title = 'wifi-cdmx-22';
}