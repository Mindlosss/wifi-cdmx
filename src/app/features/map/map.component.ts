import { Component, OnInit, AfterViewInit, inject, signal, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet'; 
import { WifiDataService } from '../../core/services/wifi-data.service';
import { WifiPoint } from '../../core/models/wifi-point.interface';

// Iconos para el mapa
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const iconDefault = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-full h-screen">
      <div #mapContainer class="w-full h-full z-0"></div>

      @if (isLoading()) {
        <div class="absolute inset-0 bg-white/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div class="flex flex-col items-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p class="mt-4 text-gray-600 font-medium">Cargando puntos WiFi...</p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; }
  `]
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  private wifiService = inject(WifiDataService);

  wifiPoints = signal<WifiPoint[]>([]);
  isLoading = signal<boolean>(true);

  @ViewChild('mapContainer') mapContainer!: ElementRef;
  private map: L.Map | undefined;

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private loadData(): void {
    this.wifiService.getWifiPoints().subscribe({
      next: (data) => {
        this.wifiPoints.set(data);
        this.isLoading.set(false);
        this.addMarkers(data);
      },
      error: (err) => {
        console.error('Error cargando puntos:', err);
        this.isLoading.set(false);
      }
    });
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement).setView([19.4326, -99.1332], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 20
    }).addTo(this.map);
  }

  // validamos
  private addMarkers(points: WifiPoint[]): void {
    if (!this.map) return;

    const markers = L.layerGroup();
    let errores = 0;

    points.forEach(point => {
      // convertirmos a número para mayor seguridad
      const lat = Number(point.latitud);
      const lng = Number(point.longitud);

      // y validamos que no sean NaN o 0
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        L.marker([lat, lng])
          .bindPopup(`
            <div class="p-2 font-sans">
              <h3 class="font-bold text-sm text-gray-800">${point.id || 'Sin ID'}</h3>
              <p class="text-xs text-gray-600 mt-1">${point.alcaldia || 'Sin Alcaldía'}</p>
              <p class="text-xs text-blue-600 font-semibold">${point.programa || 'General'}</p>
            </div>
          `)
          .addTo(markers);
      } else {
        // Contamos errores
        errores++;
      }
    });

    markers.addTo(this.map);
    
    if (errores > 0) {
      console.warn(`Se omitieron ${errores} puntos por coordenadas inválidas.`);
    }
  }
}