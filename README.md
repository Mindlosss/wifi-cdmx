# WIFI CDMX

LINK: https://wifi-cdmx-22.web.app

## Reto elegido y alcance
Seleccioné el mini proyecto "Mapa Wi‑Fi CDMX" porque me parecía muy interesante y en lo personal desafiante, ademas considero que tenía muy buena relación con lo que hacen en Enacment desde UX/UI hasta ocation intelligence y data analytics.
- Visualización de putos con wifi libre en un mapa interactivo con leaflet.
- Filtrado por alcaldías.
- Sistema de recomendación por proximidad usando la fórmula Haversine.
- Persistencia de ubicación favoritas por usuario mediante firestore y autenticación anonima por practicidad.

## Arquitectura y estructura
Organicé el proyecto siguiendo un poco la arquitectura Feature-first.
```bash
src/app/
├── core/               # Lógica de negocio pura y services
│   ├── models/         # Interfaces estrictas
│   ├── services/       # Comunicación de datos
│   └── utils/          # Funciones puras
├── features/           # Módulos funcionales autónomos
│   └── map/            # Smart Component principal (Lógica de mapa + UI Dashboard)
```
### Stack

- Frontend: Angular 20.
- Estado: Angular Signals (signal, computed, effect) para reactividad granular.
- Mapas: Leaflet.
- Estilos: Tailwind CSS con configuración personalizada para efectos insipirados en liquid glass.
- Backend: Firebase (Auth Anónima + Firestore).

## Modelo de datos
Colección favorites:
```bash
{
  "__id": "USER_UID_WIFI_ID",  // ID del Documento (Compuesto: userId + wifiId)
  "wifiId": "CUA-045",         // ID del punto original
  "userId": "Xy7z...",         // Owner para reglas de seguridad
  "addedAt": "ISO_STRING"      
}
```
```bash
JSON ubicaciones:
{
  "id":"CTP-PAP17",
  "programa":"Transporte (Metrobus, Cablebus, Tren Ligero, Trolebus, etc.)",
  "latitud":19.55785,
  "longitud":-99.13338,
  "alcaldia":"Gustavo A. Madero"
}
```
## Estado y navegación
Aunque la aplicación se presenta como una Single Page Application (SPA) inmersiva, la gestión del estado y la navegación interna están orquestadas así:
- Estrategia de Estado:
  - Se abandonó el uso de ngOnChanges y BehaviorSubjects en favor de Signals (signal, computed).
  - Flujo unidireccional: Los servicios alimentan señales de lectura (rawPoints), y la vista reacciona a señales derivadas (filteredPoints, uniqueAlcaldias). Esto garantiza que la detección de cambios sea granular y funcione muy bien.
  - Estado reactivo global: La autenticación y la lista de favoritos se manejan mediante switchMap en el servicio y se exponen como señales de solo lectura (toSignal) a los componentes.
- Navegación:
  - En lugar de ruteo tradicional por URL, implementé una navegación de estado visual, para no tener que recargar un elemento pesado como el mapa.
  - El panel lateral y el mapa responden a estados de expansión (isExpanded) y selección (selectedPoint), permitiendo transiciones fluidas sin desmontar el DOM del mapa, y así se mantiene con buen rendimiento.

## Decisiones técnicas
- Diseño: uso de clases con Taliwind
  - Justificación: Crear un diseño atractivo inspirado en liquid glass, usando transparencias y capas sin entrar en CSS puro.
- Dataset de Wifi points: uso de un archivo JSON con ubicaciones.
  - Justificación: Usar un dataset real con ubicaciones reales, creo que se ve una distribución mucho mejor que al simular ubicaciones.
- Inyección de dependencias: uso de inject en lugar de inyección por constructor,
  - Justififación: nos da un código más simple, con mejor soporte de tipos, y sobre todo porque permite usar contextos de inyección dinámicos como runInInjectionContext.
 
## Escalabilidad y mantenimiento
- Separación de Capas: La lógica de datos (fetching, auth, cálculo de distancia) está completamente desacoplada de la UI en la carpeta core. Si en algún momento se cambia el JSON por una API REST real, solo se modifica WifiDataService sin tocar el componente del mapa.
- Type Safety: Uso estricto de interfaces (WifiPoint) en todo el flujo de datos. Esto previene errores en tiempo de ejecución si la estructura de datos cambia.
- Modularidad: Al usar Standalone Components, nuevas funcionalidades pueden agregarse como componentes aislados sin refactorizar módulos gigantes.

## Seguridad y validaciones
- Reglas de Firestore: Se configuraron reglas que validan request.auth.uid == resource.data.userId. Esto impide que un usuario malintencionado borre o lea favoritos de otros, incluso si tiene las credenciales de la API pública.
- Autenticación Anónima: Se fuerza un inicio de sesión anónimo al iniciar la app. Esto genera un UID único para la sesión sin fricción para el usuario, necesario para aplicar las reglas de seguridad anteriores.
- Sanitización: Angular protege por defecto contra XSS en la interpolación de datos. Además, el input de filtrado es un select controlado, eliminando riesgos de inyección en búsquedas.

```bash
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /favorites/{document=**} {
      
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;

      allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Rendimiento
- Carga de datos: El dataset de puntos WiFi se carga una sola vez al inicio y se mantiene en memoria. Las operaciones de filtrado y búsqueda de punto wifi mas cercano ocurren en el cliente en tiempo real.
- Gestión de DOM: El uso de OnPush implícito con Signals evita verificaciones de cambios innecesarias en todo el árbol de componentes.
- Leaflet optimization: Se utilizan marcadores nativos de Leaflet que manejan eficientemente el canvas/DOM. Para la lista de favoritos, se utiliza el scroll nativo del navegador, que es performante para listas de tamaño moderado.

## Accesibilidad
- Contraste Visual: Se ajustaron los colores del tema "Liquid Glass" para asegurar legibilidad suficiente sobre el fondo animado.
- Semántica: Uso correcto de etiquetas HTML para asegurar que los lectores de pantalla interpreten la estructura correctamente.
- Touch Targets: Botones y elementos de lista tienen áreas de clic ampliadas (p-3, p-4) para facilitar la interacción en dispositivos móviles.

## Uso de IA
Usé la IA como herramienta de aceleración en cuanto a codificar algunas partes, como medio de consulta técnica, revisión / corrección de errores y casos de uso, bajo supervisión estricta.

¿En qué partes te apoyaste y por qué?

- Estructura inicial del proyecto: porque de esta forma tuve una base para comenzar a distribuir mis archivos de forma organizada considerando mis requerimientos.
- Elementos visuales varios: pequeños usos del agente en la IDE para corregir pequeños errores visuales en segundos.
- Scaffolding inicial de la estructura CSS: porque así logré los efectos de transparencia facilmente que quería para mi frontend y así solo tuve que reeplicarlos donde los requiriera.
- Generación del algoritmo Haversine en TypeScript: porque de esta forma no tuve que pasar la formula a codigo manualmente y ahorré mucho tiempo.
- Debugging de errores de contexto de inyección (InjectionContext) al usar AngularFire con signals: porque así no tuve que leer de lleno la doc para usar correctamente el ecosistema.
- Maqueta basica: porque así obtuve rapidamente una primera idea distribución de los elementos que quería ubicar en mi vista me sirvió como pauta y acelerar el proceso creativo.
- Condiciones para diferentes casos de uso: Solicité a la IA que revisara mi componente del mapa y me sugiriera condiciones para ciertos escenarios de interacción con el mapa y los filtros y así mejorar UX.
- Para decidir si usaba Leaflet o MapLibre, porque personalmente no tenía experiencia previa con ninguna de las dos y quería tener nociones generales.

¿Qué sugerencias aceptaste vs. reescribiste?

- Aceptada: La sugerencia de usar runInInjectionContext para solucionar el error de AngularFire dentro de los pipes de RxJS.
- Aceptada: La idea de usar Leaflet porque tiene una mayor compatibilidad con dispositivos me pareció buena.
- Aceptada: Las sugerencias de casos de uso (aunque varias condiciones las cambié porque no eran del todo precisas).
- Aceptada: Añadir un panel flotante a la parte del mapa expandido, ya había colocado el pequeño contenedor y me refactorizó un poco el código para que estuviera dentro del mapa.
- Reescrita: La ia me sugirió una maqueta inical en donde los contenedores estaban muy al centro de la pantalla y eran angostos, por lo que decidí tomar cietas partes con sus clases pero reeescribí otras para distribuir mejor el contenido.
- Reescrita: Algunos efectos visuales como los zoom, focus y croll, tenían pequeños errores.
- Reescrita: la sugerencia de usar directivas *ngFor en el template para renderizar marcadores de Leaflet, ya que esta librería manipula el DOM directamente. mejor se usó por una gestión programática mediante L.layerGroup para un mejor rendimiento.

Riesgos y Mitigación:

Realmente no detecté mucho riesgo en general, puesto que siempre se intentan usar buenas practicas.

- Error: Calling Firebase APIs outside of an Injection context. Esto pasa porque la IA mezcló código reactivo viejo (RxJS) con código moderno (Signals/Inyección funcional).
- Riesgo: Que la aplicación se vuelva inestable, tenga fugas de memoria o que la detección de cambios de Angular se rompa silenciosamente.
- Solución: apliqué la corrección de usar runInInjectionContext

Resumen de prompts:

Podría decir que un enfoque iterativo, me gusta pedirle cosas especificas aislando la parte de codigo involucrada o lo que hay que resolver, darle instrucciones, contexto breve para intentar conseguir la respuesta mas acertada posible.

- "Explícame por qué recibo el error 'Firebase called outside injection context'".
- "Estoy usando tailwindcss para mi frontend, como le puedo añadir un poco de textura a mi fondo para que tengan coherencia los efectos de transparencia".
- "Mejora mi función de zoom in al hacer click en una ubicación"
- "Qué otros casos de uso observas en mi componente donde debería aplicar condiciones y así el usuario tenga una mejor experiencia interactuando con mi pagina?"

## Limitaciones y siguientes pasos
- Hacer la pagina totalmente responsiva
- Rutas reales: Actualmente la ruta que se traza es una recta. El siguiente paso sería integrar OSRM o algo por el estilo para dibujar rutas peatonales siguiendo las calles.
- Implementar un login si se añadieran funciones adicionales que lo requisieran.

## Instalación / despliegue
Instalación y Despliegue

Clonar e Instalar:
```bash
git clone https://github.com/Mindlosss/wifi-cdmx.git
```
Instalar dependencias:
```bash
npm install
```
Ejecutar:
```bash
npm start / ng serve
```
Configuración (Opcional, solo si quieres cambiar a tu Firebase):

Copiar credenciales de Firebase en src/environments/environment.ts. Asegurar que la Auth Anónima esté habilitada en Firebase Console y tener BD.

Despliegue:
```bash
ng build
firebase deploy
```
