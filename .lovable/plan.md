

# Plan: Hacer todas las tablas del sistema mas compactas

## Objetivo

Reducir el padding y altura de todas las tablas del sistema modificando el componente base `table.tsx`, de modo que las tablas ocupen menos espacio horizontal y vertical, evitando la necesidad de scroll innecesario.

## Cambios

### Archivo unico: `src/components/ui/table.tsx`

Se modifican los estilos por defecto de tres sub-componentes:

| Componente | Antes | Despues | Efecto |
|------------|-------|---------|--------|
| `TableHead` (encabezado) | `h-12 px-4` | `h-9 px-2 text-xs` | Encabezados mas bajos y compactos |
| `TableCell` (celda) | `p-4` | `px-2 py-2 text-sm` | Celdas con menos padding, texto ligeramente mas chico |
| `Table` (tabla base) | `text-sm` | `text-sm` | Sin cambio, se mantiene |

### Resultado

- Todas las tablas del sistema (Pedidos, Envios, Rutas, Clientes, Choferes, Sucursales, etc.) se veran mas compactas automaticamente.
- Las columnas ocuparan menos espacio, reduciendo o eliminando el scroll horizontal.
- No se modifica ninguna pagina individual: el cambio es global desde el componente base.

## Detalle tecnico

```
TableHead: "h-12 px-4"  -->  "h-9 px-2 text-xs"
TableCell: "p-4"         -->  "px-2 py-2"
```

Cualquier pagina que ya pase clases custom via `className` seguira funcionando porque el componente usa `cn()` (merge de clases), permitiendo sobreescribir estos valores donde sea necesario.

