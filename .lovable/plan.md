# Plan: Seguridad tokens ML + Filtros de fecha en Facturación

## 1) Proteger tokens de Mercado Libre

**Problema:** hoy `ecommerce_sellers` contiene `access_token`, `refresh_token` y `token_expires_at`, y los admins del tenant pueden leerlos vía las policies de `ecommerce_sellers`.

**Solución:** mover los tokens a una tabla nueva `ecommerce_seller_tokens`, accesible únicamente por `service_role` (las Edge Functions). Ningún admin/usuario podrá leerlos desde el cliente.

Pasos:

1. Crear tabla `public.ecommerce_seller_tokens` con:
   - `seller_id` (FK a `ecommerce_sellers`, PK)
   - `tenant_id`
   - `access_token`, `refresh_token`, `token_expires_at`
   - `created_at`, `updated_at`
2. GRANTs solo a `service_role`. RLS habilitada con policy que niega todo a `authenticated`/`anon` (SELECT/INSERT/UPDATE/DELETE `USING (false)`).
3. Migrar los valores actuales desde `ecommerce_sellers` a la nueva tabla.
4. Eliminar las columnas `access_token`, `refresh_token`, `token_expires_at` de `ecommerce_sellers` (dejamos un flag `has_valid_token boolean` para que la UI pueda mostrar el estado de conexión sin exponer el token).
5. Actualizar todas las Edge Functions que leen/escriben tokens para usar la nueva tabla:
   - `mercadolibre-oauth`
   - `mercadolibre-sync`
   - `mercadolibre-webhook`
   - `mercadolibre-shipment-history`
   - `mercadolibre-update-status`
   - `mercadolibre-label`
   - `recover-ml-shipments`, `recover-ml-timeframes`, `register-ml-shipment` (si aplica)
6. Ajustar cualquier consulta cliente que filtre por `access_token IS NOT NULL` para usar el nuevo flag `has_valid_token`.

Resultado: los tokens dejan de estar accesibles a admins de tenant; solo las funciones edge (service_role) pueden leerlos/refrescarlos.

## 2) Filtros de fecha en Facturación → Emitidas

En `src/pages/Facturacion.tsx`, tab "Emitidas":

- Agregar dos inputs `Desde` y `Hasta` (tipo date) junto al buscador y al filtro "Todas".
- Aplicar el filtro sobre `fecha_emision` dentro del `useMemo` de `filteredEmitidas` (junto con búsqueda y tipo).
- Botón "Limpiar" para resetear ambas fechas.
- Persistir en `useState` local (sin cambios en query; el filtrado se hace en cliente igual que el buscador actual).

## Detalles técnicos

- Migración SQL (una sola) que crea tabla, GRANTs, RLS, policies, copia datos y drop de columnas.
- Trigger `update_updated_at_column` en la nueva tabla.
- Las Edge Functions ya usan `service_role`, así que solo cambia el nombre de la tabla en los `.from(...)`.
- El cambio en el frontend de Facturación es puramente presentacional (no toca lógica de negocio ni queries).
