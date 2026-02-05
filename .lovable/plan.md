

# Plan: Corregir Cálculo de Porcentajes y Agregar "Cancelación de Remitos"

## Contexto de la Imagen MD Cargas

Basándome en la imagen de liquidación de MD Cargas que compartiste, identifico la siguiente estructura:

| Sección | Descripción |
|---------|-------------|
| **CONTADO (Facturas)** | Envíos pagados al momento de emisión |
| **PAGO EN DESTINO** | Envíos donde el destinatario paga al recibir |
| **CANCELACIÓN DE REMITOS** | Monto total cobrado por la sucursal al entregar envíos con Pago Destino |
| **CUENTA CORRIENTE** | Envíos facturados a clientes con crédito |

La "Cancelación de remitos" es clave: representa el dinero que la sucursal destino **cobró físicamente** cuando entregó paquetes con Pago Destino en sucursal.

---

## Problemas Identificados

### 1. Porcentaje Mostrado Incorrecto
El sistema guarda el porcentaje del **primer envío** que encuentra para cada concepto, en lugar de calcular el porcentaje efectivo real.

**Solución:** Calcular el porcentaje como `(Total Comisión / Total Ventas) × 100`

### 2. Conceptos Sin Configuración = 0% Silencioso
Si un concepto no tiene configuración en `sucursal_comisiones`, usa 0% sin advertir al usuario.

**Datos actuales en la base de datos:**
- Solo "Administración" tiene configuración de **recepción**
- Berazategui y Central Buenos Aires **NO tienen** configuración de recepción

**Solución:** Mostrar advertencia visual cuando hay conceptos sin configurar

### 3. Falta Sección "Cancelación de Remitos"
En la imagen de MD Cargas hay una sección separada que muestra el total de remitos cancelados (cobrados) por la sucursal.

**Solución:** Agregar una sección de resumen de "Cancelación de Remitos" que muestre cuántos envíos con Pago Destino fueron cobrados y el monto total.

---

## Cambios Propuestos

### Archivo 1: `src/components/settlements/ConceptBreakdownTable.tsx`

**Cambios:**
1. Calcular porcentaje efectivo en la tabla: `(comision / ventas) × 100`
2. Marcar conceptos con 0% y ventas > 0 como "sin config"
3. Agregar badge de advertencia para configuraciones faltantes

```tsx
// Calcular porcentaje efectivo real
const porcentajeEfectivo = c.ventas > 0 
  ? (c.comision / c.ventas) * 100 
  : 0;

// Mostrar advertencia si comisión es 0 pero hay ventas
{porcentajeEfectivo === 0 && c.ventas > 0 && (
  <span className="text-amber-500 text-xs ml-1 flex items-center gap-1">
    <AlertTriangle className="h-3 w-3" />
    sin config
  </span>
)}
```

### Archivo 2: `src/pages/BranchSettlements.tsx`

**Cambios en lógica de cálculo:**
1. Trackear conceptos sin configuración durante el cálculo
2. Agregar conteo de "Remitos Cancelados" (envíos pago destino entregados)
3. Pasar flag `sinConfiguracion` a cada concepto del resumen

**Nuevo estado:**
```typescript
interface CalculatedData {
  // ... campos existentes ...
  remitosCongelados: {
    cantidad: number;
    totalCobrado: number;
  };
  conceptosSinConfig: Array<{
    concepto: string;
    tipoPago: string;
    rol: string;
  }>;
}
```

**Cambios en UI:**
1. Mostrar tarjeta "Cancelación de Remitos" con cantidad y monto
2. Mostrar alerta amarilla si hay conceptos sin configurar
3. Agregar tooltip explicando qué configuración falta

**Nueva tarjeta de Cancelación de Remitos:**
```tsx
{calculatedData.remitosCongelados.cantidad > 0 && (
  <Card className="bg-blue-500/5 border-blue-500/20">
    <CardContent className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Receipt className="h-4 w-4 text-blue-500" />
        <span className="text-sm text-muted-foreground">
          Cancelación de Remitos
        </span>
      </div>
      <p className="text-2xl font-bold text-blue-500">
        {calculatedData.remitosCongelados.cantidad} remitos
      </p>
      <p className="text-sm text-muted-foreground">
        Total cobrado: ${calculatedData.remitosCongelados.totalCobrado.toFixed(2)}
      </p>
    </CardContent>
  </Card>
)}
```

**Alerta de configuraciones faltantes:**
```tsx
{calculatedData.conceptosSinConfig.length > 0 && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Configuración Incompleta</AlertTitle>
    <AlertDescription>
      Los siguientes conceptos no tienen comisión configurada:
      <ul className="mt-2 list-disc list-inside">
        {calculatedData.conceptosSinConfig.map((c, i) => (
          <li key={i}>{c.concepto} ({c.tipoPago} - {c.rol})</li>
        ))}
      </ul>
    </AlertDescription>
  </Alert>
)}
```

### Archivo 3: `src/components/settlements/SettlementDetailDialog.tsx`

**Cambios:**
1. Mostrar sección "Cancelación de Remitos" si está disponible
2. Mostrar advertencias de conceptos sin configurar si aplica

---

## Resultado Visual Esperado

### Después de Calcular

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Total Cobrado]    [Total Comisiones]   [Saldo]    [Cancelación Remitos]  │
│    $532,804.00         $40,729.39      $492,074.61      25 remitos         │
│                                                      ($1,527,462 cobrado)   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ ADVERTENCIA ───────────────────────────────────────────────────────────────┐
│ ⚠️ Los siguientes conceptos no tienen comisión configurada:                 │
│    • Servicio de Agencia (contado - emisión)                               │
│    • Traslado (destino - recepción)                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ RESUMEN POR CONCEPTO ──────────────────────────────────────────────────────┐
│  [Contado] [Pago Destino] [Cta. Cte.]                                      │
│                                                                             │
│  Concepto          │   Ventas    │  Comisión %  │  Total Comisión          │
│────────────────────│─────────────│──────────────│───────────────────       │
│  Flete             │  $350,503   │    10.00%    │     $35,050.39           │
│  Seguro            │   $56,790   │    10.00%    │      $5,679.00           │
│  Serv. Agencia     │   $30,451   │  ⚠️ sin config│         $0.00           │
│────────────────────│─────────────│──────────────│───────────────────       │
│  SUBTOTAL          │  $437,744   │              │     $40,729.39           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/settlements/ConceptBreakdownTable.tsx` | Calcular % efectivo, mostrar "sin config" |
| `src/pages/BranchSettlements.tsx` | Trackear conceptos sin config, agregar conteo remitos cancelados, mostrar alertas |
| `src/components/settlements/SettlementDetailDialog.tsx` | Mostrar info de remitos cancelados |

---

## Resultado Esperado

1. **Porcentajes precisos:** Mostrar el % real calculado de ventas/comisión
2. **Transparencia:** Identificar claramente conceptos sin configuración
3. **Cancelación de Remitos:** Mostrar cuántos y cuánto se cobró por pago destino
4. **Auditoría mejorada:** Poder verificar que cada concepto tiene el % correcto configurado

