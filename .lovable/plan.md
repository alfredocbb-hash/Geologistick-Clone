

## Plan: Separar comisiones por rol (Emisión/Recepción) en UI y PDF

### Problema

Las comisiones de emisión y recepción se acumulan bajo el mismo concepto. "Flete - Contado" muestra un total combinado cuando deberían ser filas separadas: "Flete (Emisión)" y "Flete (Recepción)".

### Cambios

**`src/pages/BranchSettlements.tsx`** — Modificar `calcularComisionConcepto` (~línea 404):

1. Cambiar la clave de acumulación de `conceptoKey = conceptoId || conceptoNombre` a `conceptoKey = \`${conceptoId || conceptoNombre}::${rol}\`` para separar emisión/recepción
2. Ajustar el nombre mostrado: `${nombre} (Emisión)` o `${nombre} (Recepción)`
3. En la conversión final a array (~línea 554-562), extraer el `concepto_id` real quitando el sufijo `::rol` del key

**`src/lib/generateSettlementPDF.ts`** — No requiere cambios estructurales. El PDF ya renderiza los conceptos que recibe del `resumenConceptos`. Al separar las filas en el cálculo, el PDF automáticamente mostrará las filas separadas por rol.

**`src/components/settlements/ConceptBreakdownTable.tsx`** — No requiere cambios. Ya renderiza lo que recibe.

### Resultado

En cada pestaña (Contado / Pago Destino / Cta. Cte.) y en el PDF, cada concepto aparecerá separado:
- "Flete (Emisión)" — porcentaje y comisión de origen
- "Flete (Recepción)" — porcentaje y comisión de destino

| Archivo | Cambio |
|---------|--------|
| `BranchSettlements.tsx` | Incluir rol en clave de acumulación + sufijo en nombre del concepto |

No se requiere migración de base de datos.

