
# Diagnóstico y corrección definitiva de la facturación ARCA

## Situación actual (evidencia de la base de datos)

Todos los intentos de facturación muestran exactamente el mismo patrón de datos erróneo:

```
importe_total = 7221.98
importe_neto  = 7221.98   ← Igual al total (INCORRECTO)
importe_iva   = 0.00      ← IVA cero (INCORRECTO)
```

Esto provoca dos errores consecutivos de AFIP:
1. `"Si ImpNeto es mayor a 0 el objeto IVA es obligatorio"` — porque se envía neto > 0 sin bloque IVA
2. `"Si ImpNeto es mayor a 0, el objeto AlicIva es obligatorio y no debe ser nulo"` — porque el bloque IVA se incluye pero con importe = 0

## Causa raíz: tres bugs encadenados

### Bug 1 — El cálculo de importeNeto/importeIva produce IVA = 0

El código dice:
```typescript
importeNeto = Math.round((total / 1.21) * 100) / 100;  // 7221.98 / 1.21 = 5969.40
importeIva  = Math.round((total - importeNeto) * 100) / 100;  // 7221.98 - 5969.40 = 1252.58
```

Debería producir neto=5969.40 e iva=1252.58, pero la DB muestra iva=0.00 y neto=7221.98. Esto indica que **el edge function desplegado ejecuta una versión anterior** donde `importeNeto = total` e `importeIva = 0`, que era el comportamiento antes de las últimas correcciones. El deploy más reciente no se aplicó correctamente o hay un error de caché.

### Bug 2 — Condición del bloque `<ar:Iva>` en el SOAP XML

El XML usa:
```typescript
${importeNeto > 0 ? `<ar:Iva>${ivaAlicuota}</ar:Iva>` : ''}
```

Pero la condición correcta debería ser `importeIva > 0` (no `importeNeto > 0`). Si `importeIva = 0`, se incluye un bloque `<ar:Iva>` con `<Importe>0.00</Importe>`, lo que AFIP rechaza con el segundo error.

### Bug 3 — ImpNeto e ImpIVA matemáticamente inconsistentes para Sandbox

En entorno Sandbox, AFIP valida matemáticamente que `ImpNeto + ImpIVA = ImpTotal`. Si se envía neto=7221.98, iva=0, total=7221.98, la suma cuadra pero AFIP exige que si hay IVA declarado el bloque AlicIva sea correcto.

Para Factura B (emisor responsable inscripto + consumidor final), AFIP acepta el bloque IVA con la alícuota correspondiente. La solución es:
- `ImpTotal = total` (precio con IVA incluido)  
- `ImpNeto = total / 1.21` (base imponible)
- `ImpIVA = ImpTotal - ImpNeto` (IVA)
- Enviar `<AlicIva><Id>5</Id><BaseImp>ImpNeto</BaseImp><Importe>ImpIVA</Importe></AlicIva>`
- Solo omitir el bloque `<ar:Iva>` si `ImpIVA <= 0`

## Correcciones a implementar en `supabase/functions/arca-factura/index.ts`

### Corrección 1 — Recalcular importeNeto e importeIva con precisión garantizada

Reemplazar el cálculo actual con una versión que garantice coherencia matemática entre los tres valores que AFIP recibe:

```typescript
// Total con IVA incluido (precio final)
const importeTotal = total;

// Base imponible (sin IVA): total / 1.21
// Usar enteros para evitar errores de punto flotante
const importeNetoRaw = total / 1.21;
const importeNeto = Math.round(importeNetoRaw * 100) / 100;

// IVA = diferencia exacta para que ImpNeto + ImpIVA = ImpTotal exactamente
const importeIva = Math.round((total - importeNeto) * 100) / 100;

// Ajustar ImpTotal para compensar redondeo: ImpNeto + ImpIVA debe ser = ImpTotal
// AFIP valida: ImpNeto + ImpOpEx + ImpIVA + ImpTrib + ImpTotConc = ImpTotal
const importeTotalAjustado = Math.round((importeNeto + importeIva) * 100) / 100;
```

### Corrección 2 — Guardar `fecha_emision` en la tabla `facturas`

La tabla `facturas` tiene un campo `fecha_emision` pero `createFacturaRecord` no lo está seteando. AFIP usa la fecha actual para validar el comprobante. Agregar `fecha_emision: new Date().toISOString().split('T')[0]` al insertData.

### Corrección 3 — Corregir condición del bloque `<ar:Iva>` en el SOAP

Cambiar la condición de `importeNeto > 0` a `importeIva > 0.005` para que el bloque de IVA solo se incluya cuando realmente hay IVA positivo a declarar:

```typescript
// ANTES (incorrecto — incluye bloque IVA aunque importe sea 0):
${importeNeto > 0 ? `<ar:Iva>${ivaAlicuota}</ar:Iva>` : ''}

// DESPUÉS (correcto — solo incluye bloque IVA si hay IVA real):
${importeIva > 0.005 ? `<ar:Iva>${ivaAlicuota}\n            </ar:Iva>` : ''}
```

### Corrección 4 — Forzar refactoring completo del cálculo IVA en el handler principal

Consolidar todos los cálculos en un único bloque documentado antes de pasarlos a las funciones, eliminando cualquier posibilidad de valores inconsistentes:

```typescript
// ── Desglose fiscal ──────────────────────────────────────────────
// total = precio con IVA incluido (21%)
// Para Factura A: receptor es RI, se factura con IVA discriminado
// Para Factura B/C: consumidores finales o monotributistas, IVA incluido
// AFIP exige siempre el desglose aunque el receptor sea CF
const importeTotal = Math.round(total * 100) / 100;
const importeNeto  = Math.round((importeTotal / 1.21) * 100) / 100;
const importeIva   = Math.round((importeTotal - importeNeto) * 100) / 100;

console.log(`[ARCA] Desglose fiscal: total=${importeTotal}, neto=${importeNeto}, iva=${importeIva}`);
// Validar coherencia (AFIP rechaza si no cuadra)
if (Math.abs(importeNeto + importeIva - importeTotal) > 0.02) {
  console.error('[ARCA] WARN: Discrepancia en desglose IVA', { importeTotal, importeNeto, importeIva });
}
```

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/arca-factura/index.ts` | Corregir cálculo IVA (bug 1), condición del bloque XML (bug 2), agregar fecha_emision al insert (bug 3), y forzar redeploy |

## Resultado esperado

- `importe_neto = 5969.40` (total / 1.21)
- `importe_iva = 1252.58` (total - neto)  
- SOAP XML incluye `<AlicIva><Id>5</Id><BaseImp>5969.40</BaseImp><Importe>1252.58</Importe></AlicIva>` correctamente
- AFIP acepta el comprobante y devuelve CAE

## Nota sobre entorno Sandbox vs. Producción

El entorno Sandbox de AFIP está configurado y la autenticación WSAA funciona correctamente (el test de conexión es exitoso). Los errores son exclusivamente de validación del comprobante, no de conectividad. Una vez corregido el desglose IVA, el flujo completo debería funcionar.
