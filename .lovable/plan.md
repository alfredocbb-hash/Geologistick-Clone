
## Plan: Normalizar agrupación de ciudades en el Planificador de Rutas

### Problema
El agrupamiento actual usa el nombre de ciudad tal cual viene de la base de datos, lo que genera grupos separados para variantes como "LA PLATA", "La Plata", "LA PLATA OESTE", "LA PLATA NORTE" cuando deberían estar todos juntos bajo "LA PLATA".

### Solución
Agregar una función de normalización de nombres de ciudad que:
1. Convierta a mayúsculas para unificar "La Plata" y "LA PLATA"
2. Elimine sufijos direccionales comunes: "NORTE", "SUR", "ESTE", "OESTE", "CENTRO"
3. Elimine acentos y espacios extra
4. Use el nombre normalizado como clave de agrupación, pero muestre el nombre base legible como título del grupo

### Cambio técnico

**Archivo: `src/pages/RoutePlanner.tsx`** (líneas 1343-1355)

```typescript
// Función de normalización
function normalizeCityName(city: string): string {
  let normalized = city.trim().toUpperCase();
  // Remover acentos
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Remover sufijos direccionales
  normalized = normalized
    .replace(/\s+(NORTE|SUR|ESTE|OESTE|CENTRO|CITY|CASCO)$/i, '')
    .trim();
  return normalized;
}

// En el useMemo de groupedEnvios:
const groups: Record<string, typeof filteredEnvios> = {};
filteredEnvios.forEach(envio => {
  const rawCity = envio.tipo === "retiro"
    ? (envio.ciudad_retiro || envio.remitente?.ciudad || 'Sin localidad')
    : (envio.ciudad_entrega || envio.destinatario?.ciudad || 'Sin localidad');
  const normalizedCity = normalizeCityName(rawCity);
  if (!groups[normalizedCity]) groups[normalizedCity] = [];
  groups[normalizedCity].push(envio);
});
return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
```

### Resultado
- "LA PLATA", "La Plata", "LA PLATA OESTE", "LA PLATA NORTE" → grupo único **LA PLATA (30)**
- "BERAZATEGUI" → **BERAZATEGUI (12)**
- "FLORENCIO VARELA" → **FLORENCIO VARELA (11)**
- Cada ciudad base tiene un solo grupo con el conteo total correcto
