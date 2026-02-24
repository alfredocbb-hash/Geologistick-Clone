
# Plan de correcciones: 4 mejoras solicitadas

## 1. PDF de liquidacion: tarifa $0 para cancelados + columna Localidad en vez de Estado

### Problema actual
- En el PDF de liquidacion de sellers, los envios cancelados muestran el precio original en vez de $0
- La tabla del PDF muestra la columna "Estado" pero el usuario necesita "Localidad" (ciudad de entrega)

### Cambios en `src/lib/generateSettlementPDF.ts`
- En la funcion `downloadSellerSettlementPDF` (linea 564-570): si `e.estado === 'cancelado'`, setear `precio: 0` en lugar de `e.precio_total`
- Agregar `ciudad_entrega` al SELECT de la query de envios (linea 560)
- Mapear el campo `ciudad_entrega` en vez de `estado` en el array de shipments (reemplazar `estado` por un nuevo campo `localidad`)
- En la funcion `generateSettlementPDF`:
  - Cambiar encabezado de tabla de "Estado" a "Localidad" (linea 305)
  - Cambiar el dato renderizado en la celda de `row.estado` a `row.localidad` (linea 344)

### Cambios en la interfaz `SettlementPDFData`
- Renombrar el campo `estado` a `localidad` en el tipo `shipments` (linea 43)

---

## 2. Estados ML: agregar "Reprogramado" a la tabla de mapeo

### Problema actual
La tabla `ml_status_mapping` no tiene entradas para substatuses de reprogramacion del comprador ni para "segunda visita". Solo existe `rescheduled_by_meli`. Faltan:
- `shipped` + `rescheduled` (reprogramado generico)
- `not_delivered` + `returning_to_hub` (volviendo al hub para segunda visita)
- `shipped` + `second_visit` (segunda visita en camino)

### Cambios
- Migracion SQL para insertar nuevos mappings:
  - `shipped` / `rescheduled` -> `en_transito` (Reprogramado)
  - `shipped` / `second_visit` -> `en_reparto` (Segunda visita)
  - `not_delivered` / `returning_to_hub` -> `en_transito` (Volviendo al hub)
  - `not_delivered` / `receiver_absent` ya existe, se mantiene

---

## 3. Boton "Sincronizar ML" en Gestion de Envios

### Problema actual
El boton de sincronizacion solo existe en E-commerce > Sellers. El usuario necesita un boton en la pagina de Gestion de Envios para que los operadores puedan forzar la sincronizacion de estados de ML cuando no se actualizan automaticamente.

### Cambios en `src/pages/Shipments.tsx`
- Agregar una query para verificar si el tenant tiene sellers de e-commerce con `plataforma = 'mercadolibre'`
- Si tiene al menos un seller ML, mostrar un boton "Sincronizar ML" junto al boton de refrescar existente
- El boton invocara `mercadolibre-sync` para cada seller ML del tenant
- Mostrar un toast con el resultado de la sincronizacion
- Agregar estado de `isSyncing` para deshabilitar el boton durante la operacion

---

## 4. Clientes duplicados en Terciarizados (Planificador)

### Problema actual
La query `all_clients` en `ThirdPartyShipmentsTab.tsx` (linea 209-218) hace `SELECT * FROM clientes ORDER BY nombre` sin filtrar por `tenant_id`. Esto trae clientes de otros tenants y ademas la tabla tiene registros duplicados reales (mismo nombre+telefono creados multiples veces).

### Cambios en `src/components/routes/ThirdPartyShipmentsTab.tsx`
- Filtrar la query de clientes por `tenant_id` del perfil del usuario actual
- En `ContactAutocomplete.tsx`: agregar deduplicacion por telefono en el `filteredClients` (usando un Set para evitar mostrar el mismo cliente dos veces basandose en telefono + nombre)

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/lib/generateSettlementPDF.ts` | Tarifa $0 para cancelados, columna Localidad en vez de Estado |
| `src/pages/Shipments.tsx` | Boton Sincronizar ML condicional |
| `src/components/routes/ThirdPartyShipmentsTab.tsx` | Filtrar clientes por tenant_id |
| `src/components/shipments/ContactAutocomplete.tsx` | Deduplicar clientes por telefono+nombre |
| Migracion SQL | Nuevos mappings de estados ML (reprogramado, segunda visita) |
