

## Plan: Rediseño Landing inspirado en LightData

### Enfoque

Tomar de LightData lo que funciona: **contenido informativo claro** (quiénes somos, funcionalidades con descripción detallada, circuito operativo visual, estadísticas reales, contacto directo por WhatsApp). Pero mantener el diseño moderno de Geologistick y sus herramientas reales.

### Estructura nueva de la landing

```text
Navbar (actualizado)
Hero (reescrito - más directo, con tracking inline + WhatsApp)
Clients (mantener marquee de logos)
QuienesSomos (NUEVO - misión/visión como LightData)
Funcionalidades (reescrito - cards grandes con ícono + descripción detallada)
Circuito (NUEVO - flujo visual del proceso operativo)
Stats (NUEVO - contadores animados reales desde DB)
Pricing (mantener)
Contacto/Footer (mejorado con WhatsApp + formulario)
```

### Cambios por archivo

#### 1. `src/components/landing/Hero.tsx` -- Reescribir
- Quitar el dashboard preview decorativo y stats falsos
- Layout split: texto izquierda + imagen/mockup derecha (como LightData)
- Headline directo: "Software de logística inteligente"
- Input de tracking inline: campo + botón que redirige a `/tracking?code=XXX`
- Botón WhatsApp prominente (como LightData) + botón "Comenzar gratis"
- Mantener el badge editable del CMS

#### 2. `src/components/landing/QuienesSomos.tsx` -- NUEVO
- Sección "¿Quiénes somos?" con texto descriptivo del servicio
- Cards de Misión y Visión con íconos
- Contenido editable desde `landing_content` (nueva sección `about`)

#### 3. `src/components/landing/Features.tsx` -- Reescribir
- Cambiar de bento grid genérico a **cards grandes** tipo LightData
- Cada feature ocupa más espacio con descripción detallada
- Features mapeados a las funcionalidades reales de Geologistick:
  - Hojas de ruta y asignación de envíos
  - Seguimiento GPS de choferes en tiempo real
  - Liquidaciones automáticas (choferes, sucursales, clientes)
  - Integración con Mercado Libre y Tiendanube
  - Escaneo QR y digitalización de paquetes
  - Generación de etiquetas y rótulos
  - Analytics y reportes
  - App móvil para choferes

#### 4. `src/components/landing/Circuito.tsx` -- NUEVO
- Diagrama visual del circuito operativo (como LightData pero moderno)
- Pasos: Recepción -> Digitalización -> Asignación -> Ruta -> Entrega -> Liquidación
- Línea conectora animada entre pasos
- Responsive: horizontal en desktop, vertical en mobile

#### 5. `src/components/landing/StatsCounter.tsx` -- NUEVO
- Contadores animados que cuentan desde 0 hasta el valor real
- Datos reales vía RPC: choferes activos, envíos último mes, empresas, etc.
- Usa el RPC existente `get_public_active_tenant_count` + nuevos RPCs simples
- Diseño con íconos como LightData (camión, persona, caja, mundo)

#### 6. `src/components/landing/Navbar.tsx` -- Actualizar
- Links: "Funcionalidades" | "Circuito" | "Precios" | "Tracking" | "Contacto"
- Agregar badge "Certificado ML" si el tenant tiene integración ML

#### 7. `src/components/landing/Footer.tsx` -- Mejorar
- Agregar botón WhatsApp flotante
- Sección de contacto más completa (dirección, email, teléfono, redes)

#### 8. `src/pages/Index.tsx` -- Reordenar secciones
```tsx
<Navbar />
<Hero />          // Reescrito
<Clients />       // Mantener
<QuienesSomos />  // Nuevo
<Features />      // Reescrito
<Circuito />      // Nuevo
<StatsCounter />  // Nuevo
<Pricing />       // Mantener
<CTASection />    // Mantener
<Footer />        // Mejorado
```

#### 9. `src/hooks/useLandingContent.ts` -- Agregar secciones
- Nueva sección `about` (quiénes somos, misión, visión)
- Nueva sección `circuit` (textos de los pasos del circuito)
- Nueva sección `contact` (WhatsApp, email, dirección, redes)

#### 10. Eliminar `src/components/landing/HowItWorks.tsx`
- Reemplazado por `Circuito.tsx` que es más completo y específico

### Lo que NO se toca
- Pricing, lógica de autenticación, edge functions, base de datos (excepto agregar rows a `landing_content`)
- Componentes internos del dashboard
- Tracking page existente (solo se linka desde el hero)

### Archivos a crear/modificar

| Archivo | Accion |
|---|---|
| `src/components/landing/Hero.tsx` | Reescribir |
| `src/components/landing/QuienesSomos.tsx` | Crear |
| `src/components/landing/Features.tsx` | Reescribir |
| `src/components/landing/Circuito.tsx` | Crear |
| `src/components/landing/StatsCounter.tsx` | Crear |
| `src/components/landing/Navbar.tsx` | Actualizar links |
| `src/components/landing/Footer.tsx` | Mejorar contacto + WhatsApp |
| `src/pages/Index.tsx` | Reordenar secciones |
| `src/hooks/useLandingContent.ts` | Agregar secciones about/circuit/contact |
| `src/components/landing/HowItWorks.tsx` | Eliminar |

