

## Plan: Traducir la landing page completa con i18n

### Problema
Los componentes de la landing (Navbar, Hero, Features, CTASection, Pricing) tienen textos hardcodeados en español. Aunque los archivos JSON de traducción existen (`landing.json`), los componentes no usan `useTranslation()` — por eso cambiar el idioma no tiene efecto visual.

### Solución
Reemplazar todos los strings hardcodeados en los componentes de la landing con llamadas a `t()` usando el namespace `landing`, y expandir los archivos JSON con las claves faltantes.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/i18n/locales/es/landing.json` | Agregar claves para Navbar, Features, CTASection, Pricing |
| `src/i18n/locales/en/landing.json` | Ídem en inglés |
| `src/i18n/locales/pt/landing.json` | Ídem en portugués |
| `src/components/landing/Navbar.tsx` | Usar `t('landing:...')` para navLinks y botones |
| `src/components/landing/Hero.tsx` | Usar `t('landing:...')` para headline, trust indicators, mini features |
| `src/components/landing/Features.tsx` | Usar `t('landing:...')` para títulos y descripciones de features |
| `src/components/landing/CTASection.tsx` | Usar `t('landing:...')` para headline, subtítulo, botones, trust indicators |
| `src/components/landing/Pricing.tsx` | Usar `t('landing:...')` para encabezado y botones |

### Ejemplo de cambio (Hero.tsx)
```tsx
// Antes:
<span className="block text-foreground">Software de</span>

// Después:
const { t } = useTranslation('landing');
<span className="block text-foreground">{t('headline1')}</span>
```

### Claves a agregar (ejemplo parcial)
- `nav.features`, `nav.circuit`, `nav.pricing`, `nav.tracking`, `nav.contact`
- `nav.login`, `nav.getStarted`, `nav.getStartedFree`
- `cta.readyTo`, `cta.transformLogistics`, `cta.subtitle`, `cta.startNow`, `cta.viewPlans`
- `cta.setupTime`, `cta.noCard`, `cta.support247`
- `features.title`, `features.titleHighlight`, + 8 feature titles/descriptions
- `pricing.title`, `pricing.popular`, `pricing.requestTrial`

