

# Filtro de rango de fechas (Desde - Hasta)

## Respuesta sobre la sincronizacion ML
Si, correcto. La funcion `mercadolibre-sync` ahora solo trae pedidos cuya fecha estimada de entrega es el dia de hoy (zona horaria Argentina UTC-3). Los pedidos de dias anteriores o futuros se omiten.

## Cambios a implementar

### 1. Pagina de Envios (`src/pages/Shipments.tsx`)
- Reemplazar el filtro de fecha unica (`dateFilter: Date`) por un rango con dos fechas: `dateFrom` y `dateTo`, ambas inicializadas en la fecha de hoy.
- Mostrar dos selectores de fecha lado a lado: "Desde" y "Hasta".
- Actualizar la query de Supabase para usar `gte(created_at, startOfDay(dateFrom))` y `lte(created_at, endOfDay(dateTo))`.
- Actualizar el `queryKey` para incluir ambas fechas.

### 2. Pagina de Pedidos E-commerce (`src/pages/ecommerce/Orders.tsx`)
- Mismo cambio: reemplazar `dateFilter: Date` por `dateFrom` y `dateTo`.
- Dos selectores de fecha: "Desde" y "Hasta".
- Actualizar la query para filtrar con el rango completo.
- Actualizar el `queryKey`.

### Detalles tecnicos

**Estado actual en ambas paginas:**
```typescript
const [dateFilter, setDateFilter] = useState<Date>(new Date());
// Query usa: startOfDay(dateFilter) ... endOfDay(dateFilter)
```

**Estado nuevo:**
```typescript
const [dateFrom, setDateFrom] = useState<Date>(new Date());
const [dateTo, setDateTo] = useState<Date>(new Date());
// Query usa: startOfDay(dateFrom) ... endOfDay(dateTo)
```

**UI de filtros:** Dos botones de calendario compactos con etiquetas "Desde" y "Hasta", manteniendo el estilo actual con `Popover` + `Calendar`.

No se requieren cambios en la base de datos ni en Edge Functions.

