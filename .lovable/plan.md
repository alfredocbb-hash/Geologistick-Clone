

# Plan: Nueva Pestaña "Terciarizados" en Planificador de Rutas

## Objetivo

Crear una nueva pestaña dentro del Planificador de Rutas para agregar envíos de empresas terciarizadas (Correo Argentino, OCA, Andreani, etc.) con campos específicos diferentes al formulario estándar.

---

## Vista de la Nueva Pestaña

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Crear Ruta] [Frecuentes] [Terciarizados] [Reprogramados] [Rutas Activas]  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ENVÍOS TERCIARIZADOS                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  AGREGAR NUEVO ENVÍO TERCIARIZADO                                   │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  Empresa: [Seleccionar ▼]        Tracking Externo: [______________] │   │
│  │           • Correo Argentino                                        │   │
│  │           • OCA                                                     │   │
│  │           • Andreani                                                │   │
│  │           • Otro                                                    │   │
│  │                                                                     │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  Código de Cliente: [__________]   Código de Orden: [____________]  │   │
│  │                                                                     │   │
│  │  Nombre Destinatario: [________________________________]            │   │
│  │                                                                     │   │
│  │  Calle y Número: [_______________________________________]          │   │
│  │                                                                     │   │
│  │  Ciudad: [__________________]   Provincia: [Seleccionar ▼]          │   │
│  │                                                                     │   │
│  │  Código Postal: [________]                                          │   │
│  │                                                                     │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  Tipo de Operación:   ○ Entrega   ○ Retiro   ○ Cobro               │   │
│  │                                                                     │   │
│  │  Fecha: [📅 dd/mm/yyyy]           Duración Estimada: [30] minutos   │   │
│  │                                                                     │   │
│  │  Observaciones: [_______________________________________________]   │   │
│  │                                                                     │   │
│  │                                   [Agregar a Lista]  [Crear Envío]  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ENVÍOS AGREGADOS (pendientes de crear ruta)                        │   │
│  ├────┬──────────────┬─────────────────┬────────────┬─────────┬────────┤   │
│  │ □  │ Tracking     │ Destinatario    │ Dirección  │ Tipo    │ Acc.   │   │
│  ├────┼──────────────┼─────────────────┼────────────┼─────────┼────────┤   │
│  │ ☑  │ AR123456789  │ Juan Pérez      │ Av. Corr.  │ Entrega │ 🗑     │   │
│  │ ☑  │ OCA98765432  │ María García    │ Belgrano   │ Retiro  │ 🗑     │   │
│  └────┴──────────────┴─────────────────┴────────────┴─────────┴────────┘   │
│                                                                             │
│  [Importar CSV Terciarizados]    [Seleccionar y Crear Ruta →]              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cambios en Base de Datos

### Migración SQL

```sql
ALTER TABLE envios 
ADD COLUMN es_terciarizado BOOLEAN DEFAULT false,
ADD COLUMN empresa_terciarizada TEXT,
ADD COLUMN tracking_externo TEXT,
ADD COLUMN codigo_cliente_externo TEXT,
ADD COLUMN codigo_orden_externo TEXT,
ADD COLUMN duracion_estimada_minutos INTEGER DEFAULT 30,
ADD COLUMN provincia TEXT;
```

**Campos nuevos:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `es_terciarizado` | BOOLEAN | Indica si es envío de terceros |
| `empresa_terciarizada` | TEXT | Nombre de la empresa (correo_argentino, oca, andreani, otro) |
| `tracking_externo` | TEXT | Número de seguimiento de la otra empresa |
| `codigo_cliente_externo` | TEXT | Código de cliente de la empresa terciarizada |
| `codigo_orden_externo` | TEXT | Código de orden de la empresa terciarizada |
| `duracion_estimada_minutos` | INTEGER | Tiempo estimado de la operación |
| `provincia` | TEXT | Provincia/Estado (complementa ciudad) |

---

## Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/components/routes/ThirdPartyShipmentsTab.tsx` | **Nuevo** | Componente de la nueva pestaña |
| `src/pages/RoutePlanner.tsx` | Modificar | Agregar la nueva pestaña al TabsList |
| `src/pages/Shipments.tsx` | Modificar | Mostrar badge de terciarizado y tracking externo |
| `src/components/shipments/ShipmentDetailsDialog.tsx` | Modificar | Mostrar información de terciarizado |
| `src/pages/PrintLabel.tsx` | Modificar | Incluir tracking externo en etiqueta |

---

## Nuevo Componente: ThirdPartyShipmentsTab.tsx

### Funcionalidades

1. **Formulario de captura** con todos los campos especificados
2. **Lista temporal** de envíos agregados (estado local)
3. **Creación individual** de envíos en la tabla `envios`
4. **Selección múltiple** para crear ruta con los envíos terciarizados
5. **Integración** con el flujo existente de creación de rutas

### Campos del Formulario

| Campo | Tipo de Input | Requerido |
|-------|---------------|-----------|
| Empresa terciarizada | Select | Sí |
| Tracking externo | Input texto | Sí |
| Código de cliente | Input texto | No |
| Código de orden | Input texto | No |
| Nombre destinatario | Input texto | Sí |
| Calle y número | Input texto | Sí |
| Ciudad | Input texto | Sí |
| Provincia | Select (lista Argentina) | Sí |
| Código postal | Input texto | No |
| Tipo de operación | Radio (Entrega/Retiro/Cobro) | Sí |
| Fecha | Date picker | Sí |
| Duración estimada | Input numérico (minutos) | Sí |
| Observaciones | Textarea | No |

### Empresas Terciarizadas Disponibles

```typescript
const EMPRESAS_TERCIARIZADAS = [
  { value: "correo_argentino", label: "Correo Argentino" },
  { value: "oca", label: "OCA" },
  { value: "andreani", label: "Andreani" },
  { value: "dhl", label: "DHL" },
  { value: "fedex", label: "FedEx" },
  { value: "otro", label: "Otro" },
];
```

### Provincias de Argentina

```typescript
const PROVINCIAS_ARGENTINA = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut",
  "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy",
  "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén",
  "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz",
  "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"
];
```

---

## Flujo de Trabajo

```text
1. Usuario va a Planificador → Pestaña "Terciarizados"
           │
           ▼
2. Completa formulario con datos del envío terciarizado
           │
           ▼
3. Click "Agregar a Lista" → Se agrega a lista temporal
           │         │
           │         └── O "Crear Envío" → Se crea directo en DB
           ▼
4. Repite para más envíos (o importa CSV)
           │
           ▼
5. Selecciona envíos de la lista
           │
           ▼
6. Click "Crear Ruta" → Usa flujo existente de creación de rutas
```

---

## Visualización en Otros Lugares

### Lista de Envíos (Shipments.tsx)

```text
┌──────────────────┬────────────────────────┬─────────────┐
│ Tracking         │ Destinatario           │ Estado      │
├──────────────────┼────────────────────────┼─────────────┤
│ SUC01-ENV-001    │ Juan Pérez             │ Pendiente   │
│ [📦 Andreani]    │                        │             │
│ AR123456789      │ María García           │ En Reparto  │
└──────────────────┴────────────────────────┴─────────────┘
```

### Detalle del Envío

Sección adicional mostrando:
- Empresa terciarizada
- Tracking externo (clickeable para rastrear)
- Código de cliente
- Código de orden

### Etiqueta de Impresión

Incluir ambos trackings:
```text
TRACKING INTERNO: SUC01-ENV-20260123-001
TRACKING EXTERNO: AR123456789 (Correo Argentino)
```

---

## Orden de Implementación

1. **Migración de base de datos** (agregar columnas nuevas)
2. **Componente ThirdPartyShipmentsTab.tsx** (nueva pestaña)
3. **Integrar pestaña en RoutePlanner.tsx**
4. **Actualizar visualización en Shipments.tsx**
5. **Actualizar ShipmentDetailsDialog.tsx**
6. **Actualizar PrintLabel.tsx**

