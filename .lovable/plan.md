

# Fix: Historial no muestra quién ni dónde se realizó la acción

## Problema

El historial del envío tiene dos problemas visibles:

1. **Entradas duplicadas antiguas**: Las entradas "Estado cambiado manualmente a En Sucursal" fueron creadas por el código anterior (ya corregido). Las entradas nuevas solo vendrán del trigger con el nombre de sucursal. Sin embargo, las entradas viejas persisten en la base de datos.

2. **No muestra quién realizó la acción**: El código ya obtiene los perfiles (`entry.profile`) pero nunca los renderiza en la UI. El usuario no puede ver quién cambió el estado ni desde qué sucursal operó.

## Cambios

### `src/components/shipments/ShipmentHistoryDialog.tsx`

Agregar en cada entrada del timeline:

- **Nombre del usuario** que realizó la acción (usando `entry.profile` que ya se obtiene)
- Hacer más visible la **ubicación** (sucursal desde donde se operó)

En la sección de renderizado de cada entrada (después de la fecha, líneas 167-178), agregar el nombre del operador con un icono `User`:

```tsx
{/* User who performed the action */}
{entry.profile && (
  <div className="flex items-center gap-1 text-xs text-muted-foreground">
    <User className="h-3 w-3" />
    <span>{entry.profile.nombre} {entry.profile.apellido || ''}</span>
  </div>
)}

{/* Location */}
{entry.ubicacion && (
  <div className="flex items-center gap-1 text-xs text-muted-foreground">
    <MapPin className="h-3 w-3" />
    <span>{entry.ubicacion}</span>
  </div>
)}
```

Con esto, cada entrada del historial mostrará claramente:
- La nota descriptiva del trigger (ej: "Ingreso a Sucursal Liniers")
- El badge de estado
- La fecha y hora
- **Quién** realizó la acción (ej: "Ezequiel Vosa")
- **Dónde** se realizó (ubicación/sucursal)

Las entradas viejas duplicadas seguirán visibles porque son datos históricos, pero las nuevas acciones generarán una sola entrada clara con toda la información contextual.

