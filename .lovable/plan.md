
# Plan: Corregir Guardado de Conceptos en envio_detalles

## Problema Identificado

El sistema de liquidación muestra 0% de comisión porque los **conceptos no se guardan correctamente** al crear un envío.

### Situación Actual
El envío `SUC01-ENV-20260204-B863B5` tiene:
- **precio_total:** $4,500
- **Concepto guardado:** Solo "Servicio de Agencia" por $1,000
- **Faltante:** El Flete ($3,500) NUNCA se guardó en `envio_detalles`

### Causa Raíz
En `NewShipment.tsx` líneas 895-908, al crear el envío:
1. El **Flete calculado** (basado en peso, distancia, volumen) se incluye en el `precio_total` pero **NO se guarda como concepto** en `envio_detalles`
2. Los **conceptos porcentuales** (Seguro) se guardan con `cp.monto` (monto fijo de la tarifa) en lugar del monto calculado
3. Resultado: La suma de `envio_detalles` no coincide con `precio_total`

### Configuración de Comisiones (Correcta)
Berazategui tiene configurado para **emisión**:
- Flete: 25% (contado/destino), 10% (cta_cte)
- Servicio de Agencia: 0% (todos los tipos) ← Esto es correcto según tu configuración

El problema NO es la configuración de comisiones, sino que **el Flete nunca se guardó** como concepto.

---

## Solución Propuesta

### Archivo: `src/pages/NewShipment.tsx`

Modificar la lógica de guardado de `envio_detalles` (líneas 894-908) para:

1. **Guardar el Flete como concepto explícito**
   - Buscar el concepto "Flete" del catálogo (`tarifa_conceptos`)
   - Guardar `{ concepto_id: flete_id, nombre_concepto: 'Flete', monto: fleteCalculado }`

2. **Calcular montos reales para conceptos porcentuales**
   - Si `cp.es_porcentaje === true`, calcular: `valorDeclarado × porcentaje / 100`
   - Si `cp.multiplicar_por_bultos === true`, multiplicar por cantidad de bultos

3. **Validar que la suma de detalles = precio_total**
   - Agregar verificación antes de guardar

### Código Actual (Problemático)
```typescript
// Líneas 894-908
if (conceptosPreciosFiltrados.length > 0) {
  const detalles = conceptosPreciosFiltrados.map((cp) => ({
    envio_id: envio.id,
    concepto_id: cp.concepto_id,
    nombre_concepto: cp.concepto?.nombre || 'Sin nombre',
    monto: cp.monto, // ❌ Usa monto fijo, no el calculado
  }));
  // NO incluye el Flete calculado ❌
  await supabase.from('envio_detalles').insert(detalles);
}
```

### Código Corregido
```typescript
// Nuevo código para insertar detalles correctamente
const valorDeclarado = parseFloat(formData.valor_declarado) || 
  (configSeguro?.valor_minimo_declarado || 0);
const cantidadBultos = parseInt(formData.cantidad_bultos) || 1;

// Buscar el concepto "Flete" del catálogo
const conceptoFlete = conceptos.find(c => 
  c.codigo?.toLowerCase() === 'flete' || 
  c.nombre?.toLowerCase() === 'flete'
);

const detalles: Array<{envio_id: string; concepto_id: string | null; nombre_concepto: string; monto: number}> = [];

// 1. Agregar FLETE como concepto (siempre si hay flete calculado)
if (fleteCalculado > 0) {
  detalles.push({
    envio_id: envio.id,
    concepto_id: conceptoFlete?.id || null,
    nombre_concepto: 'Flete',
    monto: fleteCalculado, // ✅ Monto calculado real
  });
}

// 2. Agregar otros conceptos con montos calculados
conceptosPreciosFiltrados.forEach((cp) => {
  // No duplicar flete si ya está incluido arriba
  if (cp.concepto?.codigo?.toLowerCase() === 'flete' || 
      cp.concepto?.nombre?.toLowerCase() === 'flete') {
    return;
  }
  
  let montoConcepto = 0;
  if (cp.es_porcentaje && cp.porcentaje) {
    // Calcular monto porcentual basado en valor declarado
    montoConcepto = valorDeclarado * Number(cp.porcentaje) / 100;
  } else {
    montoConcepto = Number(cp.monto);
  }
  
  // Multiplicar por bultos si aplica
  if (cp.multiplicar_por_bultos) {
    montoConcepto *= cantidadBultos;
  }
  
  if (montoConcepto > 0) {
    detalles.push({
      envio_id: envio.id,
      concepto_id: cp.concepto_id,
      nombre_concepto: cp.concepto?.nombre || 'Sin nombre',
      monto: montoConcepto, // ✅ Monto calculado real
    });
  }
});

if (detalles.length > 0) {
  const { error: detallesError } = await supabase
    .from('envio_detalles')
    .insert(detalles);
  if (detallesError) throw detallesError;
}
```

---

## Resultado Esperado

### Antes (Problema)
```
envio_detalles para SUC01-ENV-20260204-B863B5:
- Servicio de Agencia: $1,000
- (Flete falta) ❌
Total guardado: $1,000 vs precio_total: $4,500
```

### Después (Correcto)
```
envio_detalles para un nuevo envío:
- Flete: $3,500 ✅
- Servicio de Agencia: $1,000
Total guardado: $4,500 = precio_total ✅
```

### Liquidación Calculará Correctamente
```
Flete ($3,500) × 25% = $875 comisión ✅
Serv. Agencia ($1,000) × 0% = $0 (configuración correcta)
Total comisión: $875
```

---

## Consideración: Envíos Existentes

Los envíos ya creados (como el de la imagen) tienen datos incompletos en `envio_detalles`. Hay dos opciones:

**Opción A: Solo arreglar hacia adelante** (recomendado)
- Nuevos envíos se guardarán correctamente
- Envíos antiguos se pueden recalcular manualmente o con un script de migración

**Opción B: Script de corrección de datos históricos**
- Crear un script SQL que calcule el Flete faltante: `precio_total - SUM(monto de detalles existentes)`
- Insertar el concepto "Flete" con la diferencia

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/NewShipment.tsx` | Corregir guardado de envio_detalles (líneas 894-908) para incluir Flete y calcular montos reales |

---

## Impacto

1. **Nuevos envíos** guardarán todos los conceptos correctamente
2. **Liquidaciones** calcularán comisiones con el desglose completo
3. **Auditoría** será posible verificar cada concepto vs. precio total
