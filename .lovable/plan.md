
# Módulo Finanzas

Módulo nuevo, más amplio, que agrupa carga manual de liquidaciones a terceros (terciarizados/proveedores/socios) con vinculación a factura emitida e impacto en caja. Habilitable por tenant vía feature flags gestionadas por super_admin.

## 1) Base de datos

### 1.1 Feature flags por tenant (nueva tabla)
`tenant_features`
- `tenant_id` (FK tenants, unique junto con `feature_key`)
- `feature_key` TEXT (p.ej. `finanzas`)
- `enabled` BOOLEAN
- `enabled_by` UUID, `enabled_at` timestamptz
- RLS:
  - super_admin: full access
  - authenticated: SELECT solo su tenant
- GRANT SELECT a authenticated, ALL a service_role
- Helper SQL: `public.tenant_has_feature(_tenant uuid, _key text) returns boolean` (security definer)

### 1.2 Liquidaciones manuales (nueva tabla)
`liquidaciones_manuales`
- `numero` TEXT (visible: número de caja / liquidación que ingresa el usuario)
- `tipo` TEXT check ('terciarizado','proveedor','partner','otro')
- `empresa_id` UUID nullable (FK empresas_terciarizadas cuando aplica)
- `descripcion` TEXT
- `periodo_desde` DATE, `periodo_hasta` DATE
- `monto` NUMERIC (positivo = a pagar, negativo = a cobrar)
- `moneda` TEXT default 'ARS'
- `estado` TEXT check ('pendiente','pagada','cobrada','anulada') default 'pendiente'
- `factura_id` UUID nullable (FK `facturas` — factura de venta emitida)
- `fecha_movimiento` timestamptz (cuándo se pagó/cobró)
- `metodo_pago` payment_method nullable
- `referencia_pago` TEXT
- `sesion_caja_id` UUID nullable (FK sesiones_caja — movimiento generado)
- `movimiento_caja_id` UUID nullable (FK movimientos_caja)
- `notas` TEXT
- `tenant_id`, `created_by`, `created_at`, `updated_at`
- RLS:
  - SELECT: usuarios del tenant
  - INSERT/UPDATE/DELETE: admin del tenant + super_admin
  - Guard adicional: sólo si `tenant_has_feature(tenant_id, 'finanzas')`
- Trigger `set_tenant_id`, trigger `update_updated_at`

### 1.3 Función RPC `registrar_movimiento_liquidacion_manual(p_id, p_metodo, p_referencia, p_fecha)`
- Valida permisos (admin) y feature habilitada
- Determina signo: `monto > 0` → egreso; `monto < 0` → ingreso (usa ABS)
- Busca `sesiones_caja` abierta de la sucursal del usuario
- Inserta `movimientos_caja` (tipo ingreso/egreso, concepto = "Liq. manual #<numero> — <empresa/desc>")
- Actualiza `liquidaciones_manuales`: estado (`pagada` o `cobrada`), `sesion_caja_id`, `movimiento_caja_id`, `fecha_movimiento`, `metodo_pago`, `referencia_pago`
- Devuelve jsonb con resultado

## 2) Backend / integraciones existentes
No requiere Edge Functions nuevas. Reutiliza tablas `facturas`, `sesiones_caja`, `movimientos_caja`, `empresas_terciarizadas`.

## 3) Frontend

### 3.1 Habilitación (super_admin)
- Nueva sección en `Tenants.tsx` (detalle del tenant) o en `SystemSettings.tsx`: "Módulos opcionales" con toggle `finanzas`
- Hook `useTenantFeature('finanzas')` que consulta `tenant_features` y cachea

### 3.2 Ruta y navegación
- Ruta `/finanzas` protegida por `useTenantFeature('finanzas')` + rol admin
- Ítem de menú "Finanzas" (icono Wallet) visible sólo si feature habilitada
- Página `src/pages/Finanzas.tsx` con tabs:
  1. **Liquidaciones manuales** (foco de este pedido)
  2. **Resumen** (reutiliza `FacturacionResumen` filtrado)
  3. Placeholder para futuras subsecciones

### 3.3 Tab "Liquidaciones manuales"
- Filtros: rango de fechas (desde/hasta sobre `periodo_desde`/`periodo_hasta`), tipo, empresa, estado, búsqueda por número
- KPIs: total a pagar (suma positivos pendientes), total a cobrar (suma abs negativos pendientes), neto del período
- Tabla: Nº, tipo, empresa/descr, período, monto (con badge "A pagar" verde / "A cobrar" azul según signo), estado, factura vinculada, acciones
- Acciones fila: Ver detalle · Registrar pago/cobro · Editar · Anular

### 3.4 Dialogs
- `LiquidacionManualFormDialog`:
  - Campos: número, tipo, empresa (autocomplete de `empresas_terciarizadas` si tipo=terciarizado), descripción, período desde/hasta, monto (con indicador visual del signo → "A pagar/A cobrar"), factura emitida (autocomplete sobre `facturas` estado `emitida` del tenant), notas
  - Validación zod
- `RegistrarMovimientoDialog`:
  - Muestra monto y signo, pide método de pago, referencia y fecha
  - Llama a la RPC; si no hay caja abierta, muestra error indicando abrir sesión de caja
- `LiquidacionManualDetailDialog`:
  - Resumen, link a factura asociada (abre `PrintInvoice`), link al movimiento de caja generado

### 3.5 Reutilización en Facturación
- En `Facturacion.tsx` tab "Emitidas", al seleccionar una factura, mostrar si está vinculada a una liquidación manual

## 4) Consideraciones
- Todo en pesos por defecto; dejar `moneda` para futuro sin UI aún
- Anular: sólo permitido si aún no se generó movimiento de caja; si ya se generó, requiere revertir manualmente (mensaje claro)
- No modificar el módulo `ThirdPartySettlements` existente (queda para liquidaciones automáticas por envíos)
- Textos en español AR

## Detalles técnicos

**Archivos nuevos:**
- Migración: `tenant_features`, `liquidaciones_manuales`, `tenant_has_feature`, `registrar_movimiento_liquidacion_manual`, RLS, GRANTs, triggers
- `src/hooks/useTenantFeature.ts`
- `src/pages/Finanzas.tsx`
- `src/components/finanzas/LiquidacionesManualesTab.tsx`
- `src/components/finanzas/LiquidacionManualFormDialog.tsx`
- `src/components/finanzas/RegistrarMovimientoDialog.tsx`
- `src/components/finanzas/LiquidacionManualDetailDialog.tsx`
- `src/components/tenants/TenantFeaturesManager.tsx` (toggle super_admin)

**Archivos modificados:**
- `src/App.tsx` → ruta `/finanzas`
- `src/components/layout/` (sidebar) → ítem condicional
- `src/pages/Tenants.tsx` (o `SystemSettings.tsx`) → integrar `TenantFeaturesManager`
- `src/integrations/supabase/types.ts` (regenerado tras migración)

**Flujo signo de monto:**
```text
monto > 0  → "A PAGAR"  → estado pagada  → egreso en caja
monto < 0  → "A COBRAR" → estado cobrada → ingreso en caja (ABS)
monto = 0  → no permitido
```
