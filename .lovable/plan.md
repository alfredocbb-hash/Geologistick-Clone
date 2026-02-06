

# Plan: Correcciones y Mejoras del Modo Flex (basado en videos)

## Problemas Detectados en los Videos

Del video de tu app (ChoferApp):
1. **Escaneo se cierra tras cada paquete** - Hay que reabrir la camara cada vez
2. **El mapa no muestra paradas antes de iniciar reparto** - Posible falta de coordenadas
3. **Despues de INICIAR REPARTO no navega correctamente** - Bug critico de navegacion
4. **La foto no se guarda y el dialogo vuelve al principio** - Bug en DeliveryConfirmation
5. **No hay opcion de solo escanear sin iniciar ruta** - Quiere dejar paquetes como "escaneados"

Del video de Mercado Envios Flex (referencia):
- Escaneo continuo: la camara queda abierta, va sumando paquetes abajo con contador
- Despues de "Empezar a repartir" muestra mapa con todas las paradas

---

## Solucion por Problema

### 1. Escaneo Continuo (sin cerrar camara)

Actualmente, al escanear un QR se ejecuta `setShowScanner(false)` inmediatamente. Esto cierra la camara y obliga al chofer a tocar "ESCANEAR" de nuevo.

**Cambio:** Implementar modo "batch" en el QRScanner:
- Agregar prop `continuousMode` al QRScanner
- En vez de cerrar al detectar un QR, mostrar un overlay con feedback visual (badge con contador)
- El chofer cierra manualmente cuando termina de escanear
- Sonido/vibracion al detectar cada paquete
- Mostrar un mini-contador flotante: "3 paquetes escaneados"

**Archivos:**
- `src/components/qr/QRScanner.tsx` - Agregar soporte para modo continuo
- `src/components/mobile/FlexScanScreen.tsx` - Usar modo continuo, acumular resultados

### 2. Bug Critico: Navegacion rota al iniciar reparto

**Problema encontrado en el codigo:**

```text
FlexScanScreen.tsx linea 89:
  navigate(`/active-route/${routeId}`)

Pero la ruta en App.tsx es:
  <Route path="/active-route" element={<ActiveRouteNavigation />} />

Y ActiveRouteNavigation lee:
  const routeId = searchParams.get('id')
  const routeType = searchParams.get('type') || 'hoja'
```

El ID se pasa como segmento de URL (`/active-route/abc123`) pero la pagina lo busca como query parameter (`?id=abc123`). Ademas falta `type=planificada`.

**Correccion:**
```typescript
// De:
navigate(`/active-route/${routeId}`);

// A:
navigate(`/active-route?id=${routeId}&type=planificada`);
```

**Archivo:** `src/hooks/useFlexPackages.ts` o `src/components/mobile/FlexScanScreen.tsx`

### 3. La foto no se guarda y el dialogo se reinicia

**Problema:** El `<input type="file" capture="environment">` en Android Capacitor puede causar que la WebView se recargue al volver de la camara nativa, perdiendo el estado del componente (foto, firma, todo).

**Solucion:**
- Guardar el estado del formulario (foto capturada) en `sessionStorage` antes de abrir la camara
- Al montar el componente, recuperar el estado guardado
- Alternativa: usar `URL.createObjectURL` en vez de FileReader para evitar re-renders pesados
- Agregar un `key` estable al Dialog para evitar re-montajes

**Archivo:** `src/components/delivery/DeliveryConfirmation.tsx`

### 4. Cache Invalidation desalineado

**Problema:** En `ActiveRouteNavigation.tsx`, los callbacks `onSuccess` de los dialogos invalidan:
```text
queryKey: ['my-active-route-envios']
```

Pero las queries reales usan:
```text
queryKey: ['my-active-route-paradas', routeId]      (rutas planificadas)
queryKey: ['my-active-route-envios-hoja', routeId]  (hojas de ruta)
```

La clave `'my-active-route-envios'` no coincide con ninguna query real, asi que la lista nunca se refresca despues de confirmar una entrega.

**Correccion:** Actualizar los callbacks para usar las claves correctas. El `DeliveryConfirmation` ya invalida las claves correctas internamente (`onMutate`/`onSuccess`), pero los callbacks padre tambien necesitan alinearse.

**Archivo:** `src/pages/ActiveRouteNavigation.tsx`

### 5. Mapa no muestra paradas (antes de iniciar ruta)

El mapa en `FlexMapPreview` funciona correctamente en codigo - muestra paquetes que tienen `entrega_lat` y `entrega_lng`. Si no se ven paradas, es porque los envios no tienen coordenadas geocodificadas.

**Mejora:** Agregar geocodificacion automatica al agregar un paquete en modo Flex:
- Si el paquete tiene `direccion_entrega` pero no tiene `entrega_lat/lng`, llamar al edge function `geocode-address` para obtener las coordenadas
- Actualizar el envio en la base de datos con las coordenadas
- Mostrar indicador visual de cuantos paquetes tienen/no tienen ubicacion

**Archivos:**
- `src/hooks/useFlexPackages.ts` - Agregar geocodificacion automatica
- `src/components/mobile/FlexScanScreen.tsx` - Mostrar indicador de ubicaciones

---

## Secuencia de Implementacion

1. **Corregir navegacion** (bug critico - `FlexScanScreen.tsx`)
2. **Corregir cache invalidation** (bug - `ActiveRouteNavigation.tsx`)
3. **Corregir foto en DeliveryConfirmation** (bug - `DeliveryConfirmation.tsx`)
4. **Implementar escaneo continuo** (`QRScanner.tsx` + `FlexScanScreen.tsx`)
5. **Geocodificacion automatica** (`useFlexPackages.ts`)

---

## Detalle Tecnico

### Escaneo Continuo - Flujo

```text
[Chofer toca ESCANEAR]
       |
       v
[Camara se abre - modo continuo]
       |
       v
[Detecta QR] --> [Sonido + vibracion]
       |              |
       |         [Badge: "1 escaneado"]
       |              |
       v              v
[Sigue escaneando] --> [Detecta otro QR]
       |                    |
       |              [Badge: "2 escaneados"]
       |
[Chofer toca X para cerrar]
       |
       v
[Camara se cierra, paquetes en lista]
```

### DeliveryConfirmation - Persistencia de foto

```text
[Chofer toca "Tomar Foto"]
       |
       v
[Se abre camara nativa (capture="environment")]
       |
       v
[Android puede recargar WebView]
       |
       v
[Al re-montar, recuperar de sessionStorage]
       |
       v
[Foto restaurada, chofer continua con firma y confirmar]
```
