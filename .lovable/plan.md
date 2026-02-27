

# Permitir cambiar el vencimiento de suscripciones

## Cambio

Agregar un campo de fecha de vencimiento en el dialogo de "Asignar Plan" para que el super admin pueda elegir o modificar la fecha de vencimiento (`current_period_end`) al asignar un plan, en lugar de que siempre sea "hoy + 1 mes".

## Detalle tecnico

### Archivo: `src/components/subscriptions/SuperAdminSubscriptionManager.tsx`

1. Agregar un estado `periodEnd` (string, formato `YYYY-MM-DD`) inicializado con la fecha actual + 1 mes, o con el vencimiento existente si el tenant ya tiene suscripcion.
2. En el dialogo de "Asignar Plan", agregar un campo `<Input type="date">` debajo del selector de plan, con label "Vencimiento".
3. Al abrir el dialogo (`openAssignPlan`), inicializar `periodEnd` con el `current_period_end` existente o con hoy + 1 mes.
4. En la mutacion `assignPlanMutation`, usar el valor de `periodEnd` en lugar del calculo automatico de +1 mes.
5. Incluir `periodEnd` en `resetForms()`.

No se requieren cambios en base de datos.
