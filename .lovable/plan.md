

# Envíos cancelados sin visitas deben valer $0 en liquidaciones

## Problema

Cuando se calcula o consulta una liquidación de seller, los envíos con estado "cancelado" muestran el precio completo (ej: $10.245,99). La regla de negocio correcta es:

- **Cancelado SIN visitas (intentos de entrega)** -> Precio = $0 (no se cobra)
- **Cancelado CON visitas** -> Se mantiene el precio (el chofer intentó entregar, hubo costo operativo)

Una "visita" se determina consultando `envio_historial` buscando registros donde `estado_nuevo` sea `en_reparto` o `no_entregado` (es decir, el paquete salió a ruta al menos una vez).

## Cambios necesarios

### 1. Calculo de liquidacion (`src/pages/ecommerce/Settlements.tsx`)

En la `calculateMutation` (aprox. linea 506-622), despues de calcular `precioFinal` para cada envio, agregar una verificacion:

- Si `e.estado === 'cancelado'`, consultar `envio_historial` para ese envio
- Buscar registros con `estado_nuevo IN ('en_reparto', 'no_entregado')`
- Si no hay registros (0 visitas), forzar `precioFinal = 0`
- Agregar campo `tiene_visitas: boolean` al objeto retornado para mostrar indicador visual

Para optimizar, se hara una sola consulta batch de `envio_historial` para todos los envios cancelados del lote, en lugar de una consulta individual por envio.

### 2. Saldos por Seller (`src/pages/ecommerce/Settlements.tsx`)

En la query `sellerBalances` (aprox. linea 149-313), aplicar la misma logica: obtener el estado de cada envio (ya se puede agregar `estado` al select), y para los cancelados verificar visitas antes de sumar su precio.

### 3. Detalle de liquidacion (`src/components/ecommerce/SellerLiquidacionDetailDialog.tsx`)

En la query de envios vinculados (linea 60-70), agregar `estado` al select (ya lo tiene). Luego:

- Consultar `envio_historial` para los envios cancelados del lote
- En la tabla, mostrar `$0` para cancelados sin visitas
- Agregar un indicador visual (tooltip o texto) que explique por que vale $0
- Recalcular el total de la tabla excluyendo cancelados sin visitas

### 4. Generacion de liquidacion (`src/pages/ecommerce/Settlements.tsx`)

En `generateMutation` (linea 668-746), al actualizar `precio_total` del envio en la BD, respetar el $0 para cancelados sin visitas (ya viene calculado desde el paso 1).

## Detalle tecnico

### Consulta batch de visitas

```typescript
// Obtener IDs de envios cancelados
const cancelledIds = allEnviosData
  .filter(e => e.estado === 'cancelado')
  .map(e => e.id);

// Una sola consulta para todos
const { data: visitasData } = await supabase
  .from('envio_historial')
  .select('envio_id')
  .in('envio_id', cancelledIds)
  .in('estado_nuevo', ['en_reparto', 'no_entregado']);

// Set de envios que SI tienen visitas
const enviosConVisitas = new Set(
  (visitasData || []).map(v => v.envio_id)
);

// Al mapear envios:
if (e.estado === 'cancelado' && !enviosConVisitas.has(e.id)) {
  precioFinal = 0;
}
```

### Indicador visual en el detalle

En la tabla de envios del dialog, para cancelados sin visitas:
- Precio mostrado: `$0`  
- Tooltip o texto small: "Sin visitas - no se cobra"
- Color: gris/muted en lugar de naranja

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/pages/ecommerce/Settlements.tsx` | Logica de cancelados en `calculateMutation`, `sellerBalances`, y `generateMutation` |
| `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx` | Consulta de visitas + display condicional en tabla |

### Sin cambios de base de datos

No se requieren migraciones. Solo se agrega una consulta adicional a `envio_historial` (tabla existente).

