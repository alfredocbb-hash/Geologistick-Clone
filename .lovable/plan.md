

# Plan: Desglose por Concepto en Liquidaciones de Sucursal

## Problema Actual

La pantalla de liquidaciones muestra los envíos de forma individual pero no desglosa los conceptos de tarifa (Flete, Seguro, Retiro, Entrega, etc.) ni permite verificar si las comisiones se estan calculando correctamente por cada concepto.

| Vista Actual | Vista Objetivo (como MD Cargas) |
|--------------|--------------------------------|
| Solo lista envíos con monto total | Desglose por concepto con Ventas, % Comision y Total Comision |
| Comision unica por envio | Comision separada por cada concepto |
| No hay resumen por categorias | Separado por Facturas (Contado), Pagos Destino, Cta Cte |

## Solucion Propuesta

### Parte 1: Mejorar el Calculo para Guardar Desglose por Concepto

Modificar la logica de calculo en `BranchSettlements.tsx` para:

1. **Almacenar comision por concepto** - Guardar en `calculatedData` el desglose de cada concepto con su venta y comision calculada
2. **Separar por categoria de pago** - Agrupar envios por tipo_pago (contado, destino, cta_cte)

### Parte 2: Nueva Vista de Resumen por Concepto

Agregar una nueva seccion en la pantalla de calculo que muestre el desglose similar a MD Cargas:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  RESUMEN POR CONCEPTO                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ CONTADO (Facturas) ────────────────────────────────────────────────┐   │
│  │  Concepto          │   Ventas    │  Comision %  │  Total Comision   │   │
│  │────────────────────│─────────────│──────────────│───────────────────│   │
│  │  Flete             │  $350,503   │    10.00%    │     $35,050.39    │   │
│  │  Seguro            │   $56,790   │    10.00%    │      $5,679.00    │   │
│  │  Retiro Domicilio  │   $16,600   │     0.00%    │          $0.00    │   │
│  │  Entrega Domicilio │   $54,000   │     0.00%    │          $0.00    │   │
│  │  Serv. Agencia     │   $30,451   │    99.99%    │          $0.00    │   │
│  │  Transporte        │   $24,460   │     0.00%    │          $0.00    │   │
│  │────────────────────│─────────────│──────────────│───────────────────│   │
│  │  SUBTOTAL          │  $532,804   │              │     $40,729.39    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ PAGO EN DESTINO ───────────────────────────────────────────────────┐   │
│  │  Concepto          │   Ventas    │  Comision %  │  Total Comision   │   │
│  │────────────────────│─────────────│──────────────│───────────────────│   │
│  │  Flete             │$1,527,462   │    20.00%    │    $305,492.55    │   │
│  │  Seguro            │   $82,000   │    20.00%    │     $16,400.00    │   │
│  │  ...               │             │              │                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ CUENTA CORRIENTE ──────────────────────────────────────────────────┐   │
│  │  (misma estructura)                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Parte 3: Actualizar Modelo de Datos

Actualmente `liquidacion_sucursal_detalles` guarda solo `monto_envio` y `comision_aplicada` por envio. Necesitamos una tabla adicional o una columna JSON para almacenar el desglose por concepto:

**Opcion A (recomendada):** Agregar columna `desglose_conceptos` tipo JSONB en `liquidacion_sucursal_detalles`:
```json
{
  "flete": { "venta": 5000, "porcentaje": 25, "comision": 1250 },
  "seguro": { "venta": 300, "porcentaje": 10, "comision": 30 },
  ...
}
```

**Opcion B:** Nueva tabla `liquidacion_sucursal_concepto_detalle` relacionada.

---

## Detalles Tecnicos

### Archivo 1: `src/pages/BranchSettlements.tsx`

**Cambios en la estructura de datos calculados:**

```typescript
interface ConceptoResumen {
  concepto_id: string;
  nombre: string;
  ventas: number;
  porcentaje: number;
  comision: number;
}

interface ResumenPorTipoPago {
  contado: ConceptoResumen[];
  destino: ConceptoResumen[];
  cta_cte: ConceptoResumen[];
}

// En calculatedData agregar:
resumenConceptos: ResumenPorTipoPago;
```

**Modificar calculateMutation:**

1. Traer nombres de conceptos con `tarifa_conceptos`
2. Acumular ventas y comisiones por concepto separado por tipo_pago
3. Retornar estructura adicional `resumenConceptos`

**Agregar nueva seccion en UI:**

Debajo de las tarjetas de resumen (Total Cobrado, Total Comisiones, Saldo a Transferir), agregar un Tabs o Accordion con el desglose:

```tsx
<Tabs defaultValue="contado">
  <TabsList>
    <TabsTrigger value="contado">Contado</TabsTrigger>
    <TabsTrigger value="destino">Pago Destino</TabsTrigger>
    <TabsTrigger value="cta_cte">Cta Cte</TabsTrigger>
  </TabsList>
  <TabsContent value="contado">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Concepto</TableHead>
          <TableHead className="text-right">Ventas</TableHead>
          <TableHead className="text-right">Comision %</TableHead>
          <TableHead className="text-right">Total Comision</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resumenConceptos.contado.map(c => (...))}
      </TableBody>
    </Table>
  </TabsContent>
  ...
</Tabs>
```

### Archivo 2: Migracion SQL (opcional pero recomendado)

Agregar columna para persistir el desglose:

```sql
ALTER TABLE liquidacion_sucursal_detalles 
ADD COLUMN desglose_conceptos JSONB DEFAULT '{}';
```

### Archivo 3: `src/components/settlements/SettlementDetailDialog.tsx`

Actualizar el dialog de detalle para mostrar el desglose por concepto cuando esta disponible.

---

## Flujo de Datos

```text
1. Usuario selecciona sucursal y periodo → Clic "Calcular"
   ↓
2. Query trae envios con envio_detalles (conceptos individuales)
   ↓
3. Query trae sucursal_comisiones (% por concepto y tipo_rol)
   ↓
4. Para cada envio:
   - Determinar si es origen (emision) o destino (recepcion)
   - Para cada concepto en envio_detalles:
     - Buscar config de comision para ese concepto
     - Calcular comision individual
     - Acumular en resumenConceptos por tipo_pago
   ↓
5. Mostrar:
   - Totales consolidados (como ahora)
   - NUEVO: Desglose por concepto en tabs por tipo_pago
   - Lista de envios (como ahora)
   ↓
6. Al guardar: almacenar desglose en JSONB para auditoria
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/BranchSettlements.tsx` | Logica de calculo mejorada + UI de desglose por concepto |
| Migracion SQL | Nueva columna JSONB para desglose (opcional) |
| `src/components/settlements/SettlementDetailDialog.tsx` | Mostrar desglose guardado |

---

## Resultado Esperado

1. Al calcular liquidacion, se muestra tabla con desglose por concepto
2. Separado por tipo de pago (Contado, Destino, Cta Cte)
3. Cada concepto muestra: Ventas totales, % Comision aplicado, Total Comision
4. Se puede verificar que los porcentajes configurados coinciden con los montos calculados
5. El PDF de liquidacion incluye el desglose para auditoria

