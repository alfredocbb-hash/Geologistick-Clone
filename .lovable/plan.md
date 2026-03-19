

## Plan: Mejora Visual del Dashboard y Componentes Globales

### Resumen
Rediseño visual del dashboard interno y los componentes globales (cards, sidebar, header) para lograr una estética moderna e innovadora, con micro-animaciones, glassmorphism, gradientes sutiles y mejor jerarquía visual.

### Cambios

**1. Stats Cards con glassmorphism y animaciones (`DashboardStatsCards.tsx`)**
- Cards con fondo glass (backdrop-blur) y borde sutil semitransparente
- Icono con gradiente radial de fondo en vez de color sólido
- Animación de entrada escalonada (staggered fade-in)
- Hover con efecto de elevación + borde brillante
- Número animado con transición suave

**2. Header mejorado (`AppHeader.tsx`)**
- Línea inferior con gradiente sutil (teal → cyan → blue) en vez de borde gris
- Avatar con anillo de gradiente animado
- Transición suave en scroll (opacity del blur)

**3. Cards globales (`card.tsx`)**
- Añadir variante `glass` con backdrop-blur y fondo semitransparente
- Hover sutil con transición de sombra y borde

**4. Sidebar modernizado (`AppSidebar.tsx`)**
- Items activos con indicador lateral (barra vertical con gradiente) en vez de background sólido
- Transición suave en hover con glow sutil
- Logo header con efecto glass

**5. Dashboard layout mejorado (`Dashboard.tsx`)**
- Greeting con gradiente de texto animado
- Sección de stats con fondo decorativo (subtle gradient blob)
- Cards de resumen del día con iconos que pulsan sutilmente

**6. Weekly Chart mejorado (`DashboardWeeklyChart.tsx`)**
- Card con borde degradado sutil
- Gradientes más vibrantes en el area chart
- Tooltip con glassmorphism

**7. CSS global (`index.css`)**
- Nueva clase `.glass-card` con backdrop-blur + borde luminoso
- Clase `.gradient-border` para bordes con gradiente
- Clase `.animate-number` para transiciones numéricas
- Clase `.glow-hover` para efecto de resplandor al hover
- Nuevas animaciones: `slide-up`, `count-up`, `shimmer`

### Archivos a modificar
- `src/index.css` - nuevas utilidades CSS
- `src/components/ui/card.tsx` - variante glass
- `src/components/layout/AppHeader.tsx` - gradiente inferior + avatar mejorado
- `src/components/layout/AppSidebar.tsx` - indicador activo lateral
- `src/pages/Dashboard.tsx` - greeting con gradiente
- `src/components/dashboard/DashboardStatsCards.tsx` - glassmorphism + animaciones
- `src/components/dashboard/DashboardWeeklyChart.tsx` - tooltip glass
- `src/components/dashboard/DashboardDaySummary.tsx` - iconos animados
- `src/components/dashboard/DashboardRecentShipments.tsx` - hover mejorado
- `src/components/dashboard/DashboardTopDrivers.tsx` - barras con gradiente

### Detalles visuales clave

```text
Antes:                          Después:
┌─────────────────┐             ┌─────────────────┐
│ ■ Envíos Hoy    │             │ ◉ Envíos Hoy    │  ← icono con glow
│   42            │             │   42  ↑12%       │  ← número + trend badge
│                 │             │ ░░░░░░░░░░░      │  ← sparkline mini
└─────────────────┘             └─────────────────┘
  borde gris sólido               borde glass + hover glow

Sidebar activo:                 Sidebar activo:
  [█ Dashboard    ]               [▎ Dashboard    ]  ← barra lateral gradiente
                                     efecto glow sutil
```

### Sin cambios en backend
Solo cambios visuales en frontend. Sin migraciones ni edge functions.

