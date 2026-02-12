

# Fix: "Flete (Contado - emisión)" muestra "sin config" aunque tiene 30% configurado

## Problema

Algunos envíos de Beraexpress tienen grabado un `concepto_id` de "Flete" que pertenece a **otro tenant** (ID `bb000001-...` de otro tenant), en lugar del concepto propio de Beraexpress (`be000001-...` con código `BE-FLETE`).

Cuando el sistema calcula la liquidación, busca la comisión configurada haciendo un match **exacto** por `concepto_id`. Como el ID del envío (`bb000001-...`) no coincide con ninguna comisión configurada en la sucursal (que tiene `be000001-...` y `1cd05d8a-...`), el sistema reporta "sin configuración" a pesar de que el concepto "Flete" sí tiene 30% configurado.

```text
Envío tiene:       concepto_id = bb000001 (Flete de otro tenant)
Comisión config:   concepto_id = be000001 (Flete de Beraexpress) → 30%
                   concepto_id = 1cd05d8a (Flete global)         → 30%

Match exacto por ID → NO encuentra → "sin config"
```

## Solución

Agregar un **fallback por nombre de concepto** cuando no se encuentra la comisión por ID exacto. Si el `concepto_id` del envío no tiene configuración, buscar entre las comisiones configuradas una que tenga el **mismo nombre** de concepto (ej. ambos se llaman "Flete").

## Cambio

| Archivo | Cambio |
|---------|--------|
| `src/pages/BranchSettlements.tsx` | En la función `calcularComisionConcepto` (línea 275), agregar fallback por nombre cuando el match por ID falla |

## Detalle técnico

Cambiar la búsqueda de configuración de comisión de:

```typescript
const config = (comisiones || []).find(c => c.concepto_id === conceptoId);
```

A:

```typescript
let config = (comisiones || []).find(c => c.concepto_id === conceptoId);

// Fallback: si no hay match por ID, buscar por nombre de concepto
if (!config && conceptoNombre) {
  config = (comisiones || []).find(c => {
    const nombreConfig = conceptoNombres[c.concepto_id || ''] || '';
    return nombreConfig.toLowerCase() === conceptoNombre.toLowerCase();
  });
}
```

Esto permite que cuando un envío tiene un `concepto_id` de otro tenant pero con el mismo nombre ("Flete"), el sistema encuentre la comisión correcta (30%) configurada para el concepto "Flete" local.

## Resultado esperado

- La liquidación de la sucursal "Administración" de Beraexpress dejará de mostrar "Configuración Incompleta" para "Flete".
- El 30% configurado se aplicará correctamente al calcular la comisión.
- No se afectan envíos que ya tienen el `concepto_id` correcto (siguen haciendo match por ID).

