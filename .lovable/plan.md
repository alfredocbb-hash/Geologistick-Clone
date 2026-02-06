

# Plan: Corregir los bugs restantes del Modo Flex

## Problemas encontrados en el codigo (post-fixes anteriores)

Despues de analizar el flujo completo y las correcciones recientes, encontre **3 bugs criticos** que impiden el funcionamiento correcto del Modo Flex:

---

### Bug 1: La ruta se crea pero nunca se "inicia"

Cuando el chofer toca "INICIAR REPARTO":
1. `createRoute()` crea la ruta con `estado: 'pendiente'`
2. Navega directamente a `/active-route?id=...&type=planificada`
3. **Nunca llama a `start_ruta_planificada`** (la funcion RPC que cambia el estado a `en_curso` y actualiza los envios a `en_reparto`)

**Consecuencias:**
- La ruta queda en estado `pendiente` indefinidamente
- Los envios no se actualizan a `en_reparto`
- Si el chofer cierra la app y vuelve a abrir, la ruta no aparece como "activa"
- En la pantalla Home, no se muestra la ruta activa

**Solucion:** Llamar a `start_ruta_planificada` en `createRoute()` despues de crear la ruta y las paradas, antes de navegar.

---

### Bug 2: El mapa no muestra paradas (ActiveRouteNavigation)

El mapa en la pantalla de ruta activa esta vacio porque:

1. La query de envios **no incluye** `entrega_lat` ni `entrega_lng`:
```text
envio:envios(id, tracking_number, estado, ... direccion_entrega, ciudad_entrega, ...)
// Faltan: entrega_lat, entrega_lng
```

2. El codigo de markers busca en los campos equivocados:
```text
// Busca en:
(envio).destinatario_lat  --> No existe en la query
(envio).destinatario?.lat --> clientes no tiene campo 'lat'
```

3. Las coordenadas en `ruta_paradas.lat/lng` (que SI tienen datos del escaneo Flex) son completamente ignoradas.

**Solucion:**
- Agregar `entrega_lat, entrega_lng` al SELECT de la query de paradas
- Usar `entrega_lat/lng` como fuente principal de coordenadas
- Como fallback, usar `ruta_paradas.lat/lng` (ya tienen las coordenadas guardadas)

---

### Bug 3: La pantalla Home no muestra rutas Flex activas

En `MobileHomeTab.tsx`, la query de rutas planificadas filtra por:
```text
.in('estado', ['asignada', 'confirmada', 'en_progreso'])
```

Pero el estado correcto (definido en la funcion `start_ruta_planificada`) es `'en_curso'`, no `'en_progreso'`. Por eso la ruta activa nunca aparece en Home.

**Solucion:** Cambiar `'en_progreso'` por `'en_curso'`.

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useFlexPackages.ts` | Llamar a `start_ruta_planificada` despues de crear la ruta |
| `src/pages/ActiveRouteNavigation.tsx` | Agregar `entrega_lat, entrega_lng` al SELECT; usar coordenadas correctas para markers; usar `ruta_paradas.lat/lng` como fallback |
| `src/components/mobile/MobileHomeTab.tsx` | Cambiar `'en_progreso'` por `'en_curso'` en el filtro de estados |

---

## Detalle Tecnico

### useFlexPackages.ts - Agregar inicio de ruta

```text
// Despues de crear ruta y paradas:
const { data: startResult, error: startError } = await supabase.rpc(
  'start_ruta_planificada',
  { p_ruta_id: ruta.id }
);

if (startError || !(startResult as any)?.success) {
  console.error('Error starting route:', startError || startResult);
  // No bloquear - la ruta ya esta creada, simplemente seguir
}
```

### ActiveRouteNavigation.tsx - Arreglar coordenadas del mapa

En la query de paradas (linea ~163), agregar campos de coordenadas:
```text
envio:envios(
  id, tracking_number, estado, ...
  entrega_lat,      <-- NUEVO
  entrega_lng,      <-- NUEVO
  ...
)
```

En el builder de markers (linea ~262), usar las coordenadas correctas:
```text
// Para entregas, priorizar entrega_lat/lng del envio,
// fallback a ruta_paradas.lat/lng
const lat = isItemPickup
  ? (envio as any).remitente_lat
  : ((envio as any).entrega_lat || item.lat);
const lng = isItemPickup
  ? (envio as any).remitente_lng
  : ((envio as any).entrega_lng || item.lng);
```

### MobileHomeTab.tsx - Estado correcto

```text
// De:
.in('estado', ['asignada', 'confirmada', 'en_progreso'])

// A:
.in('estado', ['asignada', 'confirmada', 'en_curso', 'pendiente'])
```

Incluir `'pendiente'` tambien para que las rutas recien creadas (pre-inicio) tambien aparezcan en Home.

---

## Resultado Esperado

1. El chofer escanea paquetes en Modo Flex
2. Toca "INICIAR REPARTO"
3. La ruta se crea Y se inicia automaticamente (estado `en_curso`)
4. Los envios se actualizan a `en_reparto`
5. La pantalla ActiveRoute muestra la lista de paradas con coordenadas
6. El mapa muestra las paradas correctamente
7. La ruta aparece como "activa" en Home si el chofer vuelve a la pantalla principal

