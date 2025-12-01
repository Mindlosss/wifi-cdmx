import { Component, OnInit, AfterViewInit, inject, signal, computed, effect, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { WifiDataService } from '../../core/services/wifi-data.service';
import { WifiPoint } from '../../core/models/wifi-point.interface';
import { calculateDistance } from '../../core/utils/geo.utils';
import { FavoritesService } from '../../core/services/favorites.service';
import { AuthService } from '../../core/services/auth.service';

// Iconos para el mapa
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const iconDefault = L.icon({
  iconRetinaUrl, iconUrl, shadowUrl,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;

const iconFav = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- FONDO -->
    <div class="min-h-screen bg-slate-500 relative overflow-hidden font-sans text-slate-100">
      <!-- Orbes de color de fondo -->
      <div class="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-400/30 blur-[100px] animate-pulse"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-300/20 blur-[100px]"></div>
      <div class="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full bg-indigo-400/20 blur-[80px]"></div>

      <!-- LAYOUT PRINCIPAL -->
      <div class="relative z-10 max-w-8xl mx-auto p-4 lg:p-8 h-screen flex flex-col lg:flex-row gap-6">
        
        <!-- PANEL LATERAL -->
        <div class="lg:w-1/3 flex flex-col gap-6 h-full lg:max-h-[calc(100vh-4rem)]">
          
          <!-- Tarjeta de Bienvenida / Stats -->
          <div class="bg-white/70 backdrop-blur-xl border border-white/50 rounded-3xl shadow-lg shadow-slate-900/10 transition-all duration-300 p-6 flex-shrink-0">
            <h1 class="text-3xl font-bold bg-gradient-to-r from-blue-800 to-cyan-700 bg-clip-text text-transparent">
              WiFi CDMX
            </h1>
            <p class="text-sm text-slate-700 mt-1 font-medium">Explora {{ rawPoints().length }} puntos de acceso gratuito.</p>
            
            <!-- Buscador / Filtro -->
            <div class="mt-6">
              <label class="text-xs font-bold text-slate-600 uppercase tracking-wider">Filtrar Zona</label>
              <div class="relative mt-2">
                <select 
                  [ngModel]="selectedAlcaldia()" 
                  (ngModelChange)="selectedAlcaldia.set($event)"
                  class="w-full bg-white/60 border border-blue-200 text-slate-800 text-sm rounded-xl focus:ring-blue-600 focus:border-blue-600 block p-3 shadow-sm backdrop-blur-sm transition-all hover:bg-white/90 cursor-pointer font-medium">
                  <option value="TODAS">Todas las alcaldías</option>
                  @for (alcaldia of uniqueAlcaldias(); track alcaldia) {
                    <option [value]="alcaldia">{{ alcaldia }}</option>
                  }
                </select>
              </div>
            </div>
          </div>

          <!-- Tarjeta de Recomendación -->
          <div class="bg-white/70 backdrop-blur-xl border border-white/50 rounded-3xl shadow-lg shadow-slate-900/10 transition-all duration-300 p-6 flex-shrink-0 flex flex-col">
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
              Recomendación Inteligente
            </h2>
            <p class="text-xs text-slate-600 mt-1 mb-4 font-medium">
              Usamos tu ubicación para triangular el punto con mejor conectividad teórica cercana.
            </p>

            <div class="flex-1 flex flex-col justify-center items-center gap-4">
              @if (!userLocation()) {
                <div class="text-center p-4 animate-fade-in">
                  <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-500">
                    <!-- Icono Señal -->
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                    </svg>
                  </div>
                  
                  @if (locationError()) {
                    <p class="text-sm text-red-500 font-bold">Acceso a ubicación denegado</p>
                    <p class="text-xs text-red-400 mt-1">Habilita los permisos en tu navegador.</p>
                  } @else {
                    <p class="text-sm text-slate-500 font-medium">¿Buscas conexión?</p>
                  }
                </div>
              } @else {
                <div class="w-full bg-blue-50/90 border border-blue-200 rounded-xl p-4 text-center animate-fade-in">
                  <p class="text-xs text-blue-700 font-bold uppercase">Punto más cercano</p>
                  <p class="text-2xl font-bold text-slate-900 mt-1">{{ nearestDistance()?.toFixed(2) }} km</p>
                  <p class="text-xs text-slate-600">Distancia lineal</p>
                </div>
              }

              <button 
                (click)="findNearestWifi()"
                [disabled]="isLocating()"
                class="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-700 to-cyan-700 text-white font-bold shadow-lg shadow-slate-900/20 hover:shadow-slate-900/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                @if (isLocating()) {
                  <svg class="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Escaneando zona...
                } @else {
                  <span>Encontrar Mejor WiFi</span>
                }
              </button>
            </div>
          </div>

          <!-- Tarjeta de Favoritos -->
          <div class="bg-white/70 backdrop-blur-xl border border-white/50 rounded-3xl shadow-lg shadow-slate-900/10 transition-all duration-300 p-6 flex flex-col flex-1 min-h-[150px] overflow-hidden">
            <h2 class="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex-shrink-0">Tus Favoritos</h2>
            
            <div class="overflow-y-auto custom-scrollbar flex-1 pr-2 scroll-smooth">
              @if (favPoints().length === 0) {
                <div class="h-full flex items-center justify-center">
                  <p class="text-sm text-slate-500 italic text-center">No tienes favoritos aún.</p>
                </div>
              } @else {
                <ul class="space-y-2 pb-2">
                  @for (fav of favPoints(); track fav.id) {
                    <li (click)="flyToPoint(fav)" class="cursor-pointer bg-white/60 hover:bg-white p-3 rounded-xl border border-white/40 transition-all flex items-center justify-between group shadow-sm">
                      <div>
                        <p class="text-xs font-bold text-slate-800 truncate w-40">{{ fav.id }}</p>
                        <p class="text-[10px] text-slate-600">{{ fav.alcaldia }}</p>
                      </div>
                      <button (click)="$event.stopPropagation(); toggleFav(fav)" class="text-yellow-600 hover:text-red-600 transition-colors text-xs font-bold px-2 py-1 rounded hover:bg-red-50">
                        ELIMINAR
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>
        </div>

        <!-- MAP -->
        <div [ngClass]="isExpanded() ? 
             'fixed inset-0 z-[5000] w-screen h-screen m-0 p-0 rounded-none' : 
             'lg:w-2/3 relative transition-all duration-500 ease-in-out h-full'">
             
          <div class="w-full h-full bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl shadow-slate-900/10 overflow-hidden relative transition-all duration-500"
               [class.rounded-none]="isExpanded()"
               [class.rounded-3xl]="!isExpanded()">
            
            <!-- Botón de Expandir/Contraer -->
            <button (click)="toggleExpand()" 
              class="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-md p-2 rounded-full shadow-lg hover:bg-white transition-all text-slate-700 hover:text-blue-700 hover:scale-110">
              @if (isExpanded()) {
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              }
            </button>

            <!-- Loading Overlay -->
            @if (isLoading()) {
              <div class="absolute inset-0 bg-white/60 backdrop-blur-sm z-[2000] flex flex-col items-center justify-center">
                <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent"></div>
                <p class="mt-4 font-bold text-slate-700 animate-pulse">Cargando Mapa...</p>
              </div>
            }

            <!-- El Contenedor Leaflet -->
            <div #mapContainer class="w-full h-full z-0 bg-slate-200"></div>

            <!-- Panel Flotante de Detalles -->
            @if (selectedPoint(); as point) {
              <div class="absolute bottom-8 left-4 right-4 lg:left-8 lg:right-auto lg:w-80 bg-white/95 backdrop-blur-xl p-5 rounded-2xl shadow-2xl border border-white/60 z-[999] animate-slide-up">
                <div class="flex justify-between items-start mb-2">
                  <span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">WiFi Gratis</span>
                  <button (click)="selectedPoint.set(null)" class="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                
                <h3 class="font-bold text-slate-900 text-sm leading-tight mb-1">{{ point.id }}</h3>
                <p class="text-xs text-slate-600 mb-4">{{ point.alcaldia }} • {{ point.programa }}</p>
                
                <button 
                  (click)="toggleFav(point)"
                  class="w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border"
                  [ngClass]="favService.isFavorite(point.id) ? 'bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100' : 'bg-slate-800 text-white border-transparent hover:bg-slate-700 shadow-lg'">
                  @if (favService.isFavorite(point.id)) {
                    <span>Quitar de Favoritos</span>
                  } @else {
                    <span>Guardar en Favoritos</span>
                  }
                </button>
              </div>
            }
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(100, 116, 139, 0.5); 
      border-radius: 20px;
    }
    @keyframes slide-up {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .animate-slide-up {
      animation: slide-up 0.3s ease-out forwards;
    }
  `]
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  private wifiService = inject(WifiDataService);
  public favService = inject(FavoritesService);
  private authService = inject(AuthService);

  // STATE Signals
  // 1. Datos crudos
  rawPoints = signal<WifiPoint[]>([]);
  isLoading = signal<boolean>(true);
  
  // 2. Estado del filtro y selección
  selectedAlcaldia = signal<string>('TODAS');
  selectedPoint = signal<WifiPoint | null>(null);
  
  isExpanded = signal(false);

  // Signals para la recomendación
  isLocating = signal(false);
  locationError = signal(false);
  userLocation = signal<{lat: number, lng: number} | null>(null);
  nearestDistance = signal<number | null>(null);

  // COMPUTED SIGNALS
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
    return filter === 'TODAS' ? points : points.filter(p => p.alcaldia === filter);
  });

  favPoints = computed(() => {
    const all = this.rawPoints();
    const favIds = this.favService.favorites(); 
    if (!favIds || all.length === 0) return [];
    return all.filter(p => favIds.some(f => f.id === p.id));
  });

  @ViewChild('mapContainer') mapContainer!: ElementRef;
  private map: L.Map | undefined;
  private markersLayer: L.LayerGroup | undefined;
  
  // Layers para la recomendacion
  private userMarkerLayer: L.CircleMarker | undefined;
  private routeLineLayer: L.Polyline | undefined;

  constructor() {
    // 5. EFECTO DE PINTADO: Reacciona automáticamente a cambios en puntos O favoritos
    // Solo se encarga de dibujar iconos y borrar capas viejas. NO HACE ZOOM.
    effect(() => {
      const points = this.filteredPoints();
      const favorites = this.favService.favorites(); 
      if (this.map && !this.isLoading()) {
        this.updateMapMarkers(points);
      }
    });

    // 6. EFECTO DE ZOOM AUTOMÁTICO: Solo reacciona cuando cambian los FILTROS/DATOS
    // Al separar esto, cuando das "Like" (cambia favorites), este effect NO corre.
    effect(() => {
      const points = this.filteredPoints();
      if (this.map && points.length > 0 && !this.isLoading()) {
         const latLngs = points
            .map(p => [Number(p.latitud), Number(p.longitud)] as [number, number])
            .filter(c => !isNaN(c[0]) && !isNaN(c[1])); // Doble seguridad
         
         if (latLngs.length > 0) {
            const bounds = L.latLngBounds(latLngs);
            this.map.fitBounds(bounds, { padding: [50, 50] });
         }
      }
    });

    // Effect para invalidar tamaño al expandir
    effect(() => {
      const expanded = this.isExpanded();
      setTimeout(() => {
        this.map?.invalidateSize();
      }, 300);
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

  toggleExpand() {
    this.isExpanded.update(v => !v);
  }

  toggleFav(point: WifiPoint) {
    this.favService.toggleFavorite(point.id);
  }

  // Limpiar la recomendacion
  private clearRecommendationVisuals() {
    // Si existen layers de recomendación, los removemos
    if (this.userMarkerLayer) {
      this.userMarkerLayer.remove();
      this.userMarkerLayer = undefined;
    }
    if (this.routeLineLayer) {
      this.routeLineLayer.remove();
      this.routeLineLayer = undefined;
    }
    
    // Reseteamos el estado para que el panel
    this.userLocation.set(null);
    this.nearestDistance.set(null);
  }

  flyToPoint(point: WifiPoint) {
    // Al seleccionar manualmente un punto, limpiamos la ruta de recomendación previa
    this.clearRecommendationVisuals();

    const lat = Number(point.latitud);
    const lng = Number(point.longitud);
    
    if(!isNaN(lat) && !isNaN(lng)) {
      //Si el favorito esta en otra alcaldia oculta ajustamos el filtro
      if (point.alcaldia && this.selectedAlcaldia() !== point.alcaldia && this.selectedAlcaldia() !== 'TODAS') {
        this.selectedAlcaldia.set(point.alcaldia);
      }
      this.selectedPoint.set(point); 
      this.map?.flyTo([lat, lng], 17, { duration: 1.5 });
    }
  }

  // Apartado de recomendación
  findNearestWifi(): void {
    if (!navigator.geolocation) {
      alert('Geolocalización no soportada');
      return;
    }
    
    // Limpiamos previos por si acaso
    this.clearRecommendationVisuals();

    this.isLocating.set(true);
    this.locationError.set(false); 

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        this.userLocation.set({ lat: userLat, lng: userLng });

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

        if (nearestPoint && this.map) {
          const targetLat = Number((nearestPoint as WifiPoint).latitud);
          const targetLng = Number((nearestPoint as WifiPoint).longitud);
          
          if ((nearestPoint as WifiPoint).alcaldia && this.selectedAlcaldia() !== (nearestPoint as WifiPoint).alcaldia && this.selectedAlcaldia() !== 'TODAS') {
             this.selectedAlcaldia.set((nearestPoint as WifiPoint).alcaldia);
          } else if (this.selectedAlcaldia() === 'TODAS' && (nearestPoint as WifiPoint).alcaldia) {
             this.selectedAlcaldia.set((nearestPoint as WifiPoint).alcaldia);
          }

          this.selectedPoint.set(nearestPoint);
          this.nearestDistance.set(minDistance);
          
          // Guardamos referencias para poder borrarlos luego
          this.userMarkerLayer = L.circleMarker([userLat, userLng], { radius: 8, color: '#3b82f6', fillOpacity: 1 }).addTo(this.map).bindPopup("Tú");
          this.routeLineLayer = L.polyline([[userLat, userLng], [targetLat, targetLng]], { color: '#3b82f6', dashArray: '10, 10', weight: 4 }).addTo(this.map);
          
          this.map.flyTo([targetLat, targetLng], 17, { duration: 1.5 });
        }
        this.isLocating.set(false);
      },
      () => {
        this.isLocating.set(false);
        this.locationError.set(true);
      }
    );
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: false 
    }).setView([19.4326, -99.1332], 12);
    
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CARTO',
      maxZoom: 20
    }).addTo(this.map);

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
        const isFav = this.favService.isFavorite(point.id);
        const icon = isFav ? iconFav : iconDefault;

        L.marker([lat, lng], { icon })
          .on('click', () => {
             // Si el usuario hace click un  marcador, limpiamos la recomendación
             this.clearRecommendationVisuals();
             
             this.selectedPoint.set(point);
             // Solo hacemos FlyTo, pero NO reset de bounds global
             this.map?.flyTo([lat, lng], 16, { duration: 0.8 });
          })
          .addTo(this.markersLayer!);
      }
    });
    
    // NOTA: He eliminado el bloque if (...) { fitBounds } de aquí.
    // Ahora vive en su propio effect en el constructor.
  }
}