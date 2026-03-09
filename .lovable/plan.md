

# Diagnóstico: ENV-A5M2MV tomó tarifa no habilitada

## Hallazgo

El envío ENV-A5M2MV fue creado desde BAHIA BLANCA con la tarifa "ENVIOS GENERAL", que está explícitamente **deshabilitada** (`habilitada: false`) para esa sucursal. Las tarifas habilitadas para BAHIA BLANCA son:
- LINEAS TERCERIZADAS ✅
- Mar del plata, Bahia blanca, Rosario, Cordoba, Mendoza a Bsas ✅
- TERCERIZADAS EXTERNAS ✅

## Causa raíz: Race condition

El tenant Blackbox tiene `auto_seleccion_tarifa_por_zona: true`. Esto activa un `useEffect` que auto-selecciona la tarifa basándose en la ciudad destino.

El problema es una **condición de carrera** entre dos queries:

1. **`tarifas`** (todas las activas del tenant) — se resuelve rápido
2. **`sucursal_tarifas`** (cuáles están habilitadas para la sucursal) — se resuelve después

El memo `tarifasDisponibles` tiene esta lógica:
```typescript
if (allSucursalTarifas.length === 0) {
  return tarifas; // ← Devuelve TODAS si aún no cargaron las asignaciones
}
```

**Secuencia del bug:**
1. `tarifas` carga → todas las tarifas activas disponibles
2. `sucursalTarifas` aún es `[]` (loading) → `tarifasDisponibles` devuelve TODAS
3. Auto-selección por zona encuentra "ENVIOS GENERAL" (tiene zona_destino que cubre casi toda Argentina)
4. Se setea `tarifa_id` en el formulario
5. `sucursalTarifas` finalmente carga → `tarifasDisponibles` se recalcula sin "ENVIOS GENERAL"
6. Pero `formData.tarifa_id` ya está seteado y no se limpia

## Solución

### Cambio en `src/pages/NewShipment.tsx`

**1. Considerar el estado de carga de `sucursalTarifas`** en el memo `tarifasDisponibles`:

Agregar `isLoading` del query de `sucursalTarifas`. Si está cargando, devolver lista vacía para evitar que la auto-selección actúe prematuramente.

```typescript
const { data: sucursalTarifas = [], isLoading: loadingSucursalTarifas } = useQuery({ ... });
```

En `tarifasDisponibles`:
```typescript
const tarifasDisponibles = useMemo(() => {
  if (!tarifas) return [];
  // Esperar a que carguen las asignaciones antes de decidir
  if (loadingSucursalTarifas) return [];
  // ... resto igual
}, [tarifas, sucursalTarifas, ..., loadingSucursalTarifas]);
```

**2. Limpiar tarifa si queda fuera del filtro** — agregar un `useEffect` que resetee `tarifa_id` si la tarifa seleccionada ya no está en `tarifasDisponibles`:

```typescript
useEffect(() => {
  if (formData.tarifa_id && tarifasDisponibles.length > 0) {
    if (!tarifasDisponibles.some(t => t.id === formData.tarifa_id)) {
      setFormData(prev => ({ ...prev, tarifa_id: '' }));
      setTarifaFueAutoDetectada(false);
    }
  }
}, [tarifasDisponibles, formData.tarifa_id]);
```

Esto cubre tanto la race condition como cualquier caso donde se cambie la sucursal origen después de seleccionar una tarifa.

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Extraer `isLoading` de sucursalTarifas, bloquear `tarifasDisponibles` mientras carga, agregar cleanup de tarifa inválida |

