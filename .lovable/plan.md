
# Plan: Corregir Fallback de Comisiones Sin envio_detalles

## Problema Identificado

Cuando un envío **no tiene registros en `envio_detalles`**, el sistema de liquidación entra en modo fallback (líneas 395-420 de `BranchSettlements.tsx`) pero este fallback tiene un bug:

```typescript
// Código actual problemático
calcularComisionConcepto(
  null,           // ← concepto_id = null
  'Flete',
  envio.precio_total,
  ...
);
```

Luego en `calcularComisionConcepto`:
```typescript
const config = (comisiones || []).find(c => c.concepto_id === conceptoId);
// Busca: concepto_id === null
// Pero la configuración tiene: concepto_id = '1cd05d8a-ebe5-4ecb-b5ec-aa6c2a2b5271'
// Resultado: config = undefined → porcentaje = 0%
```

### Datos del Problema

De 15 envíos recientes de "Administración" con precio > $0:
- 9 envíos tienen **0 detalles** → caen en fallback → 0% comisión
- 6 envíos tienen detalles → calculan correctamente

### Configuración Correcta Existente
La sucursal "Administración" SÍ tiene configurado:
- Flete: 30% contado/destino, 10% cta_cte
- Seguro: 30%
- Servicio de Agencia: 100%

---

## Solución Propuesta

### Archivo: `src/pages/BranchSettlements.tsx`

Modificar la lógica de fallback para buscar el ID real del concepto "Flete" antes de calcular:

### Cambios en líneas 207-215
Agregar búsqueda del concepto "Flete" por nombre:

```typescript
// Fetch all concept names for display
const { data: conceptosCatalogo } = await supabase
  .from('tarifa_conceptos')
  .select('id, nombre, codigo');

const conceptoNombres: Record<string, string> = {};
let conceptoFleteId: string | null = null;

(conceptosCatalogo || []).forEach(c => {
  conceptoNombres[c.id] = c.nombre;
  // Guardar el ID del concepto Flete para uso en fallback
  if (c.codigo?.toLowerCase() === 'flete' || c.nombre?.toLowerCase() === 'flete') {
    conceptoFleteId = c.id;
  }
});
```

### Cambios en líneas 395-420
Usar `conceptoFleteId` en el fallback:

```typescript
} else {
  // Fallback: no details, use precio_total as "Flete" concept
  if (esOrigen) {
    envioComision += calcularComisionConcepto(
      conceptoFleteId,  // ← Usar ID real del Flete
      'Flete',
      envio.precio_total,
      tipoPago,
      comisionesEmision,
      envio.precio_total,
      envio.id,
      'emisión'
    );
  }
  if (esDestino && envio.estado === 'entregado') {
    envioComision += calcularComisionConcepto(
      conceptoFleteId,  // ← Usar ID real del Flete
      'Flete',
      envio.precio_total,
      tipoPago,
      comisionesRecepcion,
      envio.precio_total,
      envio.id,
      'recepción'
    );
  }
}
```

---

## Resultado Esperado

### Antes (Problema)
```
Envío ADMIN-ENV-20260203-8460DA ($6,000):
- Sin detalles → fallback con concepto_id = null
- No encuentra config → porcentaje = 0%
- Comisión: $0
```

### Después (Correcto)
```
Envío ADMIN-ENV-20260203-8460DA ($6,000):
- Sin detalles → fallback con concepto_id = '1cd05d8a...' (Flete)
- Encuentra config → porcentaje = 30%
- Comisión: $6,000 × 30% = $1,800
```

---

## Impacto

1. **Envíos sin detalles** usarán la configuración real de "Flete"
2. **Cálculos correctos** para todos los envíos, con o sin `envio_detalles`
3. **Retrocompatibilidad** - funciona con envíos antiguos que no tienen desglose

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/BranchSettlements.tsx` | Buscar ID de Flete y usarlo en fallback (líneas ~207-215 y ~395-420) |
