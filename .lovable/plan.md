
Objetivo: destrabar definitivamente el registro de envíos ML para choferes cuando el seller original no opera Flex y debe entrar por la cuenta logística FULLIMPORT.

Diagnóstico confirmado:
- La función `register-ml-shipment` no está recibiendo llamadas: no hay logs recientes y tampoco aparece tráfico asociado.
- En `supabase/functions/register-ml-shipment/index.ts` los headers CORS están incompletos. Falta permitir los headers que envía el cliente web (`x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, `x-supabase-client-runtime-version`), así que el preflight puede bloquear la llamada antes de llegar a la función.
- Además, en la base existe:
  - FULLIMPORT activa como cuenta logística
  - KINGDOM VINTAGE con `store_id = 222370892` pero `activo = false`
- Hoy tanto el frontend como la función siguen pudiendo resolver primero ese seller inactivo, en vez de forzar fallback a FULLIMPORT.

Qué voy a corregir:
1. Desbloquear la llamada a la función
- Actualizar `register-ml-shipment` para usar los headers CORS completos en:
  - OPTIONS
  - respuestas exitosas
  - respuestas de error
- Esto debería hacer que el botón “Registrar Envío” realmente llegue al backend.

2. Ignorar sellers inactivos en este flujo
- En `register-ml-shipment`, la búsqueda directa por `sender_id` debe incluir `activo = true`.
- Si el seller existe pero está inactivo, no debe usarse su token; se debe pasar directo al fallback por cuenta logística del tenant.
- En `MLRegisterDialog.tsx`, el lookup informativo también debe ignorar sellers inactivos para no mostrar una resolución engañosa.

3. Mantener la cuenta logística como fallback real
- Si no hay seller activo coincidente, la función debe usar FULLIMPORT del tenant del chofer.
- Si falla, debe devolver un error concreto del backend, no un falso negativo de UI.

4. Mejorar trazabilidad para este caso
- Agregar logs claros en la función para distinguir:
  - seller directo activo encontrado
  - seller directo ignorado por inactivo
  - fallback a cuenta logística
  - error de ML / token / shipment no Flex

Archivos a tocar:
- `supabase/functions/register-ml-shipment/index.ts`
- `src/components/scan/MLRegisterDialog.tsx`

Validación esperada:
1. Escaneo con chofer Dar Logística en modo normal:
- abre el diálogo
- “Registrar Envío” sí dispara la función
- si el seller del QR está inactivo, usa FULLIMPORT

2. Escaneo en modo Flex:
- mismo comportamiento
- al registrar exitosamente, agrega el envío al flujo Flex

3. Caso de error real:
- si ML rechaza el shipment o no es `self_service`, se muestra ese error exacto

Detalles técnicos:
```text
QR -> MLRegisterDialog -> register-ml-shipment
                       -> seller activo por sender_id? sí => usar seller
                       -> no / inactivo => usar FULLIMPORT del tenant
```

Causa más probable del “sigue igual”:
- la llamada está siendo frenada antes de entrar a la función por CORS
- y, una vez destrabada, todavía hay que evitar que un seller inactivo gane prioridad sobre la cuenta logística
