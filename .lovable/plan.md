

# Corregir rendición de chofer y actualización de pagos MP

## Problema 1: Error al rendir chofer

El error es: `new row for relation "movimientos_caja" violates check constraint "movimientos_caja_tipo_check"`

**Causa raíz**: La tabla `movimientos_caja` tiene un CHECK constraint que solo permite los valores `'entrada'` y `'salida'`, pero todo el código de la aplicación (Cash.tsx y el RPC `receive_rendition`) usa `'ingreso'` y `'egreso'`. La tabla está vacía porque nunca se pudo insertar un registro con estos valores.

**Solución**: Actualizar el CHECK constraint para que acepte `'ingreso'` y `'egreso'` en lugar de `'entrada'` y `'salida'`.

---

## Problema 2: Pagos de Mercado Pago no se actualizan

Los logs muestran que el webhook sigue fallando con "Could not find matching tenant for payment 144620464845", sin mostrar ningún log intermedio de la Estrategia 2. Esto indica que la corrección anterior del webhook no se desplegó correctamente o que `fetchPaymentFromMP` está fallando silenciosamente (sin log antes del `continue`).

**Causa raíz doble**:
1. Cuando `fetchPaymentFromMP` retorna `null` (error de API), el loop hace `continue` sin ningún log, haciendo imposible diagnosticar por qué falla
2. El código no tiene un `unique constraint` en `(envio_id, metodo)` de la tabla `pagos`, lo que hace que el `upsert` con `onConflict` falle silenciosamente

**Solución**:
- Agregar logs detallados en cada punto de decisión de la Estrategia 2
- Agregar un unique constraint parcial en `pagos(envio_id, metodo)` para que el upsert funcione
- Re-desplegar la función asegurando que los cambios anteriores también estén incluidos

---

## Cambios técnicos

### Migración SQL

1. Eliminar el CHECK constraint viejo y crear uno nuevo con los valores correctos:

```sql
ALTER TABLE movimientos_caja DROP CONSTRAINT movimientos_caja_tipo_check;
ALTER TABLE movimientos_caja ADD CONSTRAINT movimientos_caja_tipo_check 
  CHECK (tipo = ANY (ARRAY['ingreso'::text, 'egreso'::text]));
```

2. Agregar unique constraint parcial para el upsert de pagos MP:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS pagos_envio_metodo_unique 
  ON pagos(envio_id, metodo) 
  WHERE estado = 'pendiente';
```

### Webhook: `supabase/functions/mercadopago-webhook/index.ts`

Agregar logs detallados en la Estrategia 2 para diagnosticar cada paso:

- Log al entrar al loop con el tenant ID
- Log si `fetchPaymentFromMP` falla (antes del `continue`)
- Log si `external_reference` está vacío
- Log si no se encuentra el envío del tenant
- Cambiar el `upsert` por un `update` directo ya que siempre debería existir un pago pendiente

### Re-despliegue

Desplegar la función `mercadopago-webhook` para asegurar que todos los cambios (incluyendo los de la iteración anterior) estén activos.

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Fix CHECK constraint `movimientos_caja`, agregar index único en `pagos` |
| `supabase/functions/mercadopago-webhook/index.ts` | Agregar logs detallados en Strategy 2 |

## Resultado esperado

- La rendición de chofer se procesa correctamente y crea movimientos de caja con tipo `'ingreso'`
- El módulo de Control de Caja también puede registrar ingresos y egresos sin errores
- Los pagos de Mercado Pago se actualizan automáticamente cuando el webhook recibe la notificación
- Los logs permiten diagnosticar cualquier fallo futuro en el webhook

