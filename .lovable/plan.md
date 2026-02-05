

# Plan: Eliminar Entradas Duplicadas de Estado "Entregado" en el Historial

## Problema Identificado

Al revisar el historial de envíos, se muestran **estados duplicados de "entregado"** (y otros estados). La investigación revela:

### Datos de Evidencia
- **20+ envíos** tienen múltiples entradas de "entregado" en el historial
- Ejemplo: Envío `53e2594a...` tiene **5 entradas** de "entregado"
- Muchos duplicados ocurren en el **mismo segundo exacto** (diferencia de milisegundos)

### Causa Raíz: Doble Inserción de Historial

Existe un **trigger en la base de datos** que inserta automáticamente una entrada de historial cuando cambia el estado del envío:

```sql
-- Trigger: log_envio_estado (ACTIVO)
CREATE OR REPLACE FUNCTION log_envio_estado_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO public.envio_historial (envio_id, estado_anterior, estado_nuevo, created_by)
    VALUES (NEW.id, OLD.estado, NEW.estado, auth.uid());
  END IF;
  RETURN NEW;
END;
$$
```

**Problema**: El código frontend **también inserta manualmente** una entrada de historial después de actualizar el envío:

```typescript
// DeliveryConfirmation.tsx (líneas 162-179)
await supabase.from('envios').update({ estado: 'entregado' }); // ← Trigger inserta historial

// Y TAMBIÉN hace insert manual:
await supabase.from('envio_historial').insert({
  envio_id: shipment.id,
  estado_nuevo: 'entregado',  // ← Duplicado!
});
```

### Archivos Afectados (insertan historial manualmente)

| Archivo | Líneas | Estado |
|---------|--------|--------|
| `src/components/delivery/DeliveryConfirmation.tsx` | 170-179 | `entregado` |
| `src/components/scan/BranchDeliveryDialog.tsx` | 172-178 | `entregado` |
| `src/components/scan/MLDeliveryDialog.tsx` | 89-96 | varios estados |
| `src/pages/Routes.tsx` | 158-166 | `en_reparto` |
| `src/components/routes/EditRouteDialog.tsx` | 242-249 | `devuelto` |

---

## Solución Propuesta

**Opción recomendada**: Eliminar las inserciones manuales de historial en el código frontend, ya que el trigger de base de datos ya lo hace automáticamente.

### Archivos a Modificar

#### 1. `src/components/delivery/DeliveryConfirmation.tsx`

**Eliminar** el insert manual de historial (líneas 169-180):

```typescript
// ELIMINAR este bloque:
const historyPromise = supabase
  .from('envio_historial')
  .insert({
    envio_id: shipment.id,
    estado_anterior: shipment.estado as any,
    estado_nuevo: 'entregado',
    notas: notes || 'Entrega confirmada con foto y firma',
    ubicacion: shipment.direccion_entrega || null,
    created_by: user.id,
  });
```

**Nota**: El trigger no soporta `notas` ni `ubicacion`. Si estos campos son importantes, mantener el insert pero **modificar el trigger** para no ejecutarse cuando ya hay un insert manual reciente.

#### 2. `src/components/scan/BranchDeliveryDialog.tsx`

**Eliminar** líneas 171-178 (insert manual de historial).

#### 3. `src/components/scan/MLDeliveryDialog.tsx`

**Eliminar** líneas 89-96 (insert manual de historial).

#### 4. `src/pages/Routes.tsx`

**Eliminar** líneas 158-166 (loop de inserts de historial).

#### 5. `src/components/routes/EditRouteDialog.tsx`

**Eliminar** líneas 242-249 (insert manual de historial).

---

## Alternativa: Mantener Inserts Manuales (para campos adicionales)

Si se necesitan guardar `notas` y `ubicacion` (que el trigger no soporta), la alternativa es:

1. **Deshabilitar el trigger** para evitar duplicados
2. Mantener todos los inserts manuales en el código

```sql
-- Deshabilitar el trigger de auto-historial
ALTER TABLE envios DISABLE TRIGGER log_envio_estado;
```

---

## Limpieza de Datos Existentes (Opcional)

Para eliminar los duplicados históricos:

```sql
-- Eliminar entradas duplicadas manteniendo solo la primera de cada grupo
DELETE FROM envio_historial
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY envio_id, estado_nuevo, DATE_TRUNC('minute', created_at)
             ORDER BY created_at
           ) as rn
    FROM envio_historial
  ) sub
  WHERE rn > 1
);
```

---

## Flujo Corregido

```text
┌────────────────────────────────────────────────────────────┐
│  Usuario confirma entrega                                  │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Frontend: UPDATE envios SET estado = 'entregado'          │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Trigger log_envio_estado_change:                          │
│  INSERT INTO envio_historial (estado_nuevo: 'entregado')  │
│  ✓ UNA SOLA ENTRADA                                        │
└────────────────────────────────────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │ ELIMINADO: Frontend ya NO inserta   │
        │ historial manualmente               │
        └─────────────────────────────────────┘
```

---

## Decisión Requerida

**¿Qué enfoque prefiere?**

1. **Eliminar inserts manuales** (más limpio, pero pierde `notas` y `ubicacion` en historial)
2. **Deshabilitar el trigger** (mantiene campos adicionales, requiere migración SQL)

La opción **2** es más completa ya que preserva los campos `notas` y `ubicacion` que son útiles para auditoría.

---

## Impacto

| Aspecto | Antes | Después |
|---------|-------|---------|
| Entradas duplicadas | 2+ por cambio de estado | 1 por cambio de estado |
| Campos notas/ubicacion | Disponibles en duplicado | Depende de la opción elegida |
| Consistencia de datos | Duplicados en historial | Historial limpio |

