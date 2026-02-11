
# Precios por Zona para Envios ML Flex

## Problema
Los envios ML Flex llegan sin precio (ML no informa el costo para self_service), y los sellers no tienen una tarifa unica asignada. El pricing se basa en zonas: la ciudad de destino del envio determina el precio.

Ya existen tarifas por zona en la base de datos:
- Zona 1 - Berazategui: $4,610.99
- Zona 2 - Quilmes y Florencio Varela: $7,370.99
- Zona 3 - CABA y GBA: $10,245.99
- Zona 4 - La Plata: (falta crear o es la misma que zona 3)

## Solucion

### 1. Asignar precio por zona al registrar envio ML Flex

En la edge function `register-ml-shipment`, cuando el seller no tiene `tarifa_id` individual:
- Buscar todas las tarifas de tipo `zona` del tenant
- Comparar la `ciudad_entrega` del envio contra `zona_destino` de cada tarifa
- Si hay match, usar ese `precio_base` como `precio_total`
- Si no hay match, dejar precio en 0 (se podra corregir en la liquidacion)

### 2. Recalcular precios en la liquidacion (Settlements.tsx)

Al calcular la liquidacion, para envios con `precio_total = 0`:
- Buscar tarifas por zona del tenant
- Hacer el mismo match ciudad vs zona_destino
- Mostrar el precio calculado en la preview
- Permitir que el operador vea y confirme antes de generar

### 3. Logica de matching de zonas

La comparacion sera flexible (case-insensitive, sin acentos) y soportara multiples ciudades en `zona_destino` separadas por coma:

```text
zona_destino: "QUILMES,FLORENCIO VARELA"
ciudad_entrega: "Quilmes"
-> Match! precio_base: $7,370.99
```

### 4. Tambien aplicar al sincronizar (mercadolibre-sync)

La misma logica se aplicara en `mercadolibre-sync` cuando crea envios automaticamente.

## Cambios por archivo

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/register-ml-shipment/index.ts` | Agregar logica de busqueda de tarifa por zona cuando seller no tiene tarifa_id. Match ciudad_entrega contra zona_destino de tarifas tipo zona del tenant |
| `supabase/functions/mercadolibre-sync/index.ts` | Misma logica de tarifa por zona al crear envios |
| `src/pages/ecommerce/Settlements.tsx` | Al calcular, para envios con precio 0, buscar tarifa por zona y recalcular. Mostrar precio calculado en preview con indicador visual |

## Detalle tecnico

### Funcion de matching (compartida en edge functions)

```text
function findZoneRate(tarifas, ciudadEntrega):
  ciudadNorm = normalize(ciudadEntrega)  // lowercase, sin acentos
  for tarifa in tarifas:
    zonas = tarifa.zona_destino.split(",")
    for zona in zonas:
      if normalize(zona) == ciudadNorm OR ciudadNorm includes normalize(zona):
        return tarifa.precio_base
  return 0  // sin match
```

### En register-ml-shipment (paso 9 actual)

```text
// Actual: solo busca seller.tarifa_id
// Nuevo: si no tiene tarifa_id, buscar tarifas por zona
1. Si seller.tarifa_id -> usar precio_base (como hoy)
2. Si no -> buscar tarifas WHERE tipo_tarifa='zona' AND tenant_id=seller.tenant_id
3. Hacer match ciudad_entrega contra zona_destino
4. Usar precio_base de la tarifa que matchee
5. Guardar tarifa_id del match en el envio
```

### En Settlements.tsx (calculateMutation)

```text
// Despues de traer envios, para los que tengan precio_total=0:
1. Buscar tarifas tipo zona del tenant
2. Para cada envio sin precio, matchear ciudad_entrega
3. Mostrar precio sugerido en la tabla con badge "Calculado"
4. Al generar, actualizar precio_total del envio
```

## Flujo completo

```text
1. Se escanea QR de ML Flex -> register-ml-shipment
2. Sistema busca tarifa por zona segun ciudad destino
3. Asigna precio automaticamente ($4610, $7370, $10245, etc.)
4. Al liquidar, operador ve envios con precios ya calculados
5. Si algun envio quedo sin precio (ciudad desconocida), se muestra aviso
6. Operador puede continuar o ajustar manualmente
```
