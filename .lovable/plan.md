
# Plan: Rediseño Profesional Landing Page con Colores Geologistick

## Paleta de Colores del Logo

Basado en el logo de Geologistick, estos son los colores a utilizar:

| Color | Uso | HSL Aproximado |
|-------|-----|----------------|
| Azul Oscuro | Fondos, sidebar | 210 60% 15% |
| Teal/Cyan | Acentos, CTAs secundarios | 174 50% 50% |
| Azul Medio | Gradientes, elementos secundarios | 207 50% 35% |
| Blanco | Texto principal, iconos | 0 0% 100% |

## Estructura Nueva de la Landing

```text
+----------------------------------------------------------+
|                      NAVBAR                               |
|  Logo | Caracteristicas | Clientes | Precios | Tracking  |
+----------------------------------------------------------+
                           |
+----------------------------------------------------------+
|                   HERO (Rediseñado)                       |
|  Gradiente azul oscuro → teal                            |
|  Badge "Plataforma #1 en Argentina"                      |
|  Estadisticas con datos reales                           |
+----------------------------------------------------------+
                           |
+----------------------------------------------------------+
|              CLIENTES (NUEVA SECCION)                     |
|  "Empresas que confian en nosotros"                      |
|  [Beraexpress] [BlackBox] [PlataBus]                     |
|  Logos en grayscale → color on hover                     |
+----------------------------------------------------------+
                           |
+----------------------------------------------------------+
|                 COMO FUNCIONA                             |
|  3 pasos: Registro → Configura → Opera                   |
|  Iconos con colores teal del logo                        |
+----------------------------------------------------------+
                           |
+----------------------------------------------------------+
|                    FEATURES                               |
|  Grid mejorado con iconos consistentes                   |
+----------------------------------------------------------+
                           |
+----------------------------------------------------------+
|                    PRICING                                |
|  Cards con bordes teal, CTA azul oscuro                  |
+----------------------------------------------------------+
                           |
+----------------------------------------------------------+
|                 CTA FINAL                                 |
|  Gradiente teal → azul, formulario trial                 |
+----------------------------------------------------------+
                           |
+----------------------------------------------------------+
|                    FOOTER                                 |
|  Fondo azul oscuro, links organizados                    |
+----------------------------------------------------------+
```

---

## Archivos a Crear

### 1. `src/components/landing/Clients.tsx`

Seccion que muestra logos de tenants activos:

- Query a `tenants` + `tenant_branding` para obtener logos
- Solo mostrar tenants con `activo = true` y logo configurado
- Logos en grayscale que se colorean al hover
- Animacion suave de entrada
- Responsive: carrusel en mobile, grid en desktop

### 2. `src/components/landing/HowItWorks.tsx`

Proceso en 3 pasos con iconos:

1. **Registrate** - UserPlus icon, color teal
2. **Configura** - Settings icon, color azul medio
3. **Opera** - Truck icon, color azul oscuro

Timeline horizontal con lineas conectoras animadas.

### 3. `src/components/landing/CTASection.tsx`

Seccion final antes del footer:

- Gradiente de teal a azul oscuro
- Titulo: "Comienza a optimizar tus entregas hoy"
- Boton CTA prominente
- Estadistica: "Unete a X+ empresas"

---

## Archivos a Modificar

### 1. `src/pages/Index.tsx`

Agregar nuevos componentes en orden:

```tsx
<Navbar />
<Hero />
<Clients />      // NUEVO
<HowItWorks />   // NUEVO  
<Features />
<Pricing />
<CTASection />   // NUEVO
<Footer />
```

### 2. `src/components/landing/Hero.tsx`

Cambios visuales:

- Cambiar gradiente de purple a **teal → azul oscuro**
- Orbs de fondo: cyan-500 y teal-500 en lugar de purple
- Badge: color teal en lugar de primary generico
- Stats: iconos con color teal

### 3. `src/components/landing/Navbar.tsx`

- Agregar enlace "Clientes" que scrollea a #clients
- Reordenar: Caracteristicas | Clientes | Precios | Tracking
- Gradiente del boton CTA: teal → azul oscuro

### 4. `src/components/landing/Footer.tsx`

- Fondo azul oscuro consistente con el logo
- Links organizados en columnas
- Iconos de redes sociales con color teal al hover

---

## Nuevas Variables CSS

Agregar en `src/index.css`:

```css
/* Colores Geologistick */
--geo-dark: 210 60% 15%;      /* Azul oscuro del fondo */
--geo-teal: 174 50% 50%;      /* Teal del pin izquierdo */
--geo-blue: 207 50% 35%;      /* Azul medio del pin derecho */
--geo-cyan: 187 70% 45%;      /* Cyan para acentos */

/* Gradientes Geologistick */
--gradient-geo: linear-gradient(135deg, hsl(174 50% 50%) 0%, hsl(210 60% 15%) 100%);
--gradient-geo-light: linear-gradient(135deg, hsl(187 70% 45%) 0%, hsl(174 50% 50%) 100%);
```

---

## Logica del Componente Clients

```typescript
// Query para obtener tenants con logos
const { data: clients } = useQuery({
  queryKey: ['landing-clients'],
  queryFn: async () => {
    const { data } = await supabase
      .from('tenants')
      .select(`
        id, 
        nombre, 
        slug,
        tenant_branding!inner (
          logo_light, 
          logo_dark
        )
      `)
      .eq('activo', true);
    
    // Filtrar solo los que tienen logo
    return data?.filter(t => 
      t.tenant_branding?.logo_light || 
      t.tenant_branding?.logo_dark
    ) || [];
  }
});
```

---

## Diseño Visual del Componente Clients

```text
+----------------------------------------------------------+
|                                                           |
|         Empresas que confian en Geologistick             |
|    Procesamos miles de envios para negocios como el tuyo |
|                                                           |
|   +----------+    +----------+    +----------+           |
|   |          |    |          |    |          |           |
|   | BERAEX   |    | BLACKBOX |    | PLATABUS |           |
|   |          |    |          |    |          |           |
|   +----------+    +----------+    +----------+           |
|                                                           |
|           Logos grayscale → color al hover               |
|                                                           |
+----------------------------------------------------------+
```

---

## Orden de Implementacion

1. Agregar variables CSS de colores Geologistick
2. Crear componente `Clients.tsx` con query a tenants
3. Crear componente `HowItWorks.tsx` con proceso en 3 pasos
4. Crear componente `CTASection.tsx` con call-to-action final
5. Actualizar `Hero.tsx` con nuevos colores
6. Actualizar `Navbar.tsx` con enlace a clientes
7. Actualizar `Index.tsx` para incluir nuevos componentes
8. Actualizar `Footer.tsx` con colores consistentes

---

## Consideraciones

- **RLS**: Los logos estan en bucket publico, no hay problema de seguridad
- **Performance**: Lazy load de imagenes de logos
- **Responsive**: Mobile-first, carrusel en < 768px
- **Accesibilidad**: Alt text para logos, contraste adecuado
- **Animaciones**: Suaves, respetan prefers-reduced-motion
