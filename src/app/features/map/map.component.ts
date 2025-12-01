import { Component, OnInit, AfterViewInit, inject, signal, computed, effect, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { WifiDataService } from '../../core/services/wifi-data.service';
import { WifiPoint } from '../../core/models/wifi-point.interface';
import { calculateDistance } from '../../core/utils/geo.utils';

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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative w-full h-screen">
      
      <div class="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-lg shadow-lg w-72">
        <h2 class="text-lg font-bold text-gray-800 mb-2">Puntos WiFi CDMX</h2>
        
        <div class="mb-2">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Filtrar por Alcaldía</label>
          <select 
            [ngModel]="selectedAlcaldia()" 
            (ngModelChange)="selectedAlcaldia.set($event)"
            class="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="TODAS">Todas las alcaldías</option>
            @for (alcaldia of uniqueAlcaldias(); track alcaldia) {
              <option [value]="alcaldia">{{ alcaldia }}</option>
            }
          </select>
        </div>

        <div class="text-xs text-gray-500 mt-2 flex justify-between">
          <span>Puntos visibles:</span>
          <span class="font-bold text-blue-600">{{ filteredPoints().length }}</span>
        </div>

        <!-- Recomendación -->
        <div class="mt-4 pt-4 border-t border-gray-200">
          <button 
            (click)="findNearestWifi()"
            [disabled]="isLocating()"
            class="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            
            @if (isLocating()) {
              <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
              Calculando...
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Recomendar Cercano
            }
          </button>
          
          @if (userLocation()) {
             <p class="text-xs text-green-600 mt-2 text-center">
                {{ nearestDistance()?.toFixed(2) }} km del punto sugerido.
             </p>
          }
        </div>
      </div>

      <div #mapContainer class="w-full h-full z-0"></div>

      @if (isLoading()) {
        <div class="absolute inset-0 bg-white/80 z-[2000] flex items-center justify-center backdrop-blur-sm">
          <div class="flex flex-col items-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p class="mt-4 text-gray-600 font-medium">Cargando datos...</p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`:host { display: block; height: 100vh; }`]
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  private wifiService = inject(WifiDataService);
  
  //STATE Signals
  // 1. Datos crudos
  rawPoints = signal<WifiPoint[]>([]);
  isLoading = signal<boolean>(true);
  
  // 2. Estado del filtro
  selectedAlcaldia = signal<string>('TODAS');

  // 3. Lista de alcaldías unicas para el dropdown
  uniqueAlcaldias = computed(() => {
    const points = this.rawPoints();
    const alcaldias = points.map(p => p.alcaldia).filter(a => !!a); // Extraer y limpiar nulos
    return [...new Set(alcaldias)].sort(); // Eliminar duplicados y ordenar A-Z
  });

  // 4. filtrado de puntos según la selección
  filteredPoints = computed(() => {
    const filter = this.selectedAlcaldia();
    const points = this.rawPoints();

    if (filter === 'TODAS') {
      return points;
    }
    return points.filter(p => p.alcaldia === filter);
  });

  // Signals para la recomendación
  isLocating = signal(false);
  userLocation = signal<{lat: number, lng: number} | null>(null);
  nearestDistance = signal<number | null>(null);

  @ViewChild('mapContainer') mapContainer!: ElementRef;
  private map: L.Map | undefined;
  private markersLayer: L.LayerGroup | undefined; // Capa para manejar marcadores

  constructor() {
    // 5. Reacciona automáticamente a cambios en filteredPoints
    effect(() => {
      const points = this.filteredPoints();
      // Solo intentamos dibujar los marcadores si el mapa ya está inicializado
      if (this.map && !this.isLoading()) {
        this.updateMapMarkers(points);
      }
    });
  }

  ngOnInit(): void {
    this.wifiService.getWifiPoints().subscribe({
      next: (data) => {
        this.rawPoints.set(data);
        this.isLoading.set(false);
      },
      error: (err) => console.error(err)
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  // Apartado de recomendación
  findNearestWifi(): void {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización');
      return;
    }

    this.isLocating.set(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        this.userLocation.set({ lat: userLat, lng: userLng });

        // Calculamos distancias contra todos los puntos crudos
        const allPoints = this.rawPoints();
        let nearestPoint: WifiPoint | null = null;
        let minDistance = Infinity;

        allPoints.forEach(point => {
          const pLat = Number(point.latitud);
          const pLng = Number(point.longitud);
          
          if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0) {
            const dist = calculateDistance(userLat, userLng, pLat, pLng);
            if (dist < minDistance) {
              minDistance = dist;
              nearestPoint = point;
            }
          }
        });

        // Resultados visuales en el mapa
        if (nearestPoint && this.map) {
          const targetLat = Number((nearestPoint as WifiPoint).latitud);
          const targetLng = Number((nearestPoint as WifiPoint).longitud);

          // Marcador del usuario
          L.circleMarker([userLat, userLng], {
            radius: 8,
            fillColor: '#ef4444', 
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }).bindPopup('Tu ubicación').addTo(this.map);

          //linea 
          L.polyline([[userLat, userLng], [targetLat, targetLng]], {
            color: '#2563eb',
            weight: 3,
            dashArray: '10, 10',
            opacity: 0.6
          }).addTo(this.map);

          // ir al destino
          this.map.flyTo([targetLat, targetLng], 16, { duration: 1.5 });
          
          this.nearestDistance.set(minDistance);
          
          // Auto-seleccionar alcaldía para filtrar y mostrar contexto
          if ((nearestPoint as WifiPoint).alcaldia) {
             this.selectedAlcaldia.set((nearestPoint as WifiPoint).alcaldia);
          }
        }

        this.isLocating.set(false);
      },
      (error) => {
        console.error('Error obteniendo ubicación:', error);
        alert('No pudimos acceder a tu ubicación para recomendarte un punto.');
        this.isLocating.set(false);
      }
    );
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement).setView([19.4326, -99.1332], 12);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 20
    }).addTo(this.map);

    // Creamos una empty box para los marcadores
    this.markersLayer = L.layerGroup().addTo(this.map);
  }

  private updateMapMarkers(points: WifiPoint[]): void {
    if (!this.markersLayer || !this.map) return;

    // 1. Limpiar marcadores anteriores
    this.markersLayer.clearLayers();

    // 2. Crear nuevos marcadores
    points.forEach(point => {
      const lat = Number(point.latitud);
      const lng = Number(point.longitud);

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
        L.marker([lat, lng])
          .bindPopup(`
            <div class="p-2 font-sans">
              <h3 class="font-bold text-sm">${point.id}</h3>
              <p class="text-xs text-gray-600">${point.alcaldia}</p>
            </div>
          `)
          .addTo(this.markersLayer!);
      }
    });

    // 3. Ajustar zoom para ver todos los puntos filtrados
    if (points.length > 0) {
      // bounds fake para hacer zoom a los puntos
      const group = L.featureGroup(this.markersLayer.getLayers() as L.Layer[]);
      if (group.getLayers().length > 0) {
        this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
      }
    }
  }
}