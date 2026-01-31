

# Plan: Mejorar Presentación del Logo en el Sidebar

## Problema

El logo de BlackBox Cargas tiene fondo blanco que se ve mal sobre el sidebar oscuro, creando un efecto "cuadrado" poco profesional.

## Solución Recomendada

Hay dos opciones complementarias:

### Opción A: Subir logo con fondo transparente (RECOMENDADO)

La solución más profesional es subir una versión del logo en formato **PNG con fondo transparente**:

1. Ir a **Personalización** en el panel de Super Admin
2. Seleccionar la empresa **BlackBox Cargas**
3. En la pestaña **Imágenes**, eliminar el logo actual
4. Subir una nueva versión del logo en formato PNG con transparencia

Esto se integra perfectamente sin necesidad de cambios en el código.

### Opción B: Mejoras de CSS (si no se puede cambiar el logo)

Agregar estilos CSS para que el logo se vea mejor:

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/AppSidebar.tsx` | Agregar padding, bordes redondeados y fondo adaptativo al contenedor del logo |

```typescript
// Contenedor del logo con fondo adaptativo
<div className="flex items-center justify-center rounded-lg bg-white/10 p-1">
  <img 
    src={branding.logo_light} 
    alt={branding.nombre_app || 'Logo'} 
    className={cn(
      "object-contain transition-all rounded",
      collapsed 
        ? "h-8 w-8 max-w-[32px]"
        : "h-10 w-auto max-w-[160px]"
    )}
  />
</div>
```

Esto agrega:
- Bordes redondeados al logo
- Un fondo semi-transparente que suaviza el contraste
- Padding interno para darle espacio

### Mejora Adicional: Soporte para Logo Oscuro

El sistema ya tiene campo para **Logo Oscuro** (`logo_dark`). Podemos hacer que el sidebar use el logo apropiado según el tema:

- **Sidebar oscuro** → Usar `logo_dark` (logo blanco/claro) si está disponible
- **Sidebar claro** → Usar `logo_light` (logo oscuro) normal

Esto permite que cada empresa suba dos versiones de su logo para máxima compatibilidad.

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/AppSidebar.tsx` | Usar `logo_dark` para sidebar oscuro, mejorar estilos del contenedor |

---

## Resultado Esperado

| Situación | Antes | Después |
|-----------|-------|---------|
| Logo con fondo blanco en sidebar oscuro | Se ve un cuadrado blanco | Logo con bordes suaves o usando versión para fondo oscuro |
| Empresa sube logo transparente | N/A | Se muestra perfectamente |
| Empresa sube logo_dark adicional | No se usa | Se aplica automáticamente en sidebar oscuro |

