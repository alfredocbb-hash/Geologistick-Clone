

## Plan: Corregir Sincronización AFIP + Módulo de Compras

### Problema 1: Timeout en sincronización
El PV 1 tiene 323 comprobantes (A:55 + B:268). La Edge Function consulta uno por uno vía SOAP y se excede del timeout de 60s.

**Solución**: Procesar en lotes más pequeños y agregar logging de progreso:
- Reducir el rango de búsqueda: en vez de los últimos 100, consultar solo los **faltantes** de forma más inteligente
- Agregar un parámetro `desde_numero` opcional para paginar manualmente
- Agregar un parámetro `tipo` para sincronizar de a un tipo por vez (A, B o C) en vez de los tres juntos
- Esto permite al usuario hacer: "Traer Tipo B del PV 1" sin cargar A y C

**Cambios en `supabase/functions/arca-factura/index.ts`**:
- Aceptar `tipo` (string) además de `tipos` (array)
- Aceptar `desde_numero` para limitar el rango
- Limitar a máximo 30 comprobantes por ejecución (en vez de 100) para evitar timeout
- Agregar logs de progreso: `[ARCA] Importando tipo B #45/268...`

**Cambios en `src/pages/Facturacion.tsx`**:
- En el dialog de sincronización, agregar un selector de tipo de comprobante (A, B, C o Todos)
- Mostrar un mensaje si se importaron menos del total sugiriendo volver a ejecutar
- Mostrar el resultado con detalle: "Importados: 30 de 268 tipo B. Ejecutar de nuevo para continuar."

### Problema 2: Facturas de Compra
WSFEv1 de AFIP solo permite consultar comprobantes **emitidos** (ventas). Las facturas de compra recibidas por Beraexpress no están disponibles por este servicio.

**Solución**: Agregar un módulo de "Compras / Gastos Fiscales" en el Panel Fiscal (`FiscalDashboard.tsx`):
- Una tabla manual donde se cargan las facturas de compra recibidas (proveedor, CUIT, tipo, monto, IVA)
- Requiere una nueva tabla `facturas_compra` en la base de datos
- Se integra con el reporte de IVA Digital existente como "IVA Crédito Fiscal"
- Para Responsable Inscripto esto es crítico: la posición de IVA = Débito (ventas) - Crédito (compras)

**Migración SQL**:
```sql
CREATE TABLE public.facturas_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  proveedor_nombre TEXT NOT NULL,
  proveedor_cuit TEXT,
  tipo_comprobante TEXT NOT NULL DEFAULT 'B',
  punto_venta INT,
  numero_comprobante INT,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  importe_neto NUMERIC(12,2) DEFAULT 0,
  importe_iva NUMERIC(12,2) DEFAULT 0,
  importe_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  categoria TEXT, -- ej: 'insumos', 'servicios', 'alquiler'
  notas TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.facturas_compra ENABLE ROW LEVEL SECURITY;
-- RLS: tenant isolation
```

**Nuevo componente en `FiscalDashboard.tsx`** (solo para Responsable Inscripto):
- Sección "Libro IVA Compras" con tabla de facturas recibidas
- Botón "Agregar Factura de Compra" con formulario
- El reporte de IVA Digital suma el IVA de compras como crédito fiscal

### Archivos a modificar/crear

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/arca-factura/index.ts` | Paginación: `tipo`, `desde_numero`, límite 30 |
| `src/pages/Facturacion.tsx` | Selector de tipo en dialog sync + mensaje paginación |
| Migración SQL | Crear tabla `facturas_compra` con RLS |
| `src/pages/FiscalDashboard.tsx` | Sección "Libro IVA Compras" para RI |

