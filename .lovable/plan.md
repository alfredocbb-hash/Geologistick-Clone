

## Plan: Registro de colectas + Flujo de cambio post-entrega + Fix Google Maps

### Parte 1: Tabla de colectas y registro

**Migración SQL** — Crear tabla `colectas` + columnas de cambio en `envios`:
```sql
CREATE TABLE public.colectas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chofer_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  cantidad_envios integer NOT NULL DEFAULT 0,
  envio_ids uuid[] NOT NULL DEFAULT '{}',
  source text DEFAULT 'scan',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.colectas ENABLE ROW LEVEL SECURITY;
-- RLS: chofer ve sus propias, admin ve todas del tenant

ALTER TABLE public.envios
  ADD COLUMN es_cambio boolean DEFAULT false,
  ADD COLUMN envio_cambio_id uuid REFERENCES envios(id);
```

**`src/hooks/useCollectPackages.ts`** — En `confirmCollection()`, después del update exitoso, insertar un registro en `colectas`.

### Parte 2: Mostrar colectas en APK

**`src/components/mobile/MobileHomeTab.tsx`** — Agregar un card "Colectas hoy" con query a `colectas` filtrando por chofer y fecha de hoy. Muestra cantidad total de paquetes colectados.

**`src/components/mobile/MobileHistoryTab.tsx`** — Agregar una sección/tab "Colectas" que muestre la lista detallada de colectas con fecha, cantidad, source y tracking numbers de los envíos colectados.

### Parte 3: Flujo de cambio post-entrega

**Nuevo `src/components/delivery/ExchangeDialog.tsx`** — Dialog que se muestra después de confirmar entrega exitosamente:
- Pregunta "¿El destinatario devuelve un paquete?"
- Si confirma: crea envío inverso automáticamente
  - **Si ML** (`ml_shipment_id` presente): destino = dirección del seller (via `ecommerce_sellers`)
  - **Si manual**: destino = remitente original (dirección de retiro / sucursal origen)
- Estado: `recogido`, `es_cambio: true`, `envio_cambio_id: envio_original.id`

**`src/components/delivery/DeliveryConfirmation.tsx`** — En `onSuccess`, mostrar el `ExchangeDialog` antes de cerrar.

**`src/components/shipments/ShipmentDetailsDialog.tsx`** — Si el envío tiene `envio_cambio_id` o `es_cambio`, mostrar badge y link al envío vinculado.

### Parte 4: Fix botón Google Maps en Home

**`src/components/mobile/MobileHomeTab.tsx`** (líneas 224-241) — El botón "Navegar con Google Maps" falla porque:
- Para `hoja_ruta`: usa solo `ciudad` de sucursal destino (demasiado genérico)
- Para `ruta_planificada`: usa `direccion_inicio` que puede ser null

**Fix**: Construir la dirección completa incluyendo `nombre + dirección + ciudad` de la sucursal destino para hojas, y para rutas planificadas consultar la primera parada pendiente con su dirección de entrega.

### Archivos a modificar
- **Migración SQL** — Tabla `colectas` + columnas `es_cambio`/`envio_cambio_id`
- `src/hooks/useCollectPackages.ts` — Insertar registro en `colectas`
- `src/components/mobile/MobileHomeTab.tsx` — Card colectas + fix Google Maps
- `src/components/mobile/MobileHistoryTab.tsx` — Sección de colectas con detalle
- **Nuevo** `src/components/delivery/ExchangeDialog.tsx` — Dialog post-entrega
- `src/components/delivery/DeliveryConfirmation.tsx` — Integrar ExchangeDialog
- `src/components/shipments/ShipmentDetailsDialog.tsx` — Badge y link de cambio

