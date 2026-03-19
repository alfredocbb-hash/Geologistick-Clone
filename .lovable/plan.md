

## Plan: Centrar sidebar colapsado + agrandar texto en Nuevo Envío

### 1. Sidebar colapsado — centrar iconos

**Archivo:** `src/components/layout/AppSidebar.tsx`

Cuando el sidebar está colapsado (`collapsed = true`), los items de navegación no quedan centrados porque tienen `px-3` y `gap-3` fijos. Cambios:

- En el NavLink de items (línea ~414): agregar `justify-center` cuando `collapsed`
- En el header del sidebar (línea ~366): agregar `justify-center` cuando `collapsed`
- Aumentar `SIDEBAR_WIDTH_ICON` de `3rem` a `3.5rem` en `src/components/ui/sidebar.tsx` para dar más espacio al ícono centrado

### 2. Texto más grande en NewShipment

**Archivo:** `src/pages/NewShipment.tsx`

Aumentar tamaños de texto en toda la pantalla:

- Título "Nuevo Envío": `text-xl` → `text-2xl` (línea 1828)
- Headers de sección ("TIPO DE SERVICIO", "REMITENTE", "DESTINATARIO"): `text-xs` → `text-sm` (líneas ~1899, 1936, y equivalentes en cols 2/3)
- Labels de campos (Nombre, Apellido, etc.): `text-xs` → `text-sm`
- Inputs: agregar clase para font-size más grande donde usen `text-xs` → `text-sm`
- Opciones de tipo servicio: `text-xs` → `text-sm` (línea 1917)
- Botones de pago: `text-xs` → `text-sm`

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/ui/sidebar.tsx` | `SIDEBAR_WIDTH_ICON` de `3rem` → `3.5rem` |
| `src/components/layout/AppSidebar.tsx` | Centrar items cuando colapsado |
| `src/pages/NewShipment.tsx` | Escalar textos de `xs` a `sm` en todo el formulario |

