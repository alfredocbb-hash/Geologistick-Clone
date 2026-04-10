

## Plan: Optimización de velocidad (Escritorio y Móvil)

### Problema principal identificado

El archivo `App.tsx` importa **las 70+ páginas de forma estática** (eager imports). Esto significa que al cargar **cualquier** ruta (incluso la landing `/`), el navegador descarga y parsea **todo** el código de la aplicación: Dashboard, LiveMap, RoutePlanner, Shipments, eCommerce, etc. En móvil esto es especialmente grave por el ancho de banda y CPU limitados.

Además, `GoogleMapsProvider` envuelve **toda** la app, disparando una llamada a la edge function `get-maps-config` incluso en rutas públicas que no necesitan mapa.

### Cambios propuestos

#### 1. Code splitting con React.lazy (App.tsx)

Convertir todas las importaciones de páginas a `React.lazy()` para que cada página se descargue solo cuando el usuario navega a ella. Se mantienen como imports directos solo: `Index`, `Login`, `NotFound` (las más frecuentes de entrada).

```text
Antes:  import Dashboard from "./pages/Dashboard";
Después: const Dashboard = lazy(() => import("./pages/Dashboard"));
```

Envolver las rutas con `<Suspense fallback={<PageLoader />}>` que muestra un spinner centrado.

#### 2. Mover GoogleMapsProvider dentro de DashboardLayout

Solo las rutas autenticadas (dashboard, live-map, planner, etc.) necesitan Google Maps. Moverlo desde `App.tsx` a `DashboardLayout.tsx` evita cargar la API de Maps y la llamada a `get-maps-config` en rutas públicas (landing, login, tracking, terms, etc.).

#### 3. Configurar Vite para mejor chunking

Agregar `build.rollupOptions.output.manualChunks` en `vite.config.ts` para separar vendor libs grandes (react, tanstack-query, date-fns, recharts, supabase) del código de la app:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        query: ['@tanstack/react-query'],
        supabase: ['@supabase/supabase-js'],
        ui: ['date-fns', 'lucide-react'],
      }
    }
  }
}
```

#### 4. Cache headers en index.html

Eliminar las meta tags `no-cache, no-store, must-revalidate` del `index.html`. Vite ya genera hashes en los nombres de archivos JS/CSS, así que el caching es seguro y acelera recargas.

### Archivos a modificar

- **`src/App.tsx`** — Convertir ~65 imports a `React.lazy`, agregar `Suspense`, mover `GoogleMapsProvider` fuera
- **`src/components/layout/DashboardLayout.tsx`** — Envolver children con `GoogleMapsProvider`
- **`vite.config.ts`** — Agregar manual chunks
- **`index.html`** — Eliminar meta tags anti-cache

### Impacto estimado

- **Landing page**: de cargar ~2-3MB de JS a ~200-400KB (solo lo necesario)
- **Navegación interna**: cada página se descarga bajo demanda (~50-150KB cada una)
- **Móvil**: mejora significativa en tiempo de carga inicial y consumo de datos
- **Escritorio**: mejora en TTI (Time to Interactive) y FCP (First Contentful Paint)

### Seguridad

No se modifican queries, RLS, ni lógica de negocio. Solo se cambia **cuándo** se carga el código, no **qué** código se ejecuta.

