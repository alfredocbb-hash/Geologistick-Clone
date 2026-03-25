

## Plan: Seller genérico para registrar envíos Flex sin autorización individual

### Concepto
Agregar un campo `es_cuenta_logistica` (boolean) a la tabla `ecommerce_sellers`. Cuando se escanea un QR Flex cuyo `sender_id` no tiene seller registrado, el sistema busca un seller marcado como "cuenta logística" del mismo tenant y usa sus credenciales OAuth para consultar la API de ML y obtener los datos completos del envío (dirección, destinatario, etc.).

### Cambios

**1. Migración SQL**
- Agregar columna `es_cuenta_logistica BOOLEAN DEFAULT false` a `ecommerce_sellers`

**2. Edge Function `register-ml-shipment/index.ts`**
- Cuando no se encuentra seller por `store_id`: buscar un seller con `es_cuenta_logistica = true` del mismo tenant (obtenido vía `user_id`)
- Usar las credenciales OAuth de ese seller genérico para llamar a la API de ML
- Crear el envío normalmente con los datos obtenidos, pero sin vincular a un seller específico (sin orden ecommerce ni cargo en cuenta corriente)

**3. Frontend `MLRegisterDialog.tsx`**
- Cuando no se encuentra el seller directo: en lugar de bloquear, mostrar "Se usará la cuenta logística para obtener datos" y habilitar el botón "Registrar"
- Si tampoco hay cuenta logística configurada, mostrar mensaje indicando que se necesita configurar una

**4. Página de Sellers (`src/pages/ecommerce/Sellers.tsx`)**
- Agregar un toggle/switch en la tabla o en el diálogo de edición para marcar un seller como "Cuenta Logística"
- Mostrar un badge visual cuando un seller es cuenta logística

### Flujo resultante
1. Escaneo QR Flex → `sender_id` no encontrado en sellers
2. Sistema busca seller con `es_cuenta_logistica = true` en el tenant
3. Usa sus credenciales para consultar ML API → obtiene dirección, destinatario, etc.
4. Crea envío con datos completos, sin vincular a seller/orden ecommerce
5. Paquete queda listo para planificación de ruta

### Archivos a modificar
- Migración SQL (nueva columna)
- `supabase/functions/register-ml-shipment/index.ts`
- `src/components/scan/MLRegisterDialog.tsx`
- `src/pages/ecommerce/Sellers.tsx` (toggle cuenta logística)
- `src/components/ecommerce/EditSellerDialog.tsx` (campo editable)

