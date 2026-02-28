
Diagnóstico confirmado: el problema no está en el flujo “sucursal a sucursal” de la pantalla, sino en la configuración de tarifas visibles para la sucursal Rosario dentro del backend.

Resumen de lo que encontré (con datos reales):
1) La lógica de `NewShipment.tsx` sí hace búsqueda bidireccional (origen + destino) para `sucursal_sucursal` y `puerta_sucursal`.
2) Para BlackBox, la tarifa que cubre “Mar del Plata / Rosario” con id `10e24a96-c522-4df1-88ed-0c042050df41` está asignada a Rosario y MDP, pero está inactiva (`activa = false`), por lo que nunca entra al listado de tarifas (el frontend sólo trae tarifas activas).
3) La tarifa activa `71343890-b5e4-4b52-9a7b-3e678d8de661` tiene asignaciones de sucursal con `tenant_id` incorrecto (`a000...`), distinto al tenant BlackBox (`81be...`), así que usuarios de BlackBox no la ven por RLS.
4) Resultado práctico para un usuario de Rosario: en la práctica sólo le queda visible “ENVIOS GENERAL”, que no resuelve correctamente Rosario ↔ Mar del Plata en auto-selección por zona.

Plan de corrección propuesto

Fase 1 — Corrección inmediata de datos (desbloqueo operativo)
- Ajustar datos de `sucursal_tarifas` para que las asignaciones de la tarifa `71343890...` en sucursales BlackBox queden con `tenant_id = 81be...` (alineado al tenant real de la sucursal/tarifa).
- Activar la tarifa `10e24a96...` si es la que debe cubrir Rosario/Mar del Plata.
- Verificar que Rosario y Mar del Plata tengan al menos una tarifa activa y visible que matchee:
  - Rosario → “Mar del Plata”
  - Mar del Plata → “Rosario”
- Validar que para esas sucursales haya conceptos/precios que den total > 0 (evitar bloqueo posterior por “Precio inválido”).

Fase 2 — Evitar que vuelva a pasar (hardening)
- Corregir `TarifaBranchesDialog` para no depender de `profile?.tenant_id` como fuente única al guardar asignaciones (en escenarios super admin puede generar tenant incorrecto).
- Fortalecer la función RPC `upsert_sucursal_tarifas`:
  - Derivar/validar tenant desde la tarifa y/o sucursal.
  - Rechazar asignaciones cruzadas de tenant.
  - No confiar en un `p_tenant_id` inconsistente.
- Con esto se evita que “parezca configurado” en UI pero quede invisible por RLS para operadores de sucursal.

Fase 3 — Mejora de diagnóstico en UI (opcional, recomendada)
- En `NewShipment.tsx`, cuando esté activa la auto-selección por zona y no haya match:
  - Mostrar mensaje más específico para sucursal-a-sucursal (ej. “No hay tarifa activa para Rosario → Mar del Plata”).
  - Diferenciar claramente entre “faltó seleccionar sucursal destino” y “hay destino pero no hay tarifa compatible”.

Validación funcional (fin a fin)
1) Ingresar como usuario de sucursal Rosario.
2) Crear envío `sucursal_sucursal` con destino Mar del Plata.
3) Confirmar que:
   - aparece tarifa automáticamente (o queda seleccionable si aplica),
   - no sale “Debes seleccionar la sucursal de destino” cuando el destino está elegido,
   - permite crear envío sin error de tarifa/precio.
4) Repetir inverso: usuario de Mar del Plata con destino Rosario.

Impacto esperado
- Rosario y Mar del Plata vuelven a poder operar envíos sucursal-a-sucursal con tarifas válidas.
- Se elimina la inconsistencia de tenant en asignaciones que hoy rompe visibilidad por RLS.
- Queda protegido el flujo para que no se vuelva a degradar al reconfigurar tarifas desde administración.
