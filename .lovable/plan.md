

# Plan: Toggle de Tema Claro/Oscuro en Landing Page

## Resumen

Agregar un boton de cambio de tema en el navbar de la landing page y adaptar todos los componentes para que funcionen correctamente tanto en modo claro como oscuro.

---

## Cambios Necesarios

### 1. Navbar - Agregar ThemeToggle

**Archivo:** `src/components/landing/Navbar.tsx`

- Importar el componente `ThemeToggle` existente
- Agregarlo en la barra de navegacion desktop (junto a los CTAs)
- Agregarlo en el menu mobile

```text
Desktop:
[Logo] ... [Links] ... [ThemeToggle] [Login] [Comenzar]

Mobile menu:
[Links]
[ThemeToggle]
[CTAs]
```

---

### 2. Adaptar Componentes para Tema Claro/Oscuro

Cambiar colores hardcodeados por clases de Tailwind que respetan el tema:

| Color Actual | Tema Oscuro | Tema Claro |
|--------------|-------------|------------|
| `bg-[#050507]` | `dark:bg-[#050507]` | `bg-white` |
| `text-white` | `dark:text-white` | `text-foreground` |
| `text-gray-400` | `dark:text-gray-400` | `text-muted-foreground` |
| `text-gray-500` | `dark:text-gray-500` | `text-muted-foreground` |
| `text-gray-600` | `dark:text-gray-600` | `text-muted-foreground/70` |
| `border-white/5` | `dark:border-white/5` | `border-border` |
| `bg-white/[0.02]` | `dark:bg-white/[0.02]` | `bg-muted/50` |
| `bg-gray-900/80` | `dark:bg-gray-900/80` | `bg-card` |

---

### 3. Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `Navbar.tsx` | Agregar ThemeToggle, adaptar colores |
| `Hero.tsx` | Reemplazar colores fijos por clases adaptativas |
| `Clients.tsx` | Adaptar fondos y bordes |
| `HowItWorks.tsx` | Adaptar fondos y textos |
| `Features.tsx` | Adaptar cards y textos |
| `Pricing.tsx` | Adaptar cards y textos |
| `CTASection.tsx` | Adaptar fondos y textos |
| `Footer.tsx` | Adaptar fondos y textos |
| `Index.tsx` | Cambiar contenedor principal |

---

### 4. Patron de Clases Adaptativas

Para cada seccion, el patron sera:

```tsx
// Antes (solo oscuro):
className="bg-[#050507] text-white"

// Despues (adaptativo):
className="bg-background dark:bg-[#050507] text-foreground dark:text-white"
```

Para gradientes y efectos de glow, se ajustara la opacidad segun el tema:

```tsx
// Antes:
style={{ background: 'radial-gradient(ellipse, hsl(174 50% 50% / 0.15) 0%, transparent 70%)' }}

// Despues (con clases condicionales):
className="dark:opacity-100 opacity-50"
```

---

### 5. Detalles Especificos por Componente

#### Hero.tsx
- Fondo: `bg-gradient-to-b from-background to-muted dark:bg-[#050507]`
- Gradientes de glow: Mantener pero reducir opacidad en claro
- Grid overlay: `dark:opacity-[0.02] opacity-[0.05]`
- Dashboard preview: `bg-card dark:bg-gray-900/80`

#### Features.tsx
- Cards: `bg-muted/50 dark:bg-white/[0.02]`
- Bordes: `border-border dark:border-white/5`
- Hover: `hover:border-primary/30 dark:hover:border-[hsl(var(--geo-teal)/0.3)]`

#### Pricing.tsx
- Cards similares a Features
- Popular badge: Mantener gradiente geo-teal

#### Footer.tsx
- Fondo: `bg-muted dark:bg-[#050507]`
- Textos: Usar variables de foreground

---

### 6. Consideraciones de UX

- El toggle respetara la preferencia del sistema por defecto
- La transicion entre temas sera suave (ya configurado en ThemeProvider)
- Los gradientes teal/cyan se mantienen como acento en ambos temas
- El logo funciona en ambos fondos (ya es PNG con transparencia)

---

## Orden de Implementacion

1. Modificar `Index.tsx` para usar `bg-background`
2. Agregar `ThemeToggle` al `Navbar.tsx`
3. Adaptar `Hero.tsx` (el mas complejo)
4. Adaptar `Clients.tsx`
5. Adaptar `HowItWorks.tsx`
6. Adaptar `Features.tsx`
7. Adaptar `Pricing.tsx`
8. Adaptar `CTASection.tsx`
9. Adaptar `Footer.tsx`

