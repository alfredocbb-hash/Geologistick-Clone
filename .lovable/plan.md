
# Plan: Opción para Multiplicar Flete Base por Bultos

## Resumen

Agregar una opción configurable a cada tarifa que permita decidir si el flete base se debe multiplicar por la cantidad de bultos. Esto da flexibilidad para que cada empresa configure si cobra flete por envío o por bulto.

---

## Cambios Necesarios

### 1. Migración de Base de Datos

Agregar columna `multiplicar_flete_por_bultos` a la tabla `tarifas`:

```sql
ALTER TABLE tarifas 
ADD COLUMN IF NOT EXISTS multiplicar_flete_por_bultos boolean DEFAULT false;

COMMENT ON COLUMN tarifas.multiplicar_flete_por_bultos IS 
  'Si es true, el flete base se multiplica por la cantidad de bultos del envío';
```

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `multiplicar_flete_por_bultos` | boolean | false | El flete se cobra por envío (false) o por bulto (true) |

---

### 2. Actualizar Interface y Formulario de Tarifas

En `src/pages/Rates.tsx`:

**Modificar la interface `Tarifa`:**
```typescript
interface Tarifa {
  // ... campos existentes ...
  multiplicar_flete_por_bultos: boolean | null;
}
```

**Agregar campo al formulario:**
```typescript
const [formData, setFormData] = useState({
  // ... campos existentes ...
  multiplicar_flete_por_bultos: false,
});
```

**Agregar Switch en el formulario (después del precio base):**
```tsx
<div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
  <div>
    <Label className="font-medium">Multiplicar flete por bultos</Label>
    <p className="text-xs text-muted-foreground">
      Si está activo, el flete base se multiplica por la cantidad de bultos
    </p>
  </div>
  <Switch
    checked={formData.multiplicar_flete_por_bultos}
    onCheckedChange={(checked) => 
      setFormData({ ...formData, multiplicar_flete_por_bultos: checked })
    }
  />
</div>
```

**Actualizar la mutación de guardado:**
```typescript
const tarifaData = {
  // ... otros campos ...
  multiplicar_flete_por_bultos: data.multiplicar_flete_por_bultos,
};
```

---

### 3. Aplicar Lógica en Cálculo de Flete (NewShipment.tsx)

Modificar el `useMemo` que calcula `fleteCalculado`:

**Antes:**
```typescript
return {
  fleteCalculado: flete,
  fleteDescripcion: 'Precio base',
  metodoAplicado: 'base'
};
```

**Después:**
```typescript
const cantidadBultos = parseInt(formData.cantidad_bultos) || 1;
const multiplicar = selectedTarifa.multiplicar_flete_por_bultos === true;
const fleteTotal = multiplicar && cantidadBultos > 1 ? flete * cantidadBultos : flete;

return {
  fleteCalculado: fleteTotal,
  fleteDescripcion: multiplicar && cantidadBultos > 1 
    ? `${metodo} × ${cantidadBultos} bultos` 
    : metodo,
  metodoAplicado: metodoAplicado,
  multiplicadoPorBultos: multiplicar && cantidadBultos > 1
};
```

**Actualizar la UI del resumen para mostrar cuando aplica:**
```tsx
<div className="flex justify-between items-center">
  <span className="text-muted-foreground">
    Flete ({fleteDescripcion})
    {metodoAplicado.multiplicadoPorBultos && (
      <span className="text-xs text-amber-600 ml-1">(×{cantidadBultos})</span>
    )}
  </span>
  <span>${fleteCalculado.toLocaleString('es-AR')}</span>
</div>
```

---

### 4. Actualizar Edge Function (tiendanube-shipping-rates)

Modificar para considerar la nueva columna:

```typescript
// En la consulta de tarifa
.select("id, nombre, precio_base, tipo_tarifa, rangos_precios, multiplicar_flete_por_bultos")

// En la función calculateRate
function calculateRate(
  tarifa: TarifaData,
  totalWeight: number,
  conceptos: Array<{ monto: number; concepto: unknown }>,
  itemCount: number = 1 // Nuevo parámetro
): number {
  let precio = Number(tarifa.precio_base) || 0;
  
  // Multiplicar por cantidad de items si está configurado
  if (tarifa.multiplicar_flete_por_bultos && itemCount > 1) {
    precio *= itemCount;
  }
  
  // ... resto del cálculo igual ...
}
```

---

### 5. Mostrar en Tarjeta de Tarifa

Agregar badge visual cuando la opción está activa:

```tsx
{tarifa.multiplicar_flete_por_bultos && (
  <Badge variant="outline" className="text-xs gap-1">
    <Package className="h-3 w-3" />
    ×Bultos
  </Badge>
)}
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Agregar columna `multiplicar_flete_por_bultos` |
| `src/pages/Rates.tsx` | Interface, formulario, card UI |
| `src/pages/NewShipment.tsx` | Lógica de cálculo y display |
| `supabase/functions/tiendanube-shipping-rates/index.ts` | Considerar el flag en cotización |
| `src/lib/generateRatesGuidePDF.ts` | Documentar la nueva opción |

---

## Flujo de Uso

```text
┌─────────────────────────────────────────────────────────────┐
│                  CONFIGURACIÓN DE TARIFA                     │
├─────────────────────────────────────────────────────────────┤
│  Flete Base: $5,000                                         │
│                                                             │
│  [x] Multiplicar flete por bultos                           │
│      Si está activo, el flete base se multiplica            │
│      por la cantidad de bultos del envío                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 AL CREAR ENVÍO (3 bultos)                   │
├─────────────────────────────────────────────────────────────┤
│  Flete (Precio base × 3 bultos)................ $15,000     │
│  Entrega a domicilio...........................  $1,500     │
│  ─────────────────────────────────────────────────────────  │
│  TOTAL......................................... $16,500     │
└─────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

- **Sin la opción activada (default)**: El flete se cobra una vez por envío, sin importar cuántos bultos tenga
- **Con la opción activada**: El flete se multiplica por la cantidad de bultos
- Los conceptos adicionales mantienen su propia configuración de `multiplicar_por_bultos`
- La información es clara y visible tanto en la configuración como en el resumen del envío
