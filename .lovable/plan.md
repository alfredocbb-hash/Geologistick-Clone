

# Plan: Crear Páginas Legales y de Soporte para TiendaNube

## Objetivo
Crear las páginas públicas necesarias para completar los "Datos de publicación" en el portal de TiendaNube Partners usando el dominio `geologistick.com`.

---

## URLs Finales para TiendaNube

| Campo TiendaNube | URL |
|------------------|-----|
| URL de configuraciones | `https://geologistick.com/tiendanube/config` |
| URL de política de privacidad | `https://geologistick.com/privacy` |
| URL de soporte | `https://geologistick.com/support` |
| E-mail de soporte | `soporte@geologistick.com` |

---

## Páginas a Crear

### 1. Política de Privacidad (`/privacy`)
Contenido estructurado con secciones sobre recolección de datos, uso, almacenamiento, derechos del usuario y una sección específica para integraciones con TiendaNube.

### 2. Términos de Servicio (`/terms`)
Términos generales de uso, responsabilidades y limitaciones.

### 3. Política de Cookies (`/cookies`)
Información sobre cookies utilizadas y cómo gestionarlas.

### 4. Página de Soporte (`/support`)
Formulario de contacto, email, teléfono y FAQs básicas.

### 5. Configuración TiendaNube (`/tiendanube/config`)
Página especial que TiendaNube abrirá cuando el seller haga clic en "Configurar". Detectará el `store_id` y mostrará el estado de conexión.

---

## Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `src/components/legal/LegalPageLayout.tsx` | Crear - Layout reutilizable |
| `src/pages/Privacy.tsx` | Crear |
| `src/pages/Terms.tsx` | Crear |
| `src/pages/Cookies.tsx` | Crear |
| `src/pages/Support.tsx` | Crear |
| `src/pages/TiendanubeConfig.tsx` | Crear |
| `src/App.tsx` | Modificar - Agregar 5 nuevas rutas |

---

## Sección Técnica

### Componente LegalPageLayout
Estructura base con Navbar, contenido y Footer para mantener consistencia visual.

### Página TiendanubeConfig
- Recibe `?store_id=XXX` del query param de TiendaNube
- Busca el seller por store_id en la base de datos
- Muestra estado de conexión y opciones de configuración
- Si no hay sesión, muestra instrucciones de contacto con soporte

### Rutas nuevas en App.tsx
```
/privacy → Privacy.tsx
/terms → Terms.tsx  
/cookies → Cookies.tsx
/support → Support.tsx
/tiendanube/config → TiendanubeConfig.tsx
```

