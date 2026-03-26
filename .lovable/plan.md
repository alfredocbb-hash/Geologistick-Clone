
## Plan: hacer que el registro con cuenta logística no dependa del frontend

### Lo que confirmé
- La cuenta logística **sí existe** en el mismo tenant del chofer Dar Logística:
  - chofer: `f23d3df2-9926-46de-ac09-b72c3c66babf`
  - tenant: `94a9ea85-43c5-49ac-9bfa-86843072c2ce`
  - seller logístico activo: **FULLIMPORT**
- No hay logs recientes de `register-ml-shipment`, así que el backend **ni siquiera está siendo llamado**.
- El problema actual está en la UI: el botón queda bloqueado porque el diálogo depende de detectar la cuenta logística desde el cliente antes de permitir registrar.

### Causa probable
El flujo hoy hace esto:
1. escanea QR
2. abre `MLRegisterDialog`
3. intenta descubrir seller/cuenta logística desde el frontend
4. si no lo logra, deshabilita “Registrar Envío”

Eso explica exactamente tu captura: el sistema muestra “no registrado” aunque FULLIMPORT sí esté configurado.

### Cambio recomendado
Mover la decisión real al backend y dejar el frontend como un disparador simple.

### Implementación
**1. `src/components/scan/MLRegisterDialog.tsx`**
- Dejar de bloquear el botón por `seller` / `logisticsAccount`
- Permitir siempre intentar el registro cuando haya `mlShipmentId`
- Cambiar el mensaje de advertencia:
  - si hay seller directo, mostrarlo
  - si no, mostrar “se intentará registrar con cuenta logística del tenant”
- Si falla, mostrar el error real devuelto por la función

**2. `supabase/functions/register-ml-shipment/index.ts`**
- Resolver todo del lado servidor:
  - si existe seller directo por `sender_id`, usarlo
  - si no existe, buscar la cuenta logística activa del tenant del usuario
- Quitar dependencias innecesarias del frontend para decidir si se puede registrar
- Mantener validación de token y de `logistic_type = self_service`
- Mejorar logs para distinguir:
  - seller directo encontrado
  - fallback a cuenta logística
  - cuenta logística no encontrada
  - token inválido / shipment no Flex

**3. `src/components/mobile/FlexScanScreen.tsx` y `src/components/mobile/MobileScanTab.tsx`**
- Mantener apertura del diálogo al escanear un ML no registrado
- Asegurar que el cierre/apertura del scanner no limpie el intento antes de registrar
- No depender de estados visuales de seller para habilitar el flujo

### Resultado esperado
Con Dar Logística:
- escanea QR ML
- se abre el diálogo
- el botón **Registrar Envío** queda habilitado
- al tocarlo, la función intenta:
  - seller directo si existe
  - si no, FULLIMPORT como cuenta logística
- si ML devuelve datos válidos del shipment Flex, el envío se crea correctamente

### Validación
Voy a considerar correcto cuando se cumplan estos casos:
1. **Modo normal**: QR de seller no registrado abre diálogo y permite registrar
2. **Modo Flex**: QR de seller no registrado abre diálogo y permite registrar
3. **Caso exitoso**: se crea el envío y aparece tracking/destino
4. **Caso fallido real**: si ML rechaza el shipment, se muestra error concreto y no un falso “no hay cuenta logística”

### Archivos a tocar
- `src/components/scan/MLRegisterDialog.tsx`
- `src/components/mobile/FlexScanScreen.tsx`
- `src/components/mobile/MobileScanTab.tsx`
- `supabase/functions/register-ml-shipment/index.ts`

### Nota técnica
La evidencia actual indica que **la configuración de datos está bien**; lo que falla es la lógica de habilitación en pantalla. Por eso el ajuste más robusto es que el frontend no “decida” si existe cuenta logística: solo debe intentar registrar y dejar esa resolución al backend.
