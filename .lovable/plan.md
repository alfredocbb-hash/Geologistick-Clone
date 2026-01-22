
# Plan: Permitir Cancelar y Editar Rutas en Reparto

## Contexto del Problema

Actualmente cuando una ruta ya está "en reparto" (estado `confirmada` o `en_curso`), el administrador necesita poder:
1. **Cancelar la ruta completa** - liberando todos los envíos para replanificar
2. **Reprogramar envíos específicos** - cambiar la fecha de entrega para otro día
3. **Editar rutas en progreso** - aunque el chofer ya haya iniciado

---

## Solución Propuesta

### 1. Agregar Botón "Cancelar Ruta" en la Lista de Rutas Activas

Añadir un botón rojo de "Cancelar" junto al de "Editar" en cada ruta activa:

| Archivo | Cambio |
|---------|--------|
| `src/pages/RoutePlanner.tsx` | Agregar botón "Cancelar Ruta" con ícono de X |
| `src/pages/RoutePlanner.tsx` | Agregar estado para diálogo de confirmación |

### 2. Crear Diálogo de Confirmación de Cancelación

Un nuevo componente `CancelRouteDialog` que:
- Muestre un resumen de la ruta (número, chofer, cantidad de envíos)
- Pregunte qué hacer con los envíos:
  - **Liberar para replanificar hoy** (estado → `pendiente`)
  - **Reprogramar todos para mañana** (estado → `reprogramado` + fecha)
- Requiera confirmación antes de proceder

| Archivo | Cambio |
|---------|--------|
| `src/components/routes/CancelRouteDialog.tsx` | **Nuevo componente** |

### 3. Agregar Opción de Reprogramación en EditRouteDialog

Cuando el admin quita un envío de la ruta, dar la opción de:
- Quitar y liberar (comportamiento actual)
- Quitar y reprogramar para otra fecha

| Archivo | Cambio |
|---------|--------|
| `src/components/routes/EditRouteDialog.tsx` | Agregar selector de fecha al quitar envíos |
| `src/components/routes/EditRouteDialog.tsx` | Actualizar lógica para marcar como `reprogramado` |

### 4. Permitir Editar Rutas en Estado `en_curso`

Actualmente si el chofer ya inició la ruta, no debería bloquearse la edición para el admin. Solo agregar una advertencia visual.

| Archivo | Cambio |
|---------|--------|
| `src/components/routes/EditRouteDialog.tsx` | Mostrar advertencia si ruta está `en_curso` |
| `src/components/routes/EditRouteDialog.tsx` | Permitir modificaciones de todas formas |

---

## Flujo de Cancelación de Ruta

```text
Admin ve ruta activa → Click "Cancelar" → 

Diálogo de Confirmación:
┌─────────────────────────────────────────────┐
│  ⚠️ Cancelar Ruta RUTA-2025-0045            │
│                                             │
│  Esta acción liberará los 8 envíos          │
│  asignados a esta ruta.                     │
│                                             │
│  ¿Qué deseas hacer con los envíos?          │
│                                             │
│  ○ Liberar para replanificar hoy            │
│  ○ Reprogramar todos para: [📅 24/01/2026]  │
│                                             │
│  Motivo: [_________________________]        │
│                                             │
│  [Cancelar]        [Confirmar Cancelación]  │
└─────────────────────────────────────────────┘
```

---

## Lógica de Backend (Cancelar Ruta)

La mutación de cancelación hará:

1. **Eliminar todas las paradas** de la tabla `ruta_paradas`
2. **Actualizar cada envío**:
   - `chofer_id` → `null`
   - `estado` → `pendiente` o `reprogramado`
   - `fecha_entrega` → nueva fecha (si se reprograma)
3. **Registrar en historial** cada cambio de envío
4. **Actualizar la ruta** con estado → `cancelada`

```tsx
// Pseudocódigo de la mutación
const cancelRouteMutation = useMutation({
  mutationFn: async ({ routeId, action, newDate, reason }) => {
    // 1. Obtener todos los envíos de la ruta
    const { data: paradas } = await supabase
      .from('ruta_paradas')
      .select('envio_id')
      .eq('ruta_id', routeId);
    
    const envioIds = paradas.map(p => p.envio_id);
    
    // 2. Actualizar envíos según la acción
    const newEstado = action === 'reschedule' ? 'reprogramado' : 'pendiente';
    
    await supabase
      .from('envios')
      .update({
        chofer_id: null,
        estado: newEstado,
        fecha_entrega: action === 'reschedule' ? newDate : null,
      })
      .in('id', envioIds);
    
    // 3. Registrar historial
    for (const envioId of envioIds) {
      await supabase.from('envio_historial').insert({
        envio_id: envioId,
        estado_anterior: 'en_reparto',
        estado_nuevo: newEstado,
        notas: `Ruta ${routeNumber} cancelada. ${reason}`,
        created_by: userId,
      });
    }
    
    // 4. Eliminar paradas
    await supabase
      .from('ruta_paradas')
      .delete()
      .eq('ruta_id', routeId);
    
    // 5. Marcar ruta como cancelada
    await supabase
      .from('rutas_planificadas')
      .update({ 
        estado: 'cancelada',
        updated_at: new Date().toISOString()
      })
      .eq('id', routeId);
  }
});
```

---

## Cambios en EditRouteDialog

Agregar pestaña o sección para reprogramar:

```tsx
// Al quitar un envío, mostrar opción de fecha
<div className="flex items-center gap-2">
  <Button onClick={() => toggleRemove(envioId)}>
    Quitar
  </Button>
  
  {envsToRemove.includes(envioId) && (
    <div className="flex items-center gap-2">
      <Label>Reprogramar para:</Label>
      <Input 
        type="date" 
        min={format(new Date(), 'yyyy-MM-dd')}
        onChange={(e) => setRescheduleDate(envioId, e.target.value)}
      />
    </div>
  )}
</div>
```

---

## Resumen de Archivos a Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/pages/RoutePlanner.tsx` | Modificar | Agregar botón "Cancelar" y estado del diálogo |
| `src/components/routes/CancelRouteDialog.tsx` | **Crear** | Nuevo diálogo de confirmación de cancelación |
| `src/components/routes/EditRouteDialog.tsx` | Modificar | Agregar opción de reprogramación al quitar envíos |

---

## Consideraciones Importantes

1. **Permisos**: Solo usuarios con rol `admin` o `supervisor` podrán cancelar rutas
2. **Notificación al chofer**: Si la ruta está `en_curso`, el chofer verá la ruta vacía/cancelada en su app
3. **Auditoría**: Todos los cambios quedan registrados en `envio_historial` con el motivo
4. **Estado `cancelada`**: Es un nuevo estado que se agregará a la ruta (no afecta otras funcionalidades)

---

## Resultado Esperado

El administrador podrá:
- ✅ Ver botón "Cancelar" en cada ruta activa
- ✅ Elegir si liberar envíos para hoy o reprogramar para otra fecha
- ✅ Ingresar un motivo de cancelación (para auditoría)
- ✅ Ver los envíos liberados en la lista de pendientes o reprogramados
- ✅ Replanificar la ruta con los cambios necesarios
