
# Plan: Integrar Logo de Geologistick en Toda la Aplicación

## Objetivo
Reemplazar todos los iconos genéricos (Package, Truck) con el logo oficial de Geologistick (`src/assets/geologistick-logo.png`) en toda la aplicación web y la APK de choferes.

---

## Ubicaciones a Modificar

| Componente | Ubicación del Logo Actual | Cambio |
|------------|---------------------------|--------|
| **Landing Navbar** | Icono Package en div con gradiente | Imagen del logo |
| **Landing Footer** | Icono Package en div con gradiente | Imagen del logo |
| **Login Form** | Icono Package en div con gradiente | Imagen del logo |
| **Dashboard Sidebar** | Icono Package (fallback cuando no hay branding) | Imagen del logo |
| **Mobile Header (APK)** | Emoji 🚚 en div con gradiente | Imagen del logo |
| **Mobile Login (APK)** | Icono Truck en div con gradiente | Imagen del logo |
| **Mobile Splash (APK)** | Emoji 🚚 en MobileAppLayout | Imagen del logo |

---

## Archivos a Modificar

### 1. `src/components/landing/Navbar.tsx`
- Importar el logo desde assets
- Reemplazar el div con icono Package por una etiqueta `<img>` con el logo

### 2. `src/components/landing/Footer.tsx`
- Importar el logo desde assets
- Reemplazar el div con icono Package por una etiqueta `<img>` con el logo

### 3. `src/components/auth/LoginForm.tsx`
- Importar el logo desde assets
- Reemplazar el div con icono Package por una etiqueta `<img>` con el logo

### 4. `src/components/layout/AppSidebar.tsx`
- Importar el logo desde assets
- En el fallback (cuando no hay `branding.logo_light`), usar la imagen del logo en lugar del icono Package

### 5. `src/components/mobile/MobileHeader.tsx`
- Importar el logo desde assets
- En el fallback (cuando no hay `branding.logo_dark`), usar la imagen del logo en lugar del emoji 🚚

### 6. `src/components/mobile/MobileLoginScreen.tsx`
- Importar el logo desde assets
- Reemplazar el icono Truck por la imagen del logo

### 7. `src/components/mobile/MobileAppLayout.tsx`
- Importar el logo desde assets
- Reemplazar el emoji 🚚 en el splash screen por la imagen del logo

---

## Diseño Visual del Logo

El logo se integrará manteniendo el estilo actual:
- Contenedor con bordes redondeados y sombra
- Fondo con gradiente cuando sea apropiado
- Tamaño adaptable según el contexto (navbar, sidebar, mobile)

```text
Antes (Navbar):
┌──────────────────────────────────────┐
│ [📦]  Geologistick    Nav Links...   │
│  ↑ Icono Package                     │
└──────────────────────────────────────┘

Después (Navbar):
┌──────────────────────────────────────┐
│ [LOGO] Geologistick   Nav Links...   │
│  ↑ Imagen real                       │
└──────────────────────────────────────┘
```

---

## Sección Tecnica

### Importacion del Logo
```typescript
import geologistickLogo from '@/assets/geologistick-logo.png';
```

### Componente de Logo Reutilizable (Opcional)
Podria crear un componente `<GeologistickLogo size="sm|md|lg" />` para estandarizar el uso, pero dado que cada ubicacion tiene estilos ligeramente diferentes, se usara la imagen directamente con clases Tailwind apropiadas para cada contexto.

### Tamaños por Contexto
- **Navbar**: `h-10 w-10` (40x40px)
- **Footer**: `h-10 w-10` (40x40px)
- **Login**: `w-16 h-16` (64x64px)
- **Sidebar**: `h-10 w-10` (40x40px)
- **Mobile Header**: `h-9 w-9` (36x36px)
- **Mobile Login**: `w-28 h-28` (112x112px)
- **Mobile Splash**: `w-24 h-24` (96x96px)

### Consideraciones para la APK
- El logo se cargara desde los assets bundleados en la APK
- No depende de URLs externas, funcionara offline
- Mantendra la consistencia visual con la version web

---

## Orden de Implementacion

1. **Navbar.tsx** - Pagina principal, primera impresion
2. **Footer.tsx** - Consistencia en landing
3. **LoginForm.tsx** - Pantalla de acceso principal
4. **AppSidebar.tsx** - Dashboard admin
5. **MobileHeader.tsx** - Header de la APK
6. **MobileLoginScreen.tsx** - Login de la APK
7. **MobileAppLayout.tsx** - Splash screen de la APK
