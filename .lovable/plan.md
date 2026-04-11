

## Plan: Actualizar y corregir todas las guías PDF del sistema

### Resumen
Revisar las 4 guías principales (Usuario, Super Admin, e-Commerce, Tarifas) contra las funcionalidades actuales del sistema, corrigiendo información desactualizada y agregando secciones para features nuevos.

### Cambios por archivo

#### 1. `src/lib/generateUserGuidePDF.ts` — Guía de Usuario

**Secciones a agregar:**
- **OCR Masivo (Bulk OCR)**: Escaneo de etiquetas con IA para ingreso rápido de paquetes sin QR. Modo continuo y masivo desde la app móvil.
- **Importación CSV**: Carga masiva de envíos desde archivos Excel/CSV con mapeo de columnas.
- **Check-In / Check-Out de Choferes**: Inicio y fin de jornada obligatorio para choferes en la app móvil.
- **Colectas**: Flujo de colecta de paquetes (escanear + confirmar colecta masiva).
- **Devoluciones / Cambios (Exchange)**: Al confirmar entrega, el sistema pregunta si hay devolución y crea envío inverso automáticamente.
- **Predicción de Demanda con IA**: Tab en Reportes que usa IA para predecir volumen de envíos.
- **Mapa de Calor (Heatmap)**: Visualización de densidad de envíos en el Mapa en Vivo.
- **Cobro Contra Entrega (COD)**: Registro de pagos en efectivo/digital al entregar.

**Secciones a actualizar:**
- **Planificador de Rutas (sección 6)**: Agregar geolocalización masiva ("Geolocalizar Todos"), normalización de ciudades (agrupa variantes como "La Plata Norte" bajo "La Plata"), importación CSV.
- **Navegación Activa (sección 8)**: Agregar flujo de devolución/cambio post-entrega.
- **Mapa en Vivo (sección 9)**: Agregar heatmap, filtros de choferes, panel de detalle de chofer, análisis de ruta con IA.
- **Finanzas (sección 10)**: Agregar rendiciones de choferes (COD) y liquidaciones de terciarizados más detalladas.
- **e-Commerce (sección 19)**: Agregar integración con Mercado Libre (no solo Tiendanube), etiquetas ML, sincronización de estados.

#### 2. `src/lib/generateSuperAdminGuidePDF.ts` — Guía Super Admin

**Secciones a agregar:**
- **Configuración de Integraciones**: Google Maps, WhatsApp, SMTP, SMS, ARCA/AFIP, Tiendanube, Mercado Libre por tenant.
- **Modo Flex y Flex Mixto**: Activación por tenant en el diálogo de edición, comportamiento del modo mixto con fallback OCR.
- **Actividad de Usuarios**: Log de inicios de sesión y acciones por tenant.
- **Landing y Contenido Editable**: Gestión del contenido de la landing page pública.

**Secciones a actualizar:**
- **Gestión de Tenants (sección 1)**: Agregar campo `ecommerce_enabled`, `modo_flex`, configuración JSONB.
- **Planes y Suscripciones (sección 6)**: Agregar integración con Mercado Pago para suscripciones, no solo Stripe.

#### 3. `src/lib/generateRatesGuidePDF.ts` — Guía de Tarifas
- Agregar sección sobre **seguro configurable** (valor mínimo/máximo, base + excedente).
- Agregar sección sobre **asignación de tarifas por sucursal** y **conceptos por sucursal**.
- Agregar **comisiones por sucursal** (emisión y recepción).

#### 4. `src/lib/generateEcommerceGuidePDF.ts` — Guía e-Commerce
- Agregar sección completa de **Mercado Libre**: OAuth, sincronización, etiquetas, estados ML.
- Actualizar sección de sellers: conceptos editables, tarifas por seller.
- Agregar flujo de **eliminación de envío** con rollback de cuenta corriente.

### Archivos a modificar
| Archivo | Tipo de cambio |
|---------|---------------|
| `src/lib/generateUserGuidePDF.ts` | Actualizar GUIDE_CONTENT con ~8 secciones nuevas y ~5 actualizadas |
| `src/lib/generateSuperAdminGuidePDF.ts` | Agregar ~4 secciones nuevas y actualizar ~2 |
| `src/lib/generateRatesGuidePDF.ts` | Agregar ~3 secciones y actualizar existentes |
| `src/lib/generateEcommerceGuidePDF.ts` | Agregar sección ML y actualizar sellers |

### Notas técnicas
- Solo se modifica el contenido estático (constantes `GUIDE_CONTENT` / `RATES_GUIDE_CONTENT` / `ECOMMERCE_GUIDE_CONTENT`). La lógica de generación PDF no cambia.
- El contenido se mantiene en español argentino consistente con el resto del sistema.

