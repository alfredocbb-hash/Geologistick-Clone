

## Plan: Mejoras visuales en AppHeader y AppSidebar

Cambios puramente cosméticos en 2 archivos. DashboardLayout no necesita cambios (es idéntico).

### 1. AppHeader.tsx

- **Header border**: Cambiar `border-b bg-card/80 backdrop-blur-md` por `bg-card/80 backdrop-blur-xl gradient-border`
- **Avatar gradient ring**: Envolver el `Avatar` en un div con `rounded-full p-[2px] bg-gradient-to-br from-[hsl(var(--geo-teal))] to-[hsl(var(--primary))]` y agregar `border-2 border-card` al Avatar

### 2. AppSidebar.tsx (líneas 409-418)

Actualizar el renderizado de items de navegación:
- Envolver el ícono en un div de 7x7 con fondo degradado cuando está activo
- Agregar clase `sidebar-active-indicator` al NavLink activo
- Agregar transiciones `duration-200` a items y contenedor de ícono
- Cambiar estilos hover a `hover:bg-sidebar-accent/60`

### Archivos

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/AppHeader.tsx` | Gradient border + avatar ring |
| `src/components/layout/AppSidebar.tsx` | Nav items con ícono degradado activo |

Sin cambios de backend ni lógica. Solo estilos CSS/Tailwind.

