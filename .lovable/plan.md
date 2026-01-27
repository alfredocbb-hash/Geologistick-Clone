

# Plan: Logo Más Grande y Sin Fondo Blanco

## Objetivo
Generar un nuevo logo de Geologistick con fondo transparente y aumentar su tamaño en toda la aplicación.

---

## Cambios a Realizar

### 1. Generar Nuevo Logo
Usar la herramienta de generación de imágenes para crear un nuevo logo con fondo transparente, manteniendo el diseño actual (pin de ubicación + paquete 3D con gradiente azul-teal).

**Archivo:** `src/assets/geologistick-logo.png`

---

### 2. Actualizar Tamaños en Componentes

| Componente | Tamaño Actual | Tamaño Nuevo | Archivo |
|------------|---------------|--------------|---------|
| **Landing Navbar** | `h-10 w-10` | `h-12 w-12` | `Navbar.tsx` |
| **Landing Footer** | `h-10 w-10` | `h-12 w-12` | `Footer.tsx` |
| **Login Principal** | `w-16 h-16` | `w-20 h-20` | `LoginForm.tsx` |
| **Dashboard Sidebar** | `h-10 w-10` | `h-12 w-12` | `AppSidebar.tsx` |
| **Mobile Header (APK)** | `w-9 h-9` | `w-10 h-10` | `MobileHeader.tsx` |
| **Mobile Login (APK)** | `w-28 h-28` | `w-32 h-32` | `MobileLoginScreen.tsx` |
| **Mobile Splash (APK)** | `w-24 h-24` | `w-28 h-28` | `MobileAppLayout.tsx` |

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/assets/geologistick-logo.png` | Reemplazar con versión transparente |
| `src/components/landing/Navbar.tsx` | `h-10 w-10` → `h-12 w-12` |
| `src/components/landing/Footer.tsx` | `h-10 w-10` → `h-12 w-12` |
| `src/components/auth/LoginForm.tsx` | `w-16 h-16` → `w-20 h-20` |
| `src/components/layout/AppSidebar.tsx` | `h-10 w-10` → `h-12 w-12` |
| `src/components/mobile/MobileHeader.tsx` | `w-9 h-9` → `w-10 h-10` |
| `src/components/mobile/MobileLoginScreen.tsx` | `w-28 h-28` → `w-32 h-32` |
| `src/components/mobile/MobileAppLayout.tsx` | `w-24 h-24` → `w-28 h-28` |

---

## Seccion Tecnica

### Generacion del Logo Transparente
Se utilizara el modelo de generacion de imagenes especificando explicitamente fondo transparente en el prompt:

```
"Modern minimalist logo for logistics company 'Geologistick'. 
Design: Location pin marker combined with 3D package/box. 
Colors: Blue to teal gradient.
IMPORTANT: Transparent background, PNG with alpha channel.
Clean vector-style, no text in the image."
```

### Clases Tailwind Actualizadas
Ejemplo de cambio en Navbar:
```tsx
// Antes
className="h-10 w-10 rounded-xl object-contain shadow-lg"

// Despues  
className="h-12 w-12 rounded-xl object-contain shadow-lg"
```

### Consideraciones de Fondo Transparente
Al remover el fondo blanco, algunos contenedores pueden necesitar ajustes de sombra o bordes para mantener la visibilidad del logo en fondos claros y oscuros.

