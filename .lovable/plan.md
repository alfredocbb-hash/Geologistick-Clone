
# Plan: Habilitar Reprogramación de Envíos por Choferes

## Resumen
Agregar un botón visible para que los choferes puedan reprogramar envíos desde su app móvil, y resetear el envío 46332044050 para que pueda ser re-planificado.

---

## Cambios a Realizar

### 1. Agregar Botón "Reprogramar" en la Interfaz del Chofer

**Archivo:** `src/pages/ActiveRouteNavigation.tsx`

Actualmente los choferes solo tienen dos botones de acción:
- "Problema" → Abre ReportIncidentDialog
- "Entrega OK" / "Retiro OK" → Abre DeliveryConfirmation / PickupConfirmation

Se agregará un tercer botón "Reprogramar" que abrirá el RescheduleDialog existente.

```text
Diseño actual (Row 2):
┌─────────────────┬─────────────────┐
│    Problema     │   Entrega OK    │
└─────────────────┴─────────────────┘

Nuevo diseño (Row 2):
┌──────────┬───────────┬───────────┐
│ Problema │Reprogramar│ Entrega OK│
└──────────┴───────────┴───────────┘
```

---

### 2. Resetear Envío 46332044050 para Re-planificación

**Cambio de datos en base de datos:**

| Campo | Valor Actual | Nuevo Valor |
|-------|--------------|-------------|
| `estado` | `entregado` | `pendiente` |
| `chofer_id` | `d6a5a65d-...` | `null` |
| `reprogramado_count` | `0` | `1` |
| `ultima_reprogramacion` | `null` | `now()` |

Se agregará también un registro en `envio_historial` documentando el cambio.

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/ActiveRouteNavigation.tsx` | Agregar botón "Reprogramar" en grid de acciones (líneas 562-585) |

---

## Migración de Base de Datos

Se ejecutará una migración SQL para:

1. Actualizar el envío 46332044050 a estado `pendiente`
2. Limpiar `chofer_id` para que pueda ser re-asignado
3. Incrementar contador de reprogramaciones
4. Agregar registro en historial

```sql
-- Resetear envío 46332044050 para reprogramación
UPDATE envios SET 
  estado = 'pendiente',
  chofer_id = null,
  reprogramado_count = COALESCE(reprogramado_count, 0) + 1,
  ultima_reprogramacion = now()
WHERE tracking_number = '46332044050';

-- Agregar historial
INSERT INTO envio_historial (envio_id, estado_anterior, estado_nuevo, notas)
SELECT id, 'entregado', 'pendiente', 'Reprogramado manualmente para re-entrega'
FROM envios WHERE tracking_number = '46332044050';
```

---

## Seccion Tecnica

### Cambios en ActiveRouteNavigation.tsx

La grid de botones de acción pasará de 2 columnas a 3 columnas:

```tsx
// Cambiar de grid-cols-2 a grid-cols-3
<div className="grid grid-cols-3 gap-2">
  {/* Botón Problema */}
  <Button variant="outline" className="border-destructive/30 text-destructive" ...>
    <AlertTriangle className="h-4 w-4 mr-1" />
    Problema
  </Button>
  
  {/* NUEVO: Botón Reprogramar */}
  <Button 
    variant="outline" 
    className="border-warning/30 text-warning"
    onClick={() => {
      setSelectedShipment(nextEnvio);
      setDialogType('reschedule');
    }}
  >
    <CalendarClock className="h-4 w-4 mr-1" />
    Reprogramar
  </Button>
  
  {/* Botón Entrega/Retiro OK */}
  <Button className={isPickup ? 'bg-chofer' : 'bg-success'} ...>
    <CheckCircle className="h-4 w-4 mr-1" />
    {isPickup ? 'Retiro OK' : 'Entrega OK'}
  </Button>
</div>
```

### Importación necesaria
Se debe agregar `CalendarClock` a los imports de lucide-react.

### Flujo de Reprogramación
1. Chofer toca "Reprogramar" en un envío
2. Se abre RescheduleDialog (ya existente)
3. Chofer selecciona nueva fecha y motivo
4. El envío se actualiza a `estado: 'pendiente'`, `chofer_id: null`
5. Aparece en "Envíos Reprogramados" del planificador de rutas para re-asignación

### Permisos RLS
Los permisos actuales ya permiten que un chofer:
- Actualice envíos donde es el `chofer_id` asignado
- Inserte historial para esos envíos

No se requieren cambios en las políticas RLS.

---

## Resultado Final

Después de implementar estos cambios:

1. Los choferes verán un botón "Reprogramar" en cada parada de su ruta
2. El envío 46332044050 aparecerá en "Envíos Reprogramados" del planificador
3. Los administradores podrán re-asignarlo a una nueva ruta
