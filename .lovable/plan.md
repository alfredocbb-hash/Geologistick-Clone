
# Unificación de tema global

Objetivo: que todos los tenants compartan la misma paleta de colores y experiencia visual. El branding por tenant queda limitado a identidad (logo, favicon, nombre, textos, contacto). El usuario elige entre Claro / Oscuro / Sistema.

## 1. Paleta única (design tokens)

Consolidar `src/index.css` con una sola paleta bien definida para modo claro y oscuro, usando los tokens semánticos ya existentes (`--primary`, `--background`, `--sidebar-*`, `--success`, `--warning`, módulos, etc.). Se conservan los tokens actuales; solo se fija su valor definitivo y se elimina cualquier deriva por tenant.

- Modo claro: fondos neutros, sidebar claro con acento primario del sistema.
- Modo oscuro: fondos profundos, sidebar oscuro coherente.
- Tokens de estado y de módulo (envíos, chofer, caja, etc.) quedan igual.

No se hardcodean colores en componentes; todo sigue vía tokens.

## 2. Simplificar ThemeToggle

`src/components/theme/ThemeToggle.tsx`:
- Remover `midnight` y `logistics-blue`.
- Dejar solo: **Claro**, **Oscuro**, **Sistema**.
- Eliminar de `src/index.css` los bloques `.midnight` y `.logistics-blue` (o dejar comentados si se quieren rescatar luego — se removerán para limpiar).
- Revisar `next-themes` provider (en `App.tsx` / `main.tsx`) y quitar `themes={[...]}` extras si están declarados.

## 3. Neutralizar branding de color por tenant

`src/components/providers/TenantProvider.tsx`:
- Dejar de escribir `--primary`, `--primary-foreground`, `--accent`, `--sidebar-*` a partir de `branding.color_*`.
- Mantener aplicación de: `logo_light`, `logo_dark`, `favicon`, `nombre_app`, `meta_title`, `meta_description`, `custom_css` (opcional, ver punto 6), textos de footer/contacto/redes.
- Eliminar `buildSidebarPalette`, el observer de dark mode y toda la lógica derivada del color primario. Queda un provider mucho más chico.

`src/hooks/useTenant.ts`:
- La interfaz `TenantBranding` conserva los campos por compatibilidad DB, pero la app no los usa para color.

## 4. Limpiar UI de configuración

`src/pages/BrandingSettings.tsx`:
- Ocultar/eliminar los selectores de color (primario, foreground, secundario, acento, fondo claro/oscuro, sidebar claro/oscuro).
- Mostrar aviso: "Los colores del sistema son globales. Personalizá tu identidad con logo, favicon, nombre y textos".
- Mantener: logo claro/oscuro, favicon, nombre de app, meta title/description, textos de footer, datos de contacto, redes sociales, dominio custom.

## 5. Limpiar datos en DB

Migración de datos (via insert tool):
- `UPDATE tenant_branding SET color_primario = NULL, color_primario_foreground = NULL, color_secundario = NULL, color_acento = NULL, color_fondo = NULL, color_fondo_dark = NULL, color_sidebar = NULL, color_sidebar_dark = NULL;`
- No se dropean columnas (para permitir revertir sin perder trabajo).
- `tenants.color_primario / color_secundario / color_acento` reciben el mismo tratamiento (nulos), o quedan intactos si son NOT NULL con default — se verifica antes.

## 6. Decisión sobre `custom_css`

Se mantiene el campo `custom_css` funcional (algunos tenants podrían necesitar pequeños ajustes puntuales), pero se documenta en `BrandingSettings` que **no debe usarse para redefinir la paleta global**. Si se quiere restringir más, se puede ocultar el campo — lo dejo activo salvo que se indique lo contrario.

## Detalles técnicos

Archivos que cambian:
- `src/index.css` — consolidar paleta, borrar temas extra.
- `src/components/theme/ThemeToggle.tsx` — reducir a 3 opciones.
- `src/components/providers/TenantProvider.tsx` — quitar aplicación de colores.
- `src/pages/BrandingSettings.tsx` — ocultar controles de color, agregar aviso.
- `src/App.tsx` (o donde se monta `ThemeProvider`) — ajustar prop `themes` si estuviera fijada.
- Migración de datos en `tenant_branding` (y opcionalmente `tenants`).

Sin cambios de:
- Esquema de DB (columnas siguen).
- Lógica de negocio (envíos, liquidaciones, ARCA, ML, etc.).
- Módulos operativos.

Riesgos y mitigaciones:
- Si algún componente lee `branding.color_*` directamente para pintar algo (badges, banners), habrá que quitarlo. Grep previo a la edición para detectar usos residuales.
- Tenants que hoy dependen visualmente de su color quedarán con la paleta global — es exactamente el comportamiento pedido.

## Resultado esperado

- Toda la app se ve igual entre tenants, salvo logo/nombre/favicon/textos.
- El usuario elige Claro / Oscuro / Sistema.
- Configuración por tenant simplificada; menos superficie de error visual.
