
# Corrección: Auto-selección de Tarifa con zona_destino en tarifas de tipo "peso"

## Diagnóstico del problema

La tarifa "ENVIOS GENERAL" de BlackBox Cargas está configurada como `tipo_tarifa = 'peso'` (no `'zona'`), pero tiene el campo `zona_destino` poblado con todas las localidades. Esto genera dos problemas concatenados:

**Problema 1 - Detección:** La función `encontrarTarifaPorDestino` en `src/pages/NewShipment.tsx` filtra exclusivamente tarifas con `t.tipo_tarifa === 'zona'`. Como la tarifa es de tipo `'peso'`, el sistema no la encuentra y muestra el mensaje "localidad no activada".

**Problema 2 - Cálculo (si se llegara a seleccionar manualmente):** El bloque de cálculo de volumen en la línea 623 solo aplica cuando `tipo_tarifa === 'peso'` con dimensiones, lo cual sí está correcto. El cálculo por rangos de kg también está correcto para tipo `'peso'`. Así que una vez que se corrija la detección, el precio se calculará bien automáticamente.

## Causa raíz

```
// CÓDIGO ACTUAL - solo busca tipo 'zona':
const coincidentesZona = tarifas.filter(t => {
  if (t.tipo_tarifa !== 'zona' || !t.zona_destino) return false;  // ← BUG: excluye tipo 'peso'
  ...
});

// Tarifa en DB:
tipo_tarifa = 'peso'   ← nunca pasa el filtro
zona_destino = 'Vicente López, Quilmes, ...'  ← tiene destinos configurados
rangos_kg = [{desde:0, hasta:5, precio:10000}, ...]  ← tiene rangos correctos
```

## Solución

Modificar `encontrarTarifaPorDestino` en `src/pages/NewShipment.tsx` para buscar en **todas las tarifas que tengan `zona_destino` configurado**, independientemente del `tipo_tarifa`. El tipo de tarifa solo afecta cómo se calcula el precio (ya manejado por `fleteCalculado`), no cómo se detecta el destino.

### Cambio en la función `encontrarTarifaPorDestino` (líneas 148-191):

**Antes:**
```typescript
// 1. Tarifas tipo 'zona'
const coincidentesZona = tarifas.filter(t => {
  if (t.tipo_tarifa !== 'zona' || !t.zona_destino) return false;
  ...
});

// 2. Tarifas tipo 'codigo_postal'
const coincidentesCP = tarifas.filter(t => {
  if (t.tipo_tarifa !== 'codigo_postal' || !t.zona_destino) return false;
  ...
});
```

**Después:**
```typescript
// 1. Cualquier tarifa con zona_destino configurado (independiente del tipo_tarifa)
const coincidentesZona = tarifas.filter(t => {
  if (!t.zona_destino) return false;  // ← solo requiere que tenga zona_destino
  const destinos = t.zona_destino.split(',').map((d: string) => normalizarTexto(d.trim()));
  if (ciudadNorm && destinos.some((d: string) => d.includes(ciudadNorm) || ciudadNorm.includes(d))) return true;
  if (cpTrim && destinos.some((d: string) => d === cpTrim)) return true;
  return false;
});

// 2. Fallback: buscar por código postal exacto (para cualquier tipo con zona_destino)
// (Ya cubierto en el paso anterior, no es necesario un bloque separado)
```

El desempate por peso cuando hay múltiples coincidencias se mantiene igual.

## Archivos a modificar

- **`src/pages/NewShipment.tsx`**: Modificar únicamente la función `encontrarTarifaPorDestino` (líneas 158-165 y 181-188) para eliminar el filtro por `tipo_tarifa` y buscar en cualquier tarifa que tenga `zona_destino` configurado.

## Resultado esperado

Cuando un operador de BlackBox ingrese "Quilmes" en el campo de ciudad del destinatario:
1. El sistema encuentra la tarifa "ENVIOS GENERAL" (tipo `'peso'` con `zona_destino` que incluye "Quilmes")
2. Se auto-selecciona la tarifa y aparece el panel informativo
3. Al ingresar el peso (ej: 5 kg), se aplica el rango correspondiente: $10,000
4. Si las dimensiones superan 100cm, cambia a cálculo por m³ ($60,000/m³)

## Aclaración sobre el diseño de tarifas

La tarifa tiene `tipo_tarifa = 'peso'` porque define **cómo se calcula el precio** (por rangos de kg). El campo `zona_destino` define **dónde aplica** esa tarifa. Son dos dimensiones independientes que el código anterior confundía. La corrección separa correctamente ambos conceptos.
