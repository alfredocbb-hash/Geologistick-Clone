

## Plan: Rediseño compacto de Nuevo Envío (sin scroll)

### Problema actual
La página `/shipments/new` usa Cards apilados verticalmente (~6 cards grandes) que requieren mucho scroll. El usuario quiere un layout denso tipo la imagen de referencia (sistema de encomiendas clásico) donde todo cabe en una sola pantalla.

### Enfoque
Reorganizar el formulario en un layout de **grid de 2-3 columnas** con secciones compactas, eliminando CardHeaders redundantes y reduciendo espaciado. Inspirado en la imagen: campos densos, labels inline, todo visible sin scroll.

### Cambios en `src/pages/NewShipment.tsx`

**1. Layout principal: grid de 3 columnas**
```text
┌──────────────────┬──────────────────┬──────────────┐
│ Tipo Servicio    │  Remitente       │ Destinatario │
│ (radio compact)  │  Nombre/Tel/DNI  │ Nombre/Tel   │
│                  │  Dirección       │ Dirección    │
│ Tipo Pago        │                  │ Suc. Destino │
│ (3 botones)      │                  │              │
├──────────────────┴──────────────────┴──────────────┤
│ Paquete: Bultos | Peso | Dimensiones | V.Declarado │
│ Tarifa | Conceptos adicionales          │ TOTAL     │
│ Notas                    [Cancelar] [Crear Envío]  │
└────────────────────────────────────────────────────┘
```

**2. Cambios específicos:**
- Reemplazar Cards individuales por secciones con `border-l-2` y títulos compactos (sin CardHeader/CardDescription)
- Tipo de servicio: íconos más chicos en una sola fila horizontal (5 opciones inline)
- Tipo de pago: botones más pequeños en fila
- Remitente y Destinatario: lado a lado en columnas, campos con labels más compactos
- Paquete + Tarifa + Precio: todo en una franja inferior horizontal
- Eliminar espaciado `space-y-6` → `space-y-2` o `gap-3`
- Labels con `text-xs` en vez de `text-sm`
- Inputs con `h-8 text-sm` para compactarlos
- Sucursal origen como badge inline en el header (ya no card dedicada)
- Resumen de precio como panel lateral fijo o footer sticky
- Submit buttons en la franja inferior

**3. Footer sticky con precio total**
- Barra inferior fija con el precio total y botones Cancelar/Crear
- Siempre visible sin necesidad de scrollear

### Archivos a modificar
- `src/pages/NewShipment.tsx` — reestructuración completa del JSX de render (la lógica no cambia)

### Sin cambios en backend
Solo cambios de layout/UI. Toda la lógica de formulario, queries y mutations permanece igual.

