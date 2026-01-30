

# Plan: Permitir Optimizar y Crear Rutas con 1 Solo Envío

## Problema Identificado

Actualmente el planificador requiere **mínimo 2 envíos** para poder optimizar y crear una ruta. Esto impide crear rutas para un solo retiro.

**Ubicación del problema:** `src/pages/RoutePlanner.tsx`
- Línea 542: `if (selectedEnvios.length < 2)` - Bloquea la función
- Línea 937: `disabled={isOptimizing || selectedEnvios.length < 2}` - Deshabilita el botón

## Lógica Propuesta

Si hay **1 solo envío**, no es necesario "optimizar" (no hay nada que ordenar), pero sí debe permitirse:
1. Crear la ruta con ese único envío
2. Usar la sucursal del usuario como origen
3. Asignar chofer y vehículo

## Cambios a Implementar

### 1. Modificar la función `optimizeRoute`

Cambiar la validación para manejar el caso de 1 envío:

```typescript
// ANTES (línea 541-545)
if (selectedEnvios.length < 2) {
  toast.error("Selecciona al menos 2 envíos para optimizar");
  return;
}

// DESPUÉS
if (selectedEnvios.length === 0) {
  toast.error("Selecciona al menos 1 envío");
  return;
}

// Si solo hay 1 envío, crear ruta directa sin optimización
if (selectedEnvios.length === 1) {
  const envio = selectedEnviosData[0];
  if (!envio.coords?.lat || !envio.coords?.lng) {
    toast.error("El envío no tiene coordenadas. Geolocalizalo primero.");
    return;
  }
  
  const singleStop: RouteStop = {
    envio_id: envio.id,
    tipo: envio.tipo,
    direccion: envio.tipo === "retiro" 
      ? (envio.direccion_retiro || envio.remitente?.direccion)
      : (envio.direccion_entrega || envio.destinatario?.direccion),
    lat: Number(envio.coords.lat),
    lng: Number(envio.coords.lng),
    cliente_nombre: envio.tipo === "retiro" 
      ? (envio.nombre_remitente || `${envio.remitente?.nombre || ''} ${envio.remitente?.apellido || ''}`.trim())
      : (envio.nombre_destinatario || `${envio.destinatario?.nombre || ''} ${envio.destinatario?.apellido || ''}`.trim()),
    telefono: envio.tipo === "retiro" ? envio.remitente?.telefono : envio.destinatario?.telefono,
    tracking: envio.tracking_number,
  };
  
  const distancia = calcDistance(
    sucursalOrigen?.lat ? Number(sucursalOrigen.lat) : -34.6037,
    sucursalOrigen?.lng ? Number(sucursalOrigen.lng) : -58.3816,
    singleStop.lat,
    singleStop.lng
  ) * 1.3; // Factor de corrección
  
  const singleOption: RouteOption = {
    name: envio.tipo === "retiro" ? "🏠 Retiro único" : "📦 Entrega única",
    stops: [singleStop],
    totalDistance: Math.round(distancia * 10) / 10,
    estimatedTime: Math.round((distancia / 25 + 0.1) * 10) / 10,
    reasoning: "Ruta directa desde la sucursal al punto de " + (envio.tipo === "retiro" ? "retiro" : "entrega"),
  };
  
  setRouteOptions([singleOption]);
  setSelectedOption(singleOption);
  toast.success("Ruta preparada");
  return;
}
```

### 2. Actualizar la condición del botón

Cambiar de mínimo 2 a mínimo 1:

```tsx
// ANTES (línea 937)
disabled={isOptimizing || selectedEnvios.length < 2}

// DESPUÉS
disabled={isOptimizing || selectedEnvios.length < 1}
```

### 3. Cambiar el texto del botón contextualmente

```tsx
// ANTES
<><Zap className="mr-2 h-4 w-4" />Optimizar Ruta</>

// DESPUÉS
{selectedEnvios.length === 1 ? (
  <><Navigation className="mr-2 h-4 w-4" />Preparar Ruta</>
) : (
  <><Zap className="mr-2 h-4 w-4" />Optimizar Ruta</>
)}
```

---

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/RoutePlanner.tsx` | Manejar caso de 1 envío, actualizar botón |

## Resultado Esperado

1. El usuario selecciona 1 retiro
2. El botón muestra "Preparar Ruta" (en vez de "Optimizar Ruta")
3. Al hacer clic, crea una ruta directa desde la sucursal al punto de retiro
4. El usuario puede asignar chofer y confirmar la ruta

