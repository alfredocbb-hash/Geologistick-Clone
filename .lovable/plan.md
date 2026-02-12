

# Plan: Recuperar pedidos Flex entregados faltantes de MercadoLibre

## Problema
Beraexpress perdio registros de envios durante cambios recientes. Necesitan recuperar todos los pedidos Flex entregados de todos sus sellers (15 sellers activos) desde el 06/02/2026 12:01hs hasta el 12/02/2026.

## Datos actuales
- **Sellers activos**: 15 (todos con tokens validos)
- **Envios ML existentes en el rango**: 114 (64 entregados)
- **Tenant**: Beraexpress (`94a9ea85-43c5-49ac-9bfa-86843072c2ce`)

## Solucion

Crear una edge function nueva `recover-ml-shipments` que:

1. Recorra los 15 sellers de Beraexpress
2. Para cada seller, consulte la API de ML buscando ordenes con `shipping.status=delivered` en el rango de fechas
3. Verifique cuales `ml_shipment_id` ya existen en la tabla `envios`
4. Inserte los faltantes (envio + ecommerce_order + historial + cargo en cuenta corriente)
5. Solo procese envios de tipo `self_service` (Flex)

## Detalle tecnico

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/recover-ml-shipments/index.ts` | Nueva edge function de recuperacion |

### Logica de la funcion

```text
Para cada seller:
  1. Obtener access_token valido (refresh si necesario)
  2. Buscar ordenes en ML API:
     - GET /orders/search?seller={store_id}&shipping.status=delivered
     - Filtrar por date_created desde 2026-02-06T15:01:00Z (12:01 ARG = 15:01 UTC)
     - Paginar con offset (limit=50, max 10 paginas)
  3. Para cada orden con shipment:
     - Verificar si ml_shipment_id ya existe en envios
     - Si existe: skip
     - Si no existe: obtener detalle del shipment de ML API
     - Verificar logistic_type === 'self_service' (Flex)
     - Crear ecommerce_order
     - Crear envio con estado 'entregado' y estado_ml 'entregado'
     - Crear historial
     - Registrar cargo en cuenta corriente si aplica
  4. Rate limiting: 200ms entre calls a ML API
```

### Diferencias con mercadolibre-sync existente

- No requiere autenticacion de usuario (usa service_role internamente)
- Busca en un rango de fechas amplio (6 dias) en vez de solo ultimos 3 dias
- Solo busca status `delivered` 
- Crea envios con estado `entregado` directamente
- NO filtra por fecha de entrega estimada = hoy
- Procesa TODOS los sellers del tenant en una sola ejecucion
- Reutiliza `getValidAccessToken` del sync existente

### Deduplicacion

La deduplicacion se hace con un query batch a `envios` filtrando por `ml_shipment_id IN (...)` antes de insertar, exactamente como hace el sync existente.

### Ejecucion

La funcion se ejecutara manualmente una sola vez via curl desde la consola. No necesita UI. Despues de confirmar que funciono, se puede eliminar.

## Resultado esperado

- Todos los envios Flex entregados de ML entre 06/02 12:01 y 12/02 se insertaran en el sistema
- Los que ya existen no se duplicaran
- Las cuentas corrientes de los sellers se actualizaran con los cargos faltantes
- La liquidacion podra completarse con todos los registros
