

# Plan: Corregir Visualización de Envíos Pendientes en Planificador

## Problema Identificado

Cuando un administrador cambia manualmente el estado de un envío a "pendiente" usando el diálogo de cambio de estado, el envío no aparece en el planificador de rutas porque:

1. El `ChangeStatusDialog` solo actualiza el campo `estado` pero **no limpia el `chofer_id`**
2. El planificador filtra con `.is("chofer_id", null)` - solo muestra envíos sin chofer asignado

**Datos confirmados en base de datos:**
- 2 envíos con estado `pendiente` que tienen `chofer_id` asignado
- Por eso no aparecen en el planificador

---

## Solución

Modificar el `ChangeStatusDialog` para que cuando se cambie el estado a `pendiente`, también se limpie el `chofer_id`, siguiendo el mismo patrón usado en otros componentes.

---

## Cambio Requerido

### Archivo: src/components/shipments/ChangeStatusDialog.tsx

**Antes:**
```typescript
const { error: updateError } = await supabase
  .from('envios')
  .update({ estado: newStatus })
  .eq('id', envioId);
```

**Después:**
```typescript
// Si vuelve a pendiente, limpiar chofer_id para que aparezca en planificador
const updateData: any = { estado: newStatus };
if (newStatus === 'pendiente') {
  updateData.chofer_id = null;
}

const { error: updateError } = await supabase
  .from('envios')
  .update(updateData)
  .eq('id', envioId);
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/shipments/ChangeStatusDialog.tsx` | Limpiar `chofer_id` cuando estado = "pendiente" |

---

## Beneficio

Los envíos que el administrador revierta a "pendiente" aparecerán inmediatamente en el planificador de rutas, listos para ser asignados nuevamente a una ruta.

---

## Nota

Los 2 envíos actualmente afectados en la base de datos se corregirán automáticamente cuando se actualicen nuevamente, o se puede ejecutar una corrección directa si es necesario.

