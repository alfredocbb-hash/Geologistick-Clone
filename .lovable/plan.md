

## Plan: Sistema de Administración Contable Inteligente

### Resumen
Implementar 4 módulos: Cola de facturación pendiente con facturación en lote, módulo de gastos, monitor de topes Monotributo, y reporte de IVA. Todo manual, sin automatización.

---

### 1. Migración de Base de Datos

**Crear tabla `gastos`**:
```sql
CREATE TABLE public.gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  proveedor TEXT NOT NULL,
  cuit_proveedor TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  importe_neto NUMERIC NOT NULL DEFAULT 0,
  iva NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  categoria TEXT NOT NULL DEFAULT 'otros',
  descripcion TEXT,
  numero_comprobante TEXT,
  tipo_comprobante TEXT DEFAULT 'factura_b',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
-- RLS: tenant isolation via current_user_tenant()
```

---

### 2. Página: Cola de Facturación (`/facturacion`)

**Archivo**: `src/pages/Facturacion.tsx`

- Consulta envíos con `estado = 'entregado'` que NO tienen factura asociada (LEFT JOIN o NOT EXISTS contra `facturas`).
- Tabla con checkbox para selección múltiple.
- Filtros por fecha y cliente.
- Botón **"Facturar en Lote"**: abre un dialog que pide datos fiscales del receptor (reutilizando la lógica de `InvoiceDataDialog`) y luego invoca `arca-factura` secuencialmente por cada envío seleccionado, mostrando progreso.
- Columnas: tracking, destinatario, fecha entrega, importe, ciudad.

---

### 3. Página: Gastos (`/gastos`)

**Archivo**: `src/pages/Gastos.tsx`

- CRUD completo con tabla filtrable por fecha y categoría.
- Dialog para crear/editar con campos: proveedor, CUIT, fecha, neto, IVA (auto-calcula 21%), total, categoría (select: Combustible, Repuestos, Peajes, Servicios, Sueldos, AWS/Tech, Seguros, Otros), descripción, nro comprobante.
- Botón exportar Excel (Libro IVA Compras).

---

### 4. Página: Panel Fiscal (`/fiscal`)

**Archivo**: `src/pages/FiscalDashboard.tsx`

**Cards resumen del mes actual:**
- Total Facturado (ventas): `SUM(importe_total)` de `facturas` con `estado='emitida'`.
- Total Gastos: `SUM(total)` de `gastos`.
- IVA Débito Fiscal vs IVA Crédito Fiscal → Saldo estimado a pagar.
- Estimación IIBB: 3.5% sobre ventas netas.

**Gráfico de Progreso Anual (Monotributo):**
- Barra de progreso que muestra facturación acumulada últimos 12 meses.
- Topes configurables por categoría (A: $2.108.288, B: $3.133.941, etc.).
- Alerta visual cuando se supera el 80% del tope.
- Indicador que dice "Te quedan $X antes de subir de categoría".

**Reporte IVA Digital:**
- Card informativa: "Este mes tenés acumulado $X de IVA Ventas y $Y de IVA Compras. Tu saldo estimado a pagar es $Z".

**Exportación:**
- Botón Libro IVA Ventas (Excel desde `facturas`).
- Botón Libro IVA Compras (Excel desde `gastos`).

---

### 5. Navegación y Routing

- Lazy imports en `App.tsx` para `Facturacion`, `Gastos`, `FiscalDashboard`.
- Rutas `/facturacion`, `/gastos`, `/fiscal` dentro de `DashboardLayout`.
- Items en `AppSidebar.tsx` en el grupo "Finanzas":
  - "Facturación" → `/facturacion` (icon: FileText)
  - "Gastos" → `/gastos` (icon: Receipt)
  - "Panel Fiscal" → `/fiscal` (icon: Calculator)
- Permission key: `cash.manage` (reutiliza el existente de finanzas).

---

### Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| Migración SQL | Crear tabla `gastos` + RLS |
| `src/pages/Facturacion.tsx` | Crear — cola de pendientes + lote |
| `src/pages/Gastos.tsx` | Crear — CRUD gastos |
| `src/pages/FiscalDashboard.tsx` | Crear — dashboard + monitor + IVA |
| `src/App.tsx` | Agregar 3 rutas lazy |
| `src/components/layout/AppSidebar.tsx` | Agregar 3 nav items en Finanzas |

