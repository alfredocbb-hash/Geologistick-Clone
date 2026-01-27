

# Plan: Reemplazar Logo con la Imagen Proporcionada

## Objetivo
Usar la imagen subida como el nuevo logo oficial de Geologistick en toda la aplicación.

---

## Cambio a Realizar

### Reemplazar Archivo de Logo

| Acción | Detalle |
|--------|---------|
| **Origen** | `user-uploads://Gemini_Generated_Image_zb4jcnzb4jcnzb4j.png` |
| **Destino** | `src/assets/geologistick-logo.png` |
| **Método** | Copiar y reemplazar el archivo existente |

---

## Componentes que Usarán el Nuevo Logo Automáticamente

Dado que todos los componentes ya importan el logo desde `src/assets/geologistick-logo.png`, el cambio se reflejará automáticamente en:

| Componente | Ubicación |
|------------|-----------|
| Landing Navbar | `src/components/landing/Navbar.tsx` |
| Landing Footer | `src/components/landing/Footer.tsx` |
| Login Principal | `src/components/auth/LoginForm.tsx` |
| Dashboard Sidebar | `src/components/layout/AppSidebar.tsx` |
| Mobile Header (APK) | `src/components/mobile/MobileHeader.tsx` |
| Mobile Login (APK) | `src/components/mobile/MobileLoginScreen.tsx` |
| Mobile Splash (APK) | `src/components/mobile/MobileAppLayout.tsx` |

---

## Consideraciones

- **Sin cambios de código necesarios**: Solo se reemplaza el archivo de imagen
- **Tamaños conservados**: Los tamaños actualizados anteriormente (`h-12 w-12`, `w-20 h-20`, etc.) se mantienen
- **Fondo oscuro en la imagen**: El logo incluye un fondo azul oscuro, lo cual puede verse bien en interfaces claras pero podría necesitar ajustes en fondos oscuros

---

## Seccion Tecnica

### Comando de Copia
```
lov-copy user-uploads://Gemini_Generated_Image_zb4jcnzb4jcnzb4j.png src/assets/geologistick-logo.png
```

### Import Existente (sin cambios)
```tsx
import geologistickLogo from '@/assets/geologistick-logo.png';
```

El bundler de Vite procesará automáticamente la nueva imagen y la incluirá en el build.

