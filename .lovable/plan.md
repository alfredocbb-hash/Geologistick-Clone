

## Plan: Agregar solapa "Empresas Asociadas" en Liquidaciones Terciarizados

### Objetivo
Agregar una tercera solapa en `/settlements/third-party` para calcular, generar, pagar y cancelar liquidaciones de empresas asociadas (partners). El cálculo usa los porcentajes de comisión por concepto configurados en `partner_comisiones`, similar a las liquidaciones de sucursales.

---

### 1. Migración: Tabla `liquidaciones_partner` + detalles

```sql
CREATE TABLE public.liquidaciones_partner (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES public.tenant_partners(id) ON DELETE CASCADE,
  partner_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  monto_total NUMERIC DEFAULT 0,
  monto_comision NUMERIC DEFAULT 0,
  cantidad_envios INT DEFAULT 0,
  estado TEXT DEFAULT 'generada',
  notas TEXT,
  metodo_pago TEXT,
  referencia_pago TEXT,
  fecha_pago TIMESTAMPTZ,
  generado_por UUID,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.liquidacion_partner_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacion_id UUID NOT NULL REFERENCES public.liquidaciones_partner(id) ON DELETE CASCADE,
  envio_id UUID REFERENCES public.envios(id),
  concepto_id UUID REFERENCES public.tarifa_conceptos(id),
  monto_envio NUMERIC DEFAULT 0,
  porcentaje_comision NUMERIC DEFAULT 0,
  monto_comision NUMERIC DEFAULT 0,
  tipo_pago TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Con RLS basada en `tenant_id` del usuario autenticado y policies para select/insert/update/delete.

---

### 2. Modificar `src/pages/ThirdPartySettlements.tsx`

Agregar una tercera solapa **"Empresas Asociadas"** (ícono `Handshake`) en el `TabsList` existente:

- **Selector de partner**: lista de partnerships activas (desde `tenant_partners` + nombre del partner)
- **Rango de fechas** + botón **Calcular**
- **Lógica de cálculo**:
  1. Obtener envíos derivados al partner (via `partner_shipments` donde `tenant_destino_id` = partner y `estado_sync = 'accepted'`)
  2. Para cada envío, obtener `envio_detalles` con conceptos
  3. Aplicar los porcentajes de `partner_comisiones` según `tipo_pago` (contado/destino/cta_cte) y `concepto_id`
  4. Calcular comisión total = suma de (monto_concepto × porcentaje / 100)
- **Tabla de resultados** con tracking, destinatario, monto, comisión calculada
- **Botón "Generar Liquidación"** que inserta en `liquidaciones_partner` + `liquidacion_partner_detalles`
- **Historial** con acciones: ver detalle, pagar, cancelar, descargar PDF

Dado que el archivo ya es grande (~1019 líneas), la lógica de la solapa de partners se extraerá a un componente separado.

---

### 3. Nuevo componente `src/components/settlements/PartnerSettlementsTab.tsx`

Componente independiente que recibe `profile` y contiene:
- Estado local (partner seleccionado, fechas, envíos calculados, diálogos)
- Queries: partnerships activas, liquidaciones del partner, partner_comisiones
- Mutations: calcular, generar, pagar, cancelar
- UI: calculadora + historial (mismo patrón que la solapa de Liquidaciones terciarizados)

---

### 4. Nuevo diálogo `src/components/settlements/PartnerSettlementDetailDialog.tsx`

Similar a `ThirdPartySettlementDetailDialog`, con:
- Resumen (monto total, comisión, cantidad envíos, estado)
- Tabla de envíos con desglose por concepto y porcentaje aplicado
- Acciones de impresión y PDF

---

### 5. PDF de liquidación partner

Agregar función `downloadPartnerSettlementPDF` en `src/lib/generateSettlementPDF.ts` (o archivo nuevo), que genera un PDF con:
- Datos del partner (nombre)
- Período, totales, desglose por concepto
- Tabla de envíos con comisiones

---

### Resumen de archivos

| Archivo | Acción |
|---------|--------|
| Migración SQL | Crear `liquidaciones_partner` + `liquidacion_partner_detalles` |
| `ThirdPartySettlements.tsx` | Agregar tab "Empresas Asociadas" que renderiza el nuevo componente |
| `PartnerSettlementsTab.tsx` | **Nuevo** - lógica completa de la solapa |
| `PartnerSettlementDetailDialog.tsx` | **Nuevo** - diálogo de detalle |
| `generateSettlementPDF.ts` | Agregar `downloadPartnerSettlementPDF` |

