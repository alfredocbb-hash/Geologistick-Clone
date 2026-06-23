# Asignación retroactiva de envíos a chofer

Permitir que un admin asigne en bloque envíos "sin chofer" a un chofer (ej. Ariel Kersul) filtrando por rango de fechas y sucursal, para que entren en su próxima liquidación con la comisión recalculada según sus reglas vigentes.

## Flujo de usuario

1. En la página de **Choferes** (o en **Liquidaciones de Chofer**), agregar un botón **"Asignar envíos retroactivos"** en la fila/detalle de cada chofer (visible solo para `admin` y `super_admin`).
2. Se abre un diálogo con:
   - Chofer (pre-seleccionado).
   - Sucursal (default: sucursal del chofer; editable).
   - Rango de fechas (desde / hasta) sobre `created_at` del envío.
   - Filtro opcional por estado (default: `entregado`, `en_reparto`, `en_sucursal`, `en_transito`, `recogido`).
   - Checkbox "Solo envíos sin chofer asignado" (default ON).
3. Tabla con los envíos coincidentes (tracking, fecha, destinatario, ciudad, estado, precio). Selección múltiple con "seleccionar todos".
4. Botón **"Asignar a [Chofer]"** confirma y ejecuta.

## Reglas de negocio

- Solo se asignan envíos del mismo `tenant_id` que el chofer.
- Solo envíos con `chofer_id IS NULL` (si el checkbox está activo).
- No se modifica el `estado` del envío — se respeta el actual (incluyendo `entregado`).
- Se setean: `chofer_id`, `chofer_ultima_milla_id`, `fecha_asignacion_ultima_milla = now()`.
- **Comisión:** se recalcula usando las reglas vigentes de Ariel: prioridad `chofer_comisiones_zona` activa por ciudad/provincia/CP de entrega → fallback a tarifa de zona. Se inserta/actualiza fila en `comisiones` con `estado = 'pendiente'` para que entre en la próxima liquidación.
- Se registra entrada en `envio_historial` con nota "Chofer asignado retroactivamente por [admin] - motivo: liquidación física".
- Envíos ya incluidos en una liquidación de chofer activa (`liquidacion_id IS NOT NULL` en `comisiones`) se excluyen del listado para evitar doble cobro.

## Detalles técnicos

- **Migración** — función RPC `assign_envios_to_chofer_retroactivo(p_chofer_id uuid, p_envio_ids uuid[], p_motivo text)`:
  - `SECURITY DEFINER`, valida `is_admin(auth.uid())` y mismo tenant.
  - Itera envíos: UPDATE de chofer + INSERT en `envio_historial` + UPSERT en `comisiones` calculando monto vía lógica de `chofer_comisiones_zona` → fallback tarifa de zona (replica de la lógica existente en cálculo de comisiones).
  - Devuelve `jsonb` con `success`, `asignados`, `omitidos`, `errores`.
- **Frontend** — nuevo componente `src/components/drivers/AssignShipmentsRetroactiveDialog.tsx`:
  - Query a `envios` con filtros (rango, sucursal origen/entrega, estado, `chofer_id IS NULL`, excluyendo los ya liquidados).
  - Tabla con selección múltiple (shadcn `Checkbox` + `Table`).
  - Llama al RPC y muestra toast con resultado; invalida queries de `useReportsData` y liquidaciones.
- **Punto de entrada** — botón en `src/pages/Drivers.tsx` (acción en la fila) y/o en `src/pages/DriverSettlements.tsx` (header del detalle del chofer).

## Auditoría

Cada asignación queda trazada en `envio_historial` con `created_by = auth.uid()` y nota explícita, y la comisión queda con `created_at = now()` para que sea identificable en reportes.
