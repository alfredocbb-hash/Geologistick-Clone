
# Fix: Paginacion completa en sincronizacion MercadoLibre + Filtro por fecha en Pedidos

## Problema

Hay dos problemas relacionados:

1. **Sincronizacion incompleta**: La funcion `mercadolibre-sync` solo trae los primeros 50 resultados por estado (sin paginacion con `offset`). Sellers como Kingdom con mas de 50 envios activos pierden pedidos.

2. **Sin filtro por fecha de entrega**: La pagina de Pedidos e-Commerce no tiene filtro por fecha. Necesitas ver los pedidos con entrega para HOY (vendidos ayer despues del corte de las 12hs + vendidos hoy antes del corte).

## Cambios propuestos

### 1. Paginacion completa en mercadolibre-sync

**Archivo: `supabase/functions/mercadolibre-sync/index.ts`**

Reemplazar el fetch simple (lineas 105-127) por un loop paginado:

- Para cada estado (`ready_to_ship`, `shipped`), iterar con `offset` de 50 en 50.
- Continuar hasta que los resultados sean menos de 50 (ultima pagina).
- Delay de 200ms entre paginas para respetar rate limits de ML.
- Maximo de seguridad: 500 ordenes (10 paginas por estado).
- Mantener la deduplicacion existente con `seenIds`.

### 2. Filtro por fecha en la pagina de Pedidos

**Archivo: `src/pages/ecommerce/Orders.tsx`**

- Agregar un filtro de fecha (DatePicker o input date) junto a los filtros existentes de estado y fulfillment.
- Por defecto mostrar la fecha de HOY.
- Filtrar las ordenes por `created_at` (fecha de creacion del pedido en la plataforma).
- Cambiar la query de Supabase para filtrar por rango de fecha del lado del servidor (mas eficiente que filtrar 200 resultados en cliente).
- Eliminar el `limit(200)` fijo y en su lugar usar el filtro de fecha como delimitador principal.

### 3. Filtro por Seller

**Archivo: `src/pages/ecommerce/Orders.tsx`**

- Agregar un Select para filtrar por seller especifico (ej: "Kingdom"), ya que cuando hay multiples sellers es importante poder aislar los pedidos de cada uno.

## Seccion tecnica

| Archivo | Cambio |
|---|---|
| `supabase/functions/mercadolibre-sync/index.ts` | Reemplazar fetch simple por loop paginado con offset, delay 200ms, max 500 ordenes |
| `src/pages/ecommerce/Orders.tsx` | Agregar filtro de fecha (default HOY) y filtro por seller; query server-side por rango de fecha |

### Detalle de la paginacion ML

```text
Para cada status en [ready_to_ship, shipped]:
  offset = 0
  loop:
    GET /orders/search?seller={id}&shipping.status={status}&limit=50&offset={offset}
    agregar resultados (deduplicados)
    si resultados < 50 -> break
    si offset >= 450 -> break (max seguridad)
    offset += 50
    await delay(200ms)
```

### Detalle del filtro de fecha

La query pasara de:
```
.order('created_at', { ascending: false }).limit(200)
```
A:
```
.gte('created_at', fechaInicio)
.lt('created_at', fechaFin)
.order('created_at', { ascending: false })
```

Donde `fechaInicio` y `fechaFin` representan el dia seleccionado (00:00 a 23:59).
