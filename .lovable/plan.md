

## Plan: Implementar sistema de idiomas (i18n) — Español, Portugués, Inglés

### Alcance
Soporte multilenguaje completo: dashboard, APK chofer, tracking público y landing page. Idioma seleccionable desde login y perfil del usuario.

### Librería
**react-i18next** + **i18next** + **i18next-browser-languagedetector** — el estándar de facto para React. Permite cambio dinámico sin recargar.

### Estructura de archivos de traducción

```text
src/
  i18n/
    index.ts              ← Configuración i18next
    locales/
      es/
        common.json       ← Botones, navegación, estados
        shipments.json    ← Envíos, tracking
        dashboard.json    ← Dashboard
        auth.json         ← Login, registro
        mobile.json       ← APK chofer
        landing.json      ← Landing page
      pt/
        common.json
        shipments.json
        ...
      en/
        common.json
        shipments.json
        ...
```

### Implementación por fases

**Fase 1 — Infraestructura base**
1. Instalar `react-i18next`, `i18next`, `i18next-browser-languagedetector`
2. Crear `src/i18n/index.ts` con configuración (default: `es`, fallback: `es`)
3. Crear archivos JSON de traducción iniciales para los 3 idiomas
4. Integrar `I18nextProvider` en `App.tsx`
5. Agregar campo `idioma` en la tabla `profiles` (migración SQL)

**Fase 2 — Selector de idioma**
1. Componente `LanguageSelector` (dropdown con banderas: 🇪🇸 🇧🇷 🇺🇸)
2. Agregarlo al `LoginForm` (antes de loguearse)
3. Agregarlo al `Profile` (para cambiar después)
4. Persistir preferencia en `profiles.idioma` y `localStorage`
5. Al login, leer `profiles.idioma` y aplicar automáticamente

**Fase 3 — Traducir componentes core**
1. Sidebar, header, navegación (`AppSidebar`, `AppHeader`)
2. Estados de envío (`statusConfig` en varios archivos)
3. Dashboard (cards, gráficos, resúmenes)
4. Formularios principales (nuevo envío, clientes)

**Fase 4 — Tracking público y Landing**
1. Página de tracking (`Tracking.tsx`) — detectar idioma del navegador
2. Landing page (Hero, Features, Pricing, etc.)
3. Emails transaccionales (templates en `_shared/email-templates/`)

**Fase 5 — APK chofer**
1. Tabs y pantallas mobile
2. Diálogos de entrega/recogida
3. Estados y notificaciones

### Migración SQL
```sql
ALTER TABLE profiles ADD COLUMN idioma TEXT DEFAULT 'es';
```

### Ejemplo de uso en componentes
```tsx
// Antes:
<h1>Envíos</h1>
<Badge>Entregado</Badge>

// Después:
const { t } = useTranslation();
<h1>{t('shipments.title')}</h1>
<Badge>{t('shipments.status.entregado')}</Badge>
```

### Archivos principales a modificar
| Archivo | Cambio |
|---------|--------|
| `package.json` | Agregar dependencias i18next |
| `src/i18n/index.ts` | Nueva config i18n |
| `src/i18n/locales/**` | Archivos de traducción (nuevos) |
| `src/App.tsx` | Agregar I18nextProvider |
| `src/components/auth/LoginForm.tsx` | Selector de idioma |
| `src/pages/Profile.tsx` | Selector de idioma |
| `src/lib/auth.tsx` | Leer idioma del perfil al login |
| Todos los componentes con texto | Reemplazar strings por `t()` |

### Volumen estimado
- ~50+ archivos a tocar para traducir textos
- ~3 archivos JSON grandes por idioma (comunes, envíos, mobile)
- Se puede hacer progresivamente: primero la infra + navegación, luego ir traduciendo pantalla por pantalla

### Nota importante
Dado el volumen, recomiendo implementar por fases. Empezaría con **Fase 1 + 2** (infraestructura + selector) y la traducción de la navegación principal y estados de envío. Luego iremos traduciendo el resto pantalla por pantalla.

