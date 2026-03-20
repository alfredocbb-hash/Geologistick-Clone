

## Plan: Separar comisiones por rol — Corrección

### Diagnóstico

El código de **cálculo** ya fue actualizado correctamente para separar Emisión/Recepción. Sin embargo, el campo `resumen_conceptos` se **guarda en la base de datos** al momento de crear la liquidación. Las liquidaciones que ya existían antes del cambio tienen los datos viejos (sin separación) almacenados.

**El problema se manifiesta en dos escenarios:**
1. **Liquidaciones existentes**: El `resumen_conceptos` guardado en la DB no tiene los sufijos "(Emisión)"/"(Recepción)"
2. **Liquidaciones nuevas**: Deberían funcionar correctamente con el código actual

### Solución

Para que funcione tanto con liquidaciones viejas como nuevas, y también al **consultar** (no solo al crear), hay que **recalcular el desglose desde los detalles guardados** al momento de visualizar, en lugar de depender exclusivamente del JSON almacenado.

| Archivo | Cambio |
|---------|--------|
| `SettlementDetailDialog.tsx` | Reconstruir `resumenConceptos` desde `branchDetalles` cuando los datos almacenados no tienen separación por rol |
| `PrintSettlement.tsx` | Misma lógica: reconstruir el desglose desde los items cargados si el JSON almacenado no tiene sufijos de rol |
| `generateSettlementPDF.ts` | En `downloadBranchSettlementPDF`, reconstruir el desglose desde los detalles si el almacenado no tiene separación |

### Lógica de reconstrucción

Función auxiliar que toma los `liquidacion_sucursal_detalles` (que ya tienen `rol`, `tipo_pago`, `concepto_nombre`, `monto_envio`, `comision_aplicada`, `porcentaje_comision`) y agrupa por `concepto::rol` para generar el `ResumenPorTipoPago` con los sufijos "(Emisión)"/"(Recepción)".

```text
detalles guardados (cada uno tiene rol, tipo_pago, concepto)
  → agrupar por tipo_pago → contado/destino/cta_cte
  → dentro de cada grupo, agrupar por concepto + rol
  → generar nombre con sufijo "(Emisión)" o "(Recepción)"
  → sumar ventas y comisiones por grupo
```

Se usará esta reconstrucción como **fallback** cuando el `resumen_conceptos` almacenado no contenga nombres con "(Emisión)" o "(Recepción)".

### Resultado

- Liquidaciones **nuevas**: se guardan correctamente con separación
- Liquidaciones **existentes**: se reconstruye el desglose al visualizar/imprimir/exportar PDF
- No requiere migración de datos

