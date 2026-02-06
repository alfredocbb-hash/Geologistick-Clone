

# Sistema de Rendicion de Cobros COD del Chofer

## Resumen

Actualmente, cuando un chofer cobra un envio "pago destino" (COD), el monto cobrado se muestra en la pantalla de confirmacion pero **no se registra** en las tablas de `pagos` ni `movimientos_caja`. Solo existe como dato visual. Este plan implementa un flujo completo de rendicion: desde el registro automatico del cobro, hasta la entrega del dinero en sucursal con impacto en la caja.

## Flujo Propuesto

```text
1. Chofer confirma entrega COD
   -> Se registra automaticamente en tabla "pagos" (estado: "cobrado_chofer")
   -> El chofer acumula cobros pendientes de rendir

2. Chofer ve en la app movil sus cobros pendientes
   -> Tab "Dinero" muestra seccion "Cobros a Rendir" con total acumulado

3. Chofer llega a sucursal y rinde el dinero
   -> Sucursal/Admin abre pantalla de "Recibir Rendicion"
   -> Selecciona el chofer
   -> Ve los cobros COD pendientes de ese chofer
   -> Confirma la recepcion del dinero (metodo: efectivo/transferencia)
   -> Se crea movimiento de caja automaticamente (ingreso)
   -> Los pagos se marcan como "rendido"

```

## Cambios de Base de Datos

### Tabla `pagos` - Nuevos estados

Actualmente la tabla `pagos` usa el enum `payment_status` con valores como `pendiente`, `pagado`. Se necesita agregar un nuevo valor al enum para diferenciar:
- `cobrado_chofer`: el chofer cobro el dinero al destinatario pero aun no lo rindio
- `rendido`: el chofer entrego el dinero en sucursal

### Nueva tabla `rendiciones`

Para mantener trazabilidad de cada acto de rendicion:

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | UUID | PK |
| chofer_id | UUID | Quien rinde |
| recibido_por | UUID | Quien recibe |
| sucursal_id | UUID | Donde se recibe |
| monto_total | numeric | Total rendido |
| cantidad_cobros | int | Cantidad de pagos incluidos |
| metodo_recepcion | payment_method | Como entrego el dinero |
| referencia | text | Referencia de transferencia, etc |
| notas | text | Observaciones |
| sesion_caja_id | UUID | Sesion de caja impactada (nullable) |
| tenant_id | UUID | Aislamiento multi-tenant |
| created_at | timestamptz | Fecha de la rendicion |

### Tabla `pagos` - Nueva columna

- `rendicion_id` (UUID, nullable): vincula cada pago COD con la rendicion en la que fue entregado.

### Politicas RLS

- `rendiciones`: INSERT/SELECT para `admin`, `super_admin`, `operador`, `sucursal` (quienes reciben la rendicion).
- `rendiciones`: SELECT para `chofer` (ver sus propias rendiciones).
- Se actualizaran los permisos de `pagos` si es necesario para que el chofer pueda INSERT al confirmar entregas.

## Cambios en Codigo

### 1. DeliveryConfirmation.tsx - Registro automatico del cobro

Al confirmar una entrega COD, ademas de actualizar el envio, se insertara un registro en `pagos`:
- `envio_id`: el envio entregado
- `monto`: el monto cobrado (`amountCollected`)
- `metodo`: `efectivo` (por defecto en entrega a domicilio)
- `estado`: `cobrado_chofer`
- `created_by`: el chofer
- `tenant_id`: del perfil del chofer

Esto se hara mediante una funcion RPC `register_cod_payment` con SECURITY DEFINER, ya que el chofer puede no tener permisos directos de INSERT en `pagos`.

### 2. MobileEarningsTab.tsx - Mostrar cobros pendientes de rendir

Agregar una seccion nueva "Cobros a Rendir" que muestre:
- Total acumulado de cobros COD con estado `cobrado_chofer`
- Lista de cobros individuales con tracking number y monto
- Indicador visual claro del total que el chofer debe entregar

### 3. Nuevo componente: ReceiveRenditionDialog.tsx

Dialog para que el personal de sucursal/admin reciba la rendicion del chofer:
- Selector de chofer (muestra solo choferes con cobros pendientes)
- Lista de cobros COD pendientes de ese chofer
- Checkbox para seleccionar cuales incluir
- Total a recibir
- Selector de metodo de recepcion (efectivo, transferencia)
- Al confirmar:
  - Crea registro en `rendiciones`
  - Actualiza los `pagos` seleccionados a estado `rendido` y asigna `rendicion_id`
  - Si hay sesion de caja abierta, crea `movimiento_caja` de ingreso
  - Todo via funcion RPC `receive_rendition` con SECURITY DEFINER

### 4. Integracion en la UI de escritorio

La funcionalidad de "Recibir Rendicion" se puede acceder desde:
- Pagina de Pagos (`Payments.tsx`): nueva tab o boton "Recibir Rendicion"
- O desde la pagina de Caja (`Cash.tsx`): boton de accion rapida cuando hay caja abierta

### 5. Funcion RPC `register_cod_payment`

```text
Parametros:
  - p_envio_id: UUID
  - p_monto: numeric
  - p_metodo: payment_method (default 'efectivo')

Logica:
  1. Verificar que el envio existe y esta en estado 'entregado'
  2. Verificar que no existe ya un pago para este envio
  3. Obtener tenant_id del perfil del chofer
  4. INSERT en pagos con estado 'cobrado_chofer'
  5. Retornar el pago creado
```

### 6. Funcion RPC `receive_rendition`

```text
Parametros:
  - p_chofer_id: UUID
  - p_pago_ids: UUID[]
  - p_metodo_recepcion: payment_method
  - p_referencia: text (nullable)
  - p_notas: text (nullable)

Logica:
  1. Validar que todos los pagos pertenecen al chofer y estan en 'cobrado_chofer'
  2. Calcular monto total
  3. Obtener sucursal_id del perfil de quien recibe
  4. INSERT en rendiciones
  5. UPDATE pagos: estado='rendido', rendicion_id=nuevo_id
  6. Buscar sesion de caja abierta en la sucursal
  7. Si existe, INSERT movimiento_caja de tipo 'ingreso'
  8. Retornar {success, rendicion_id, monto_total, caja_impactada}
```

## Archivos a crear/modificar

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | Extender enum payment_status, crear tabla rendiciones, agregar rendicion_id a pagos, crear RPCs |
| `src/components/delivery/DeliveryConfirmation.tsx` | Llamar a `register_cod_payment` al confirmar entrega COD |
| `src/components/mobile/MobileEarningsTab.tsx` | Agregar seccion "Cobros a Rendir" |
| `src/components/renditions/ReceiveRenditionDialog.tsx` | **Nuevo** - Dialog para recibir rendicion |
| `src/pages/Payments.tsx` | Agregar boton/tab para recibir rendiciones |

## Consideraciones

- La rendicion es un proceso de sucursal/admin, no del chofer. El chofer solo ve sus cobros pendientes.
- El movimiento de caja se crea automaticamente si hay caja abierta; si no hay caja abierta se muestra una advertencia pero se permite la rendicion igual (el dinero queda registrado en la rendicion).
- Los cobros COD del chofer aparecen tambien en la liquidacion de comisiones como "Descuentos COD" (funcionalidad existente), pero ahora con trazabilidad completa.
- Se usa SECURITY DEFINER en las RPCs para evitar modificar las politicas RLS existentes de `pagos`.

