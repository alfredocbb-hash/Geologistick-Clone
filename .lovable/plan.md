
# Fix: PDF de liquidacion de seller debe incluir envios ademas de movimientos

## Problema

Cuando se genera el PDF de una liquidacion de seller, solo se incluyen los **movimientos** de cuenta corriente (`seller_cuenta_corriente`), pero no los **envios** vinculados a la liquidacion (`envios` con `liquidacion_seller_id`). En la UI se ven ambos en tabs separados ("Movimientos" y "Envios"), pero el PDF solo muestra movimientos.

## Solucion

Modificar la funcion `downloadSellerSettlementPDF` y la funcion `generateSettlementPDF` para que el PDF de seller incluya una seccion de envios ademas de los movimientos.

## Archivos a modificar

### 1. `src/lib/generateSettlementPDF.ts`

**En `downloadSellerSettlementPDF` (linea ~325-360):**
- Agregar una consulta adicional para obtener los envios vinculados via `liquidacion_seller_id`
- Pasar los envios como un campo adicional en los datos del PDF

**En la interfaz `SettlementPDFData`:**
- Agregar campo opcional `shipments` para los envios del seller

**En `generateSettlementPDF` (la funcion principal):**
- Despues de renderizar la tabla de movimientos, si hay `shipments`, agregar una segunda seccion "DETALLE DE ENVIOS" con columnas: Fecha, Tracking, Destinatario, Estado, Precio
- Incluir un subtotal de envios al final de esa seccion

### Detalle tecnico

La consulta de envios sera:
```sql
SELECT id, tracking_number, nombre_destinatario, precio_total, estado, created_at
FROM envios
WHERE liquidacion_seller_id = <liquidacion_id>
ORDER BY created_at ASC
```

El PDF resultante tendra dos secciones:
1. **DETALLE DE MOVIMIENTOS** - como hasta ahora (cargos/pagos de cuenta corriente)
2. **DETALLE DE ENVIOS** - nueva seccion con tracking, destinatario, estado y precio

Tambien se actualizara el resumen de totales para incluir la cantidad de envios y el total de envios.
