

## Plan: Mostrar detalle de envíos en facturas de liquidación seller

### Problema
La página `PrintInvoice` solo muestra detalles cuando la factura está vinculada a un `envio_id`. Cuando la factura proviene de una **liquidación seller** (`liquidacion_seller_id`), no se cargan los envíos liquidados ni se muestran como ítems → la factura queda con un único renglón "Flete $0,00".

Caso real: factura `0007-00000003` (Beraexpress, $20.491,98) corresponde a 2 envíos ML-46807351356 y ML-46833405396 ($10.245,99 c/u) que están vinculados vía `envios.liquidacion_seller_id`.

### Solución
En `src/pages/PrintInvoice.tsx`:

1. **Detectar tipo de factura**: si `factura.liquidacion_seller_id` existe (o `liquidacion_terciarizado_id`), tratarla como factura de liquidación.

2. **Nueva query `liquidacionEnvios`**: cuando la factura sea de liquidación seller, consultar `envios` filtrando por `liquidacion_seller_id = factura.liquidacion_seller_id`, trayendo: `tracking_number`, `tracking_externo`, `fecha_entrega`, `ciudad_entrega`, `precio_total`.

3. **Construir conceptos dinámicamente**:
   - Si es factura de envío único → comportamiento actual (Flete + conceptos del envío).
   - Si es factura de liquidación → un renglón por cada envío con descripción tipo `"{tracking} - {ciudad} ({fecha})"` e importe = `precio_total`.

4. **Reemplazar el bloque "Envío asociado"** por:
   - Si liquidación: mostrar período `{periodo_inicio} - {periodo_fin}` y cantidad de envíos.
   - Si envío único: mantener tracking actual.

5. **Tabla de conceptos**: aumentar a 3 columnas (Fecha | Concepto/Tracking | Importe) cuando sea liquidación, para que se vea claro el detalle.

### Archivos a modificar
| Archivo | Cambio |
|---------|--------|
| `src/pages/PrintInvoice.tsx` | Agregar query de liquidación, construir conceptos según tipo, ajustar UI del bloque de detalle |

### Riesgo
Bajo. Solo se agrega lógica condicional para un caso que hoy no funciona; las facturas de envío único siguen renderizándose igual.

