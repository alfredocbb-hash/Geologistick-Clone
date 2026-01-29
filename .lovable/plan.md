
# Plan: Fondo Oscuro en Login Web + Marca de Agua en Etiquetas

## 1. Fondo Oscuro en Login Web

### Problema Actual
El login web (`src/components/auth/LoginForm.tsx`) usa un fondo claro:
```tsx
<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
```

### Solución
Aplicar el mismo estilo del login móvil (`MobileLoginScreen.tsx`):
- Fondo oscuro `bg-slate-950`
- Orbs de gradiente animados
- Grid pattern sutil
- Iconos flotantes animados
- Efecto glassmorphism en la tarjeta
- Textos en colores claros

### Cambios en `src/components/auth/LoginForm.tsx`

| Elemento | Actual | Nuevo |
|----------|--------|-------|
| Contenedor principal | `bg-gradient-to-br from-primary/5...` | `bg-slate-950` con orbs animados |
| Logo | `shadow-colored` | Efecto glow con `blur-xl animate-pulse` |
| Título | `text-foreground` | `text-white` |
| Subtítulo | `text-muted-foreground` | `text-slate-400` |
| Card | `bg-card/80 backdrop-blur-sm` | `bg-slate-900/60 backdrop-blur-xl border-slate-800/50` |
| Labels | Por defecto | `text-slate-300` |
| Inputs | Por defecto | `bg-slate-800/50 border-slate-700/50 text-white` |
| Footer | `text-muted-foreground` | `text-slate-600` |

---

## 2. Marca de Agua en Etiquetas de Impresión

### Objetivo
Agregar el logo de la empresa emisora del envío como marca de agua semitransparente en el fondo de cada etiqueta impresa.

### Flujo de Datos

```text
envio.tenant_id → tenant_branding.logo_light → Marca de agua en etiqueta
```

### Cambios en `src/pages/PrintLabel.tsx`

#### A. Obtener el branding del tenant
Modificar la query existente para incluir el branding:

```tsx
// Agregar a la query del envío
const { data: envio, ... } = useQuery({
  queryFn: async () => {
    // ... query existente del envío ...
    
    // Obtener branding si hay tenant_id
    let logoUrl = null;
    if (data.tenant_id) {
      const { data: branding } = await supabase
        .from('tenant_branding')
        .select('logo_light')
        .eq('tenant_id', data.tenant_id)
        .single();
      logoUrl = branding?.logo_light;
    }
    
    return { ...data, logoUrl };
  }
});
```

#### B. Agregar estilos CSS para marca de agua

```css
.label {
  position: relative;
  /* ...estilos existentes... */
}

.watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60%;
  height: auto;
  opacity: 0.06;
  pointer-events: none;
  z-index: 0;
}

/* Asegurar que el contenido esté sobre la marca de agua */
.label > *:not(.watermark) {
  position: relative;
  z-index: 1;
}
```

#### C. Agregar elemento de marca de agua en HTML

```html
<div class="label">
  <!-- Watermark -->
  ${logoUrl ? `<img src="${logoUrl}" class="watermark" alt="" />` : ''}
  
  <!-- ... resto del contenido existente ... -->
</div>
```

#### D. Actualizar vista previa
Agregar la marca de agua también en la vista previa de React con el mismo efecto visual.

---

## Resumen de Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/auth/LoginForm.tsx` | Rediseño con fondo oscuro estilo mobile |
| `src/pages/PrintLabel.tsx` | Obtener logo del tenant + agregar marca de agua |

---

## Detalles Técnicos

### Marca de agua CSS optimizada para impresión B&W
- Opacidad muy baja (6%) para no interferir con la lectura
- Posición centrada fija
- Compatible con `print-color-adjust: exact` para impresoras láser
- La imagen debe poder cargarse antes de imprimir (se usará `onload`)

### Consideración de fallback
Si el envío no tiene `tenant_id` o el tenant no tiene logo configurado, simplemente no se mostrará marca de agua (comportamiento actual).
