

## Plan: Theme Switcher con temas personalizados (Dark, Light, Midnight, Logistics Blue)

### Situación actual
- Ya existe `next-themes` con `ThemeProvider` en `App.tsx` (attribute="class", defaultTheme="system")
- Ya existe `ThemeToggle.tsx` (toggle simple dark/light)
- `index.css` define muy pocas variables CSS (solo `--background`, `--foreground`, `--primary`, `--warning`, `--radius` para `:root` y `.dark`)
- Muchas variables referenciadas en `tailwind.config.ts` (card, muted, accent, sidebar, destructive, etc.) no están definidas
- El perfil (`Profile.tsx`) ya tiene un selector de tema con 3 opciones (light/dark/system)
- `TenantProvider` sobreescribe algunas variables en runtime con colores de branding

### Cambios

**1. `src/index.css`** — Definir conjuntos completos de variables CSS para 4 temas:
- `:root` (Light) — paleta clara completa con todos los tokens (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, sidebar, success, warning, info, colores por modulo)
- `.dark` — tema oscuro actual mejorado con todas las variables
- `.midnight` — tema ultra-oscuro con tonos azul profundo (fondos slate-950, acentos azul-índigo)
- `.logistics-blue` — tema profesional azul oscuro con acentos teal/cyan

**2. `src/components/theme/ThemeToggle.tsx`** — Reemplazar toggle binario por dropdown con 4 opciones:
- Usar `DropdownMenu` de shadcn para mostrar las opciones: Claro, Oscuro, Midnight, Logistics Blue, Sistema
- Cada opción muestra un mini-preview (círculos de color representando la paleta)
- Icono dinámico según tema activo (Sun, Moon, Star, Ship, Monitor)

**3. `src/App.tsx`** — Actualizar `ThemeProvider`:
- Cambiar `themes={['light', 'dark', 'midnight', 'logistics-blue', 'system']}` para registrar los temas custom
- Mantener `attribute="class"` para que `next-themes` aplique la clase CSS correcta al `<html>`

**4. `src/pages/Profile.tsx`** — Actualizar selector de preferencias:
- Agregar las 2 opciones nuevas (Midnight, Logistics Blue) al `ToggleGroup` existente
- Iconos consistentes con el dropdown del header

**5. `src/components/mobile/MobileProfileTab.tsx`** — Actualizar selector móvil:
- Agregar las mismas opciones de tema disponibles en la versión desktop

### Paletas de ejemplo (valores HSL)

```text
Light:     bg=0 0% 100%       fg=222 47% 11%    primary=217 91% 60%
Dark:      bg=222 47% 6%      fg=210 40% 98%    primary=217 91% 60%  
Midnight:  bg=230 35% 5%      fg=220 30% 90%    primary=250 80% 65%
Logistics: bg=210 40% 8%      fg=200 30% 92%    primary=185 70% 50%
```

### Notas
- `TenantProvider` sigue funcionando: sobreescribe variables en runtime después del tema base
- `next-themes` guarda la elección en `localStorage` automáticamente
- No se modifica `tailwind.config.ts` — ya referencia todas las variables necesarias

### Archivos a modificar
- `src/index.css` — Definir paletas completas para los 4 temas
- `src/components/theme/ThemeToggle.tsx` — Dropdown con previews de color
- `src/App.tsx` — Registrar temas custom en ThemeProvider
- `src/pages/Profile.tsx` — Agregar opciones Midnight y Logistics Blue
- `src/components/mobile/MobileProfileTab.tsx` — Mismo selector en móvil

