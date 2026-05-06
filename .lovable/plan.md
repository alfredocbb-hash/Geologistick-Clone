## Edición administrativa de detalles del envío

En el diálogo `Detalles del Envío` (`src/components/shipments/ShipmentDetailsDialog.tsx`), agregar a usuarios con rol admin/super_admin un botón "Editar" en la tarjeta de **INFORMACIÓN DE PAGO** y otro junto al bloque de **NOTAS**.

### Cambios

**1. `src/components/shipments/ShipmentDetailsDialog.tsx`**

- Importar `usePermissions` (o leer `profile.rol` desde `useAuth`) para detectar admin/super_admin.
- Importar `Input`, `Textarea`, `Switch`/`Select`, `Label`.
- Estado local `editFinanciero` y `editNotas` (booleans), con campos controlados:
  - `precio_total` (number)
  - `tipo_pago` (`contado | destino | cuenta_corriente`)
  - `pago_contra_entrega` (boolean)
  - `monto_cobrar` / `monto_cod` (number — usar columna `monto_cobrar` si existe, si no, `valor_declarado` o agregar campo a notas)
  - `notas` (textarea)
- Botón "Editar" → muestra los campos en modo edición con "Guardar"/"Cancelar".
- Mutación con `supabase.from('envios').update({...}).eq('id', envio.id)` que invalida la query del envío y `['envios']`.

**2. Verificación de columnas**

Antes de codificar, confirmar columnas reales (`tipo_pago`, `pago_contra_entrega`, `monto_cobrar`, `notas`, `precio_total`) consultando `envios`. Si no existe `monto_cobrar`, usar el existente `valor_declarado` para el monto a cobrar contra entrega y aclararlo en el label. Si no existe alguno necesario, crear migración para agregar `monto_cobrar numeric` en `envios`.

**3. Seguridad**

- Botón visible solo si `profile?.rol in ('admin','super_admin')`.
- RLS ya cubre updates de envíos por tenant (mantener).
- Bloqueo: si el envío está `entregado`/`cancelado` y el usuario NO es `super_admin`, deshabilitar edición (regla del proyecto: estados finales bloquean modificaciones, sólo super_admin bypass).

### Archivos
- `src/components/shipments/ShipmentDetailsDialog.tsx` (único)
- (opcional) migración para añadir `monto_cobrar` a `envios` si no existe.
