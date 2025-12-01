import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { WifiPoint } from '../models/wifi-point.interface';

@Injectable({
  providedIn: 'root'
})
export class WifiDataService {

  private http = inject(HttpClient);
  
  // La ruta a mi archivo JSON de datos de los wifi points
  private dataUrl = 'assets/data/wifi-points.json';

  // Método para obtener los puntos WiFi
  getWifiPoints(): Observable<WifiPoint[]> {
    return this.http.get<WifiPoint[]>(this.dataUrl);
  }
}