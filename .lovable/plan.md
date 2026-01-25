

# Plan: Sistema de Liquidaciones Periodicas para Sellers

## Resumen

Implementar un sistema completo de liquidaciones para sellers e-commerce, similar al existente para choferes. El sistema permitira agrupar movimientos de cuenta corriente en periodos formales, generar reportes PDF, y gestionar el flujo de pago.

## Arquitectura Propuesta

```text
+-------------------+         +-------------------+         +-------------------+
| ecommerce_sellers |  <-->   | liquidaciones_    |   <-->  | seller_cuenta_    |
|                   |         | seller            |         | corriente         |
|-------------------|         |-------------------|         |-------------------|
| id                |-------->| seller_id (FK)    |<--------| liquidacion_id    |
| saldo_cta_cte     |         | periodo_inicio    |         | monto             |
| tiene_cta_cte     |         | periodo_fin       |         | tipo              |
+-------------------+         | total_cargos      |         +-------------------+
                              | total_pagos       |
                              | saldo_liquidacion |
                              | estado            |
                              | fecha_pago        |
                              +-------------------+
```

---

## Cambios en Base de Datos

### Nueva Tabla: liquidaciones_seller

```sql
CREATE TABLE public.liquidaciones_seller (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES ecommerce_sellers(id) ON DELETE CASCADE NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  total_cargos NUMERIC DEFAULT 0,      -- Suma de cargos en el periodo
  total_pagos NUMERIC DEFAULT 0,       -- Suma de pagos registrados
  saldo_periodo NUMERIC DEFAULT 0,     -- total_cargos - total_pagos
  saldo_anterior NUMERIC DEFAULT 0,    -- Saldo al inicio del periodo
  saldo_final NUMERIC DEFAULT 0,       -- Saldo al cierre
  cantidad_movimientos INTEGER DEFAULT 0,
  estado TEXT DEFAULT 'generada',      -- generada, aprobada, pagada, cancelada
  notas TEXT,
  metodo_pago TEXT,
  referencia_pago TEXT,
  fecha_pago TIMESTAMPTZ,
  generado_por UUID REFERENCES auth.users(id),
  aprobado_por UUID REFERENCES auth.users(id),
  tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agregar columna a seller_cuenta_corriente para vincular movimientos
ALTER TABLE public.seller_cuenta_corriente 
ADD COLUMN liquidacion_id UUID REFERENCES liquidaciones_seller(id);
```

### Politicas RLS

```sql
-- Ver liquidaciones de su tenant
CREATE POLICY "Ver liquidaciones seller" ON liquidaciones_seller
FOR SELECT USING (
  tenant_id = current_user_tenant() 
  OR is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM ecommerce_sellers es WHERE es.id = seller_id AND es.user_id = auth.uid())
);

-- Crear liquidaciones (admins)
CREATE POLICY "Crear liquidaciones seller" ON liquidaciones_seller
FOR INSERT WITH CHECK (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor')
);

-- Actualizar liquidaciones (admins)
CREATE POLICY "Actualizar liquidaciones seller" ON liquidaciones_seller
FOR UPDATE USING (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor')
);

-- Eliminar solo si no esta pagada
CREATE POLICY "Eliminar liquidaciones seller" ON liquidaciones_seller
FOR DELETE USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'))
  AND estado <> 'pagada'
  AND tenant_id = current_user_tenant()
);
```

---

## Flujo de Liquidacion

```text
1. Admin selecciona Seller y rango de fechas
   |
   v
2. Sistema calcula:
   - Movimientos (cargos, pagos, ajustes) en el periodo
   - Saldo anterior (inicio del periodo)
   - Saldo final proyectado
   |
   v
3. Admin revisa y ajusta si es necesario
   |
   v
4. "Generar Liquidacion":
   - Crea registro en liquidaciones_seller
   - Vincula movimientos del periodo (liquidacion_id)
   |
   v
5. Estados de la liquidacion:
   +---> generada: Creada, pendiente de revision
   +---> aprobada: Revisada y lista para pago
   +---> pagada: Pago registrado con metodo y referencia
   +---> cancelada: Anulada (libera movimientos)
```

---

## Componentes UI

### Pagina Principal: Settlements.tsx (Mejorada)

Agregar una tercera tab "Liquidaciones" con:

| Seccion | Descripcion |
|---------|-------------|
| Calculadora | Selector de seller, rango de fechas, boton calcular |
| Vista Previa | Tabla de movimientos del periodo, totales |
| Historial | Tabla de liquidaciones generadas con acciones |

### Nuevo: GenerarLiquidacionSellerDialog

Similar a DriverSettlements pero adaptado para sellers:
- Muestra movimientos del periodo seleccionado
- Calcula totales (cargos, pagos, saldo)
- Permite agregar notas
- Genera la liquidacion

### Nuevo: LiquidacionSellerDetailDialog

Dialog para ver detalle de liquidacion:
- Resumen con totales
- Lista de movimientos incluidos
- Info de pago si esta pagada
- Botones: Imprimir, Descargar PDF

### Actualizar: generateSettlementPDF.ts

Agregar funcion `downloadSellerSettlementPDF` para generar PDF con formato:
- Datos del seller
- Periodo
- Tabla de movimientos (cargo/pago/ajuste)
- Totales y saldo

---

## Estructura del Codigo

### Archivos a Crear

| Archivo | Descripcion |
|---------|-------------|
| `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx` | Dialog de detalle de liquidacion |

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/ecommerce/Settlements.tsx` | Agregar tab "Liquidaciones" con calculadora y historial |
| `src/lib/generateSettlementPDF.ts` | Agregar soporte para tipo 'seller' y funcion downloadSellerSettlementPDF |

---

## Logica de Calculo

### Buscar Movimientos

```typescript
const { data: movimientos } = await supabase
  .from('seller_cuenta_corriente')
  .select('*')
  .eq('seller_id', selectedSeller)
  .gte('created_at', fechaInicio)
  .lte('created_at', fechaFin + 'T23:59:59')
  .is('liquidacion_id', null)  // Solo movimientos no liquidados
  .order('created_at');
```

### Calcular Totales

```typescript
const totalCargos = movimientos
  .filter(m => m.tipo === 'cargo')
  .reduce((sum, m) => sum + m.monto, 0);

const totalPagos = movimientos
  .filter(m => m.tipo === 'pago')
  .reduce((sum, m) => sum + Math.abs(m.monto), 0);

const totalAjustes = movimientos
  .filter(m => m.tipo === 'ajuste')
  .reduce((sum, m) => sum + m.monto, 0);

const saldoPeriodo = totalCargos - totalPagos + totalAjustes;
```

### Generar Liquidacion

```typescript
// 1. Crear liquidacion
const { data: liquidacion } = await supabase
  .from('liquidaciones_seller')
  .insert({
    seller_id: selectedSeller,
    periodo_inicio: fechaInicio,
    periodo_fin: fechaFin,
    total_cargos: totalCargos,
    total_pagos: totalPagos,
    saldo_periodo: saldoPeriodo,
    saldo_anterior: movimientos[0]?.saldo_anterior || 0,
    saldo_final: seller.saldo_cuenta_corriente,
    cantidad_movimientos: movimientos.length,
    estado: 'generada',
    notas,
    generado_por: user.id,
    tenant_id: profile.tenant_id,
  })
  .select()
  .single();

// 2. Vincular movimientos a la liquidacion
const movimientoIds = movimientos.map(m => m.id);
await supabase
  .from('seller_cuenta_corriente')
  .update({ liquidacion_id: liquidacion.id })
  .in('id', movimientoIds);
```

---

## Tabla de Historial de Liquidaciones

| Columna | Descripcion |
|---------|-------------|
| Periodo | DD/MM - DD/MM/YYYY |
| Seller | Nombre del seller |
| Cargos | Total de cargos |
| Pagos | Total de pagos |
| Saldo | Diferencia |
| Estado | Badge con estado |
| Acciones | Ver, PDF, Aprobar, Pagar, Cancelar |

---

## Integracion con PDF

### Nuevo tipo en generateSettlementPDF

```typescript
type: 'branch' | 'driver' | 'seller'
```

### Funcion downloadSellerSettlementPDF

```typescript
export async function downloadSellerSettlementPDF(liquidacion: {
  id: string;
  seller_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  total_cargos: number | null;
  total_pagos: number | null;
  saldo_periodo: number | null;
  estado: string | null;
  notas: string | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  seller?: { nombre: string };
}): Promise<void> {
  // Fetch movimientos vinculados
  const { data: movimientos } = await supabase
    .from('seller_cuenta_corriente')
    .select('*')
    .eq('liquidacion_id', liquidacion.id)
    .order('created_at');

  // Generar PDF con formato seller
  generateSettlementPDF({
    type: 'seller',
    settlement: { ... },
    entityName: liquidacion.seller?.nombre || '',
    totals: {
      totalCargos: liquidacion.total_cargos,
      totalPagos: liquidacion.total_pagos,
      saldo: liquidacion.saldo_periodo,
      cantidadMovimientos: movimientos.length,
    },
    items: movimientos.map(m => ({
      fecha: format(new Date(m.created_at), 'dd/MM/yy'),
      tipo: m.tipo,
      descripcion: m.descripcion || '-',
      monto: m.monto,
    })),
  });
}
```

---

## Estados y Transiciones

```text
             +----------+
             | generada |
             +----+-----+
                  |
        +---------+---------+
        |                   |
        v                   v
   +----------+      +------------+
   | aprobada |      | cancelada  |
   +----+-----+      +------------+
        |
        v
   +----------+
   |  pagada  |
   +----------+
```

### Acciones por Estado

| Estado | Acciones Disponibles |
|--------|---------------------|
| generada | Ver, PDF, Aprobar, Cancelar |
| aprobada | Ver, PDF, Pagar, Cancelar |
| pagada | Ver, PDF |
| cancelada | Ver (solo historico) |

---

## Consideraciones

1. **Movimientos no duplicados**: Solo se pueden incluir movimientos que no esten ya vinculados a otra liquidacion
2. **Cancelacion libera movimientos**: Al cancelar una liquidacion, se desvinculan los movimientos (liquidacion_id = null) para poder incluirlos en una nueva
3. **Acceso seller**: Los sellers pueden ver sus propias liquidaciones desde el Portal de Sellers pero no pueden crearlas ni modificarlas
4. **Tenant isolation**: Todas las queries filtran por tenant_id
5. **PDF oficial**: El PDF sirve como comprobante formal de la liquidacion

---

## Orden de Implementacion

1. Crear migracion SQL para `liquidaciones_seller` y agregar columna `liquidacion_id` a `seller_cuenta_corriente`
2. Actualizar `Settlements.tsx` con la tab "Liquidaciones"
3. Implementar logica de calculo y generacion
4. Crear `SellerLiquidacionDetailDialog.tsx`
5. Agregar funciones PDF en `generateSettlementPDF.ts`
6. Testing del flujo completo

---

## Resultado Esperado

Despues de implementar:
- Admins pueden generar liquidaciones periodicas para cualquier seller
- Cada liquidacion agrupa movimientos del periodo y calcula totales
- Se puede aprobar y registrar el pago con metodo y referencia
- PDFs oficiales disponibles para descargar
- Los sellers pueden ver sus liquidaciones en el portal
- Historial completo de liquidaciones por seller

