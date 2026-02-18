
# Corrección: Tarifa incorrecta para Hudson (y otras localidades del Partido de Berazategui)

## Diagnóstico

### Causa raíz en los datos
La `zona_destino` de **ZONA 1 - Berazategui** solo contiene `"Berazategui"`. Hudson, Sourigues, El Pato, Pereyra, Plátanos, Ranelagh, Ezpeleta y otras localidades del Partido de Berazategui **no están listadas**, por lo que el algoritmo no las reconoce y aplica el fallback (Zona 3 - CABA Y GBA, que tiene más entradas en la lista).

### Bug secundario en el algoritmo de matching
El algoritmo usa `zona.includes(ciudadNorm) || ciudadNorm.includes(zona)` en un loop sin prioridad. Esto puede generar falsos positivos cuando hay nombres de ciudades que son substrings de otras (ej: si una zona tiene "Quilmes" y la ciudad es "Quilmes de Berazategui", podría matchear "quilmes" de Zona 2, pero también podría matchear incorrectamente en otros casos). Además, si se agrega "Hudson" a Zona 1, el matching de substring podría causar problemas con otros nombres similares.

## Solución en dos partes

### Parte 1: Mejorar el algoritmo de matching (priorizar coincidencia exacta)
En todos los lugares donde existe el loop de matching de zonas (`Settlements.tsx` y los edge functions `mercadolibre-sync`, `register-ml-shipment`, `recover-ml-shipments`), se ajusta el orden de prioridad:

1. **Match exacto** (`zona === ciudadNorm`) → prioridad máxima
2. **Match por substring** (`ciudadNorm.includes(zona) || zona.includes(ciudadNorm)`) → solo si no hay match exacto

El algoritmo mejorado:
```typescript
// Primero buscar match exacto (mayor prioridad)
for (const zt of allZoneTarifas) {
  if (!zt.zona_destino) continue;
  const zonas = zt.zona_destino.split(',').map((z) => normalize(z.trim()));
  if (zonas.some(z => z === ciudadNorm)) {
    return zt.precio_base || 0; // match exacto → retornar inmediatamente
  }
}
// Luego buscar match por substring (menor prioridad)
for (const zt of allZoneTarifas) {
  if (!zt.zona_destino) continue;
  const zonas = zt.zona_destino.split(',').map((z) => normalize(z.trim()));
  if (zonas.some(z => ciudadNorm.includes(z) || z.includes(ciudadNorm))) {
    return zt.precio_base || 0;
  }
}
// Fallback catch-all
```

### Parte 2: Agregar localidades del Partido de Berazategui a ZONA 1
Se actualiza el campo `zona_destino` de la tarifa ZONA 1 (id: `08a441a3-ec8a-4678-b4e4-dc83c32b094e`) en la base de datos para incluir todas las localidades del partido:

```sql
UPDATE tarifas 
SET zona_destino = 'Berazategui,Hudson,Ranelagh,Ezpeleta,Plátanos,El Pato,Pereyra,Sourigues,Juan Maria Gutierrez,Arditi,Guillermo Hudson'
WHERE id = '08a441a3-ec8a-4678-b4e4-dc83c32b094e';
```

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/ecommerce/Settlements.tsx` | Función `matchZone`: separar en dos pasadas (exacta + substring) |
| `src/pages/ecommerce/Settlements.tsx` | Segundo bloque de matching (líneas ~520-540): misma mejora |
| `supabase/functions/mercadolibre-sync/index.ts` | Misma mejora en el loop de matching |
| `supabase/functions/register-ml-shipment/index.ts` | Misma mejora en el loop de matching |
| `supabase/functions/recover-ml-shipments/index.ts` | Misma mejora en el loop de matching |
| Base de datos | `UPDATE tarifas SET zona_destino = '...' WHERE id = '08a441a3...'` para agregar Hudson y demás localidades |

## Resultado esperado

- Hudson → ZONA 1 - Berazategui ($4.610,99) ✓
- Ranelagh, Ezpeleta → ZONA 1 - Berazategui ($4.610,99) ✓
- El matching exacto siempre gana al matching por substring, evitando futuros falsos positivos
- Los edge functions de ML Sync, Register y Recover aplican la misma lógica mejorada

## Nota importante
Si el usuario necesita agregar más localidades de otros partidos en el futuro, la solución correcta es editar el campo `zona_destino` de la tarifa correspondiente directamente desde la interfaz de Tarifas (no se requiere código).
