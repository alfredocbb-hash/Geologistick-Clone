
# Plan: Aplicar Tema Oscuro a Páginas Legales

## Problema Identificado

Las páginas legales (Privacy, Terms, Cookies) usan `bg-background` que depende del tema del sistema/usuario. La landing page usa un fondo fijo `#050507` creando una inconsistencia visual.

## Solución

Actualizar el `LegalPageLayout.tsx` para que use el mismo estilo ultra minimalista oscuro que la landing page, manteniendo consistencia visual.

---

## Archivo a Modificar

### `src/components/legal/LegalPageLayout.tsx`

**Cambios:**
1. Cambiar fondo de `bg-background` a `bg-[#050507]`
2. Agregar efectos sutiles de fondo (gradientes, textura)
3. Ajustar colores de texto para mejor contraste
4. Actualizar estilos de Cards para consistencia

**Antes (línea 12):**
```tsx
<div className="min-h-screen bg-background flex flex-col">
```

**Después:**
```tsx
<div className="min-h-screen bg-[#050507] flex flex-col relative">
  {/* Subtle gradient background */}
  <div className="absolute inset-0 pointer-events-none">
    <div 
      className="absolute top-0 left-1/4 w-[600px] h-[400px] rounded-full blur-[150px] opacity-50"
      style={{ 
        background: 'radial-gradient(ellipse, hsl(174 50% 50% / 0.08) 0%, transparent 70%)'
      }}
    />
  </div>
```

**Cambios adicionales:**
- Título: `text-foreground` → `text-white`
- Subtítulo: `text-muted-foreground` → `text-gray-400`
- Secciones h2: `text-foreground` → `text-white`
- Párrafos: `text-muted-foreground` → `text-gray-400`
- Cards: agregar estilos glassmorphism oscuros

---

## Resumen Visual

| Elemento | Antes | Después |
|----------|-------|---------|
| Fondo | `bg-background` (claro/oscuro variable) | `bg-[#050507]` (fijo oscuro) |
| Títulos | `text-foreground` | `text-white` |
| Texto | `text-muted-foreground` | `text-gray-400` |
| Cards | `bg-card/50` | `bg-white/[0.02] border-white/10` |
| Links | `text-primary` | `text-[hsl(var(--geo-teal))]` |

---

## Archivos Afectados

Solo se modifica **1 archivo** ya que el layout es compartido:

- `src/components/legal/LegalPageLayout.tsx`

Las páginas individuales (Privacy.tsx, Terms.tsx, Cookies.tsx) heredarán automáticamente los nuevos estilos.
