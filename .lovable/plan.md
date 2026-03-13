

# Fix: Flete duplicado en Resumen de Precio

## Problema

Cuando la tarifa es "por peso", el resumen muestra dos líneas de Flete:
1. **Flete (ENVIOS GENERAL)** — precio del rango de peso ($9.000)
2. **Flete** — concepto básico ($0,00)

El concepto "Flete" se muestra como línea separada en los conceptos básicos, cuando debería estar incluido en la línea principal de flete.

## Solución

En `src/pages/NewShipment.tsx`:

1. **Filtrar el concepto "Flete" de `conceptosBasicos`** en el cálculo del total (líneas 738-756) y en el render del resumen (líneas 2788-2820), ya que el flete ya está representado por `fleteCalculado`.

2. **Sumar el monto del concepto "Flete"** (si tiene precio configurado > 0) al `fleteCalculado`, para que todo quede en una sola línea.

### Cambios específicos

**`totalConceptosBasicos`** (~línea 744): Excluir conceptos cuyo código/nombre sea "flete":
```typescript
return conceptosBasicos.reduce((sum, cp) => {
  const codigo = cp.concepto?.codigo?.toLowerCase();
  const nombre = cp.concepto?.nombre?.toLowerCase();
  if (codigo === 'flete' || nombre === 'flete') return sum; // skip, ya incluido en fleteCalculado
  // ... resto igual
}, 0);
```

**`fleteCalculado`** (~línea 785): Sumar el monto del concepto "Flete" si existe:
```typescript
// Al final del cálculo, antes del return:
const conceptoFlete = conceptosBasicos.find(cp => 
  cp.concepto?.codigo?.toLowerCase() === 'flete' || cp.concepto?.nombre?.toLowerCase() === 'flete'
);
if (conceptoFlete) {
  fleteTotal += Number(conceptoFlete.monto) || 0;
}
```

**Resumen UI** (~línea 2788): Excluir "Flete" del listado de conceptos básicos:
```typescript
{conceptosBasicos
  .filter(cp => {
    const codigo = cp.concepto?.codigo?.toLowerCase();
    const nombre = cp.concepto?.nombre?.toLowerCase();
    return codigo !== 'flete' && nombre !== 'flete';
  })
  .map((cp) => { ... })}
```

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Excluir concepto "Flete" de básicos, sumarlo al flete calculado |

