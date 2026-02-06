

# Plan: Historial de Estados Descriptivo

## Objetivo

Transformar el historial de estados de envíos para que muestre mensajes descriptivos que incluyan nombres de sucursales y choferes según el contexto del movimiento.

---

## Ejemplos de Resultados

| Flujo | Estado | Mensaje Descriptivo |
|-------|--------|-------------------|
| **Sucursal a Sucursal** | Pendiente | "Sucursal Origen Berazategui" |
| | En Tránsito | "Camino hacia Centro Logístico - Recolectado por Juan Pérez" |
| | En Sucursal | "Ingreso a Centro Logístico Quilmes" |
| | En Tránsito | "Camino hacia Córdoba - Recolectado por María García" |
| | En Sucursal | "Ingreso a Sucursal Destino Córdoba - Listo para retirar" |
| | Entregado | "Entregado en Sucursal Córdoba" |
| **A Domicilio** | En Reparto | "En reparto - Repartidor: Carlos López" |
| | Entregado | "Entregado en domicilio - Entregó: Carlos López" |

---

## Cambios en Base de Datos

### 1. Nueva Función Auxiliar

```sql
CREATE OR REPLACE FUNCTION public.get_user_display_name(p_user_id uuid)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT TRIM(COALESCE(nombre, '') || ' ' || COALESCE(apellido, ''))
  FROM profiles
  WHERE user_id = p_user_id;
$$;
```

### 2. Trigger Mejorado `log_envio_estado_change`

El trigger actualizado hará lookups a:
- `sucursales` (origen, destino, actual del usuario)
- `profiles` (nombre del chofer y usuario actual)

Y generará notas descriptivas basadas en:
- Tipo de transición de estado
- Si la sucursal actual es centro logístico o destino final
- Si la entrega es a domicilio o en sucursal
- Nombre del chofer/repartidor involucrado

**Lógica clave:**

```sql
v_notas := CASE
  -- Creación
  WHEN NEW.estado = 'pendiente' THEN
    'Sucursal Origen ' || v_suc_origen_nombre
    
  -- En tránsito
  WHEN NEW.estado = 'en_transito' THEN
    'Camino hacia ' || v_suc_destino_nombre || 
    ' - Recolectado por ' || v_chofer_nombre
    
  -- Ingreso a sucursal destino
  WHEN NEW.estado = 'en_sucursal' AND v_is_destino_final THEN
    'Ingreso a Sucursal Destino ' || v_suc_actual_nombre || 
    ' - Listo para retirar'
    
  -- En reparto
  WHEN NEW.estado = 'en_reparto' THEN
    'En reparto - Repartidor: ' || v_chofer_nombre
    
  -- Entregado en domicilio
  WHEN NEW.estado = 'entregado' AND NOT NEW.entregado_en_sucursal THEN
    'Entregado en domicilio - Entregó: ' || v_usuario_nombre
END;
```

---

## Cambios en Frontend

### 1. `ShipmentHistoryDialog.tsx`

Actualizar la presentación para priorizar las notas descriptivas:

**Antes:**
- Muestra badge con label genérico ("En Sucursal")
- Notas aparecen secundarias

**Después:**
- Las notas descriptivas se muestran como texto principal
- Badge se mantiene para referencia visual del estado

```tsx
// Cambiar de:
<Badge>{statusConfig[entry.estado_nuevo]?.label}</Badge>
{entry.notas && <p className="text-sm">{entry.notas}</p>}

// A:
{entry.notas ? (
  <p className="font-medium">{entry.notas}</p>
) : (
  <Badge>{statusConfig[entry.estado_nuevo]?.label}</Badge>
)}
```

### 2. `Tracking.tsx` (público)

Misma mejora: priorizar la nota descriptiva en el historial de movimientos.

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | Crear función auxiliar + reemplazar trigger |
| `src/components/shipments/ShipmentHistoryDialog.tsx` | Priorizar notas descriptivas |
| `src/pages/Tracking.tsx` | Mejorar presentación del historial público |

---

## Historial Existente

- Los registros anteriores sin notas seguirán mostrando el label del estado
- Solo los nuevos cambios generarán notas descriptivas
- El cambio es progresivo y no retroactivo

---

## Secuencia de Implementación

1. **Migración SQL**: Crear `get_user_display_name` y actualizar trigger
2. **ShipmentHistoryDialog**: Actualizar presentación de notas
3. **Tracking.tsx**: Actualizar vista pública del historial

