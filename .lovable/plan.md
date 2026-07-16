## Objetivo

Permitir que los tenants vean en **Incidencias** los envíos **cancelados** (y devueltos al remitente) para llevar registro de devoluciones, y asegurar que ese estado + motivo se vea claramente en el **tracking público**.

## Cambios

### 1. Nueva pestaña "Canceladas / Devoluciones" en `src/pages/Incidents.tsx`

- Agregar una tercera tab en el `Tabs` actual (junto a Pendientes / Resueltos): **"Canceladas"**.
- Al seleccionarla, la query cambia de fuente: en vez de leer `incidentes`, lee `envios` filtrado por:
  - `tenant_id = profile.tenant_id`
  - `estado IN ('cancelado', 'devuelto')`
- Traer también:
  - Última entrada de `envio_historial` (notas + fecha) para mostrar motivo de cancelación / devolución.
  - Incidencia asociada si existe (`incidentes` con `accion_tomada IN ('cancelar','devolver')`) para vincular con quién lo cerró.
- Columnas de la tabla en esta pestaña:
  - Tracking (clickeable → abre `ShipmentDetailsDialog`)
  - Estado (badge Cancelado / Devuelto)
  - Destinatario + dirección
  - Motivo (de la incidencia o última nota de historial)
  - Cerrado por (chofer / usuario)
  - Fecha
  - Acción: ver detalle (`ShipmentDetailsDialog`) y ver historial (`ShipmentHistoryDialog`).
- Actualizar KPI cards: agregar una card "Canceladas / Devoluciones" con el conteo del mes.
- Buscador existente sigue funcionando (tracking, destinatario, dirección).

### 2. Tracking público — mostrar motivo cuando está cancelado/devuelto

Archivo: `src/pages/Tracking.tsx` (y `TrackingEmbed.tsx` si comparte estructura).

- Los estados `cancelado` y `devuelto` ya se renderizan, pero no exponen el **motivo**.
- Cuando el estado actual sea uno de esos dos, mostrar un bloque destacado con:
  - Título: "Envío cancelado" o "Devuelto al remitente".
  - Motivo: última `nota` del `envio_historial` cuya transición terminó en ese estado.
  - Fecha del cierre.
- Los datos ya vienen del historial que se consulta; solo hay que derivar el motivo de la última entrada relevante y renderizarlo por encima del timeline.

### 3. Sin cambios de base de datos

- Los datos ya existen en `envios` (`estado`), `envio_historial` (`notas`, `estado_nuevo`) e `incidentes` (`accion_tomada`, `resolucion`).
- Las policies RLS actuales de `envios` y `envio_historial` ya permiten a los usuarios del tenant leer estos registros — no se toca RLS ni se crean migraciones.

## Detalles técnicos

- El `useQuery` de Incidents se ramifica por `activeTab`: para `'canceladas'` retorna un shape distinto (envío + motivo derivado), así que el render de la tabla usa un branch específico para esa pestaña (mantiene el render actual para pendiente/resuelto sin cambios).
- Motivo mostrado: `incidentes.resolucion` si hay incidencia con `accion_tomada IN ('cancelar','devolver')`, sino la `notas` de la última entrada de `envio_historial` con `estado_nuevo = estado actual`.
- En tracking, misma regla para elegir el motivo, usando el historial ya cargado por la página (no requiere endpoint nuevo).

## Fuera de alcance

- No se modifica `incidentes` ni cómo se cierran las incidencias hoy.
- No se agregan permisos ni cambios de RLS.
- No se toca el flujo de creación de devolución (`devolver`), solo la visualización/registro.