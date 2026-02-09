

# Fix: Validación de zonas de cobertura por código postal

## Problema detectado

Hay dos bugs en la validación de cobertura:

1. **Códigos postales alfanuméricos** (ej: `B7602` para Mar del Plata, `S2003` para Rosario): La función `cpInRange` usa `parseInt()` que devuelve `NaN` para estos CPs, haciendo que la comparación numérica falle. El fallback a comparación de strings tampoco funciona correctamente porque compara "7602" (input del usuario) con "B7602" (dato de la zona).

2. **La lógica de matching es exclusiva cuando debería ser inclusiva**: Actualmente, si una zona tiene TANTO ciudad COMO rango de CP, solo chequea la ciudad. El CP range solo se evalúa si la ciudad no matcheó (`!matches`). Esto significa que una zona como "Zona Norte" con CP `1600-1699` no va a matchear si el usuario pone una ciudad que no es exactamente "Zona Norte".

3. **La provincia no se envía** en el formulario (`provincia: null`), eliminando esa vía de validación.

## Datos actuales en la base

| Zona | Ciudad | CP Desde | CP Hasta |
|------|--------|----------|----------|
| CABA | CABA | 1000 | 1440 |
| Zona Norte | Zona Norte | 1600 | 1699 |
| Zona Oeste | Zona Oeste | 1700 | 1799 |
| Zona Sur | Zona Sur | 1800 | 1899 |
| Mar del Plata | Mar del Plata | B7602 | - |
| Rosario | Rosario | S2003 | - |

## Solución

### 1. Arreglar `cpInRange` para CPs alfanuméricos

Extraer solo la parte numérica del CP argentino (ej: `B7602` -> `7602`, `S2003` -> `2003`, `1440` -> `1440`) antes de comparar.

### 2. Hacer el CP check independiente de la ciudad

Cambiar la lógica para que el CP range se evalúe siempre (no solo cuando la ciudad no matcheó). Si una zona tiene CP range definido y el destino tiene CP, ese check debe ejecutarse como vía de match alternativa.

### 3. Pasar la provincia desde el formulario

Si el formulario tiene datos de provincia del destinatario, enviarlos a `validateDestination`.

## Seccion tecnica

### Archivo: `src/hooks/useCoverageValidation.ts`

**Cambio 1** - Funcion para normalizar CPs argentinos (linea ~20):
```typescript
function extractNumericCP(cp: string): number {
  // Argentine CPs can be like "B7602ABC" or "1440" 
  // Extract numeric portion for comparison
  const cleaned = cp.replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : NaN;
}
```

**Cambio 2** - Actualizar `cpInRange` para usar la nueva funcion (lineas 21-30):
```typescript
function cpInRange(cp: string, from: string, to: string): boolean {
  const cpNum = extractNumericCP(cp);
  const fromNum = extractNumericCP(from);
  const toNum = extractNumericCP(to);
  if (!isNaN(cpNum) && !isNaN(fromNum) && !isNaN(toNum)) {
    return cpNum >= fromNum && cpNum <= toNum;
  }
  return cp >= from && cp <= to;
}
```

**Cambio 3** - Hacer el check de CP independiente del check de ciudad (lineas 67-98):
```typescript
for (const zone of zones) {
  let matchesCiudad = false;
  let matchesProvincia = false;
  let matchesCp = false;

  // Check ciudad
  if (zone.ciudad && destCiudad) {
    const zoneCiudad = normalize(zone.ciudad);
    if (zoneCiudad === destCiudad || 
        destCiudad.includes(zoneCiudad) || 
        zoneCiudad.includes(destCiudad)) {
      matchesCiudad = true;
    }
  }

  // Check provincia
  if (zone.provincia && destProvincia) {
    const zoneProvincia = normalize(zone.provincia);
    if (zoneProvincia === destProvincia || 
        destProvincia.includes(zoneProvincia) || 
        zoneProvincia.includes(destProvincia)) {
      matchesProvincia = true;
    }
  }

  // Check CP range - ALWAYS check, independent of city
  if (zone.codigo_postal_desde && destCp) {
    const cpHasta = zone.codigo_postal_hasta || zone.codigo_postal_desde;
    if (cpInRange(destCp, zone.codigo_postal_desde, cpHasta)) {
      matchesCp = true;
    }
  }

  // Any match means destination is covered
  if (matchesCiudad || matchesProvincia || matchesCp) return null;
}
```

### Archivo: `src/pages/NewShipment.tsx`

Pasar la provincia del destinatario si esta disponible en el formulario (linea ~773-777). Si el campo `destinatario_provincia` existe en formData, incluirlo en la llamada.

### Archivos afectados
- `src/hooks/useCoverageValidation.ts` (fix principal)
- `src/pages/NewShipment.tsx` (pasar provincia si disponible)

