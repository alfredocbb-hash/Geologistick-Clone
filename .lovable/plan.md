

# Plan: Corregir Flete Duplicado y Mostrar Todos los Conceptos en el Comprobante PDF

## Problema Identificado

El comprobante PDF muestra:
1. **"Flete" dos veces** con importes diferentes ($25.280,00 y $17.280,00)
2. **Faltan conceptos adicionales** (Seguro, Servicio de Agencia)

### Causa Raíz

En la base de datos, el envío A2F54D tiene correctamente guardados estos conceptos en `envio_detalles`:
- Flete: $17.280
- Entrega a Domicilio: $5.000  
- Seguro: $2.000
- Servicio de Agencia: $1.000
- **Total: $25.280**

El código del PDF (`generateShipmentReceiptPDF.ts`) fue escrito **antes** de que el Flete se guardara en `envio_detalles`. La lógica actual:

```text
1. Calcula Flete = precio_total - suma(detalles)
   → 25280 - 25280 = 0, entonces usa precio_total = $25.280

2. Dibuja "Flete: $25.280" (¡incorrecto!)

3. Itera sobre detalles (que incluyen Flete $17.280)
   → Dibuja "Flete: $17.280" (¡duplicado!)
   → Solo muestra 2 conceptos (slice(0,2))
```

---

## Solución

Actualizar la lógica del PDF para detectar si "Flete" ya existe en los detalles y mostrar TODOS los conceptos.

### Cambios en `src/lib/generateShipmentReceiptPDF.ts`

**Sección de Conceptos (líneas 370-390 aprox):**

```text
ANTES:
- Calcula flete como precio_total - suma(detalles)
- Siempre dibuja "Flete" primero
- Luego itera detalles.slice(0, 2)

DESPUÉS:
- Verifica si "Flete" ya existe en detalles
- Si existe → usa detalles directamente
- Si no existe → agrega Flete calculado al inicio
- Muestra TODOS los conceptos (sin slice)
- Ajusta el alto del box de conceptos dinámicamente
```

### Cambios en `src/pages/PrintReceipt.tsx`

**Sección de Conceptos (líneas 317-327):**

```text
ANTES:
- Siempre muestra "Flete" calculado primero
- Luego itera todos los detalles (incluyendo Flete duplicado)

DESPUÉS:
- Detectar si Flete está en detalles
- Si está → solo mostrar detalles
- Si no está → calcular y mostrar Flete + detalles
```

---

## Lógica de Detección

```typescript
// Detectar si Flete ya está en los detalles
const fleteEnDetalles = detalles.find(d => 
  d.nombre_concepto?.toLowerCase() === 'flete'
);

// Si Flete ya está en detalles, usarlos directamente
// Si no, agregar Flete calculado al inicio
const conceptosAMostrar = fleteEnDetalles 
  ? detalles 
  : [{ nombre_concepto: 'Flete', monto: flete > 0 ? flete : envio.precio_total }, ...detalles];
```

---

## Archivos a Modificar

1. **`src/lib/generateShipmentReceiptPDF.ts`**
   - Actualizar lógica de renderizado de conceptos
   - Eliminar el slice(0,2) para mostrar todos los conceptos
   - Ajustar altura del box dinámicamente según cantidad de conceptos

2. **`src/pages/PrintReceipt.tsx`**
   - Actualizar la vista previa para que sea consistente con el PDF
   - Usar la misma lógica de detección de Flete

---

## Resultado Esperado

El comprobante mostrará correctamente:

| Concepto | Monto |
|----------|-------|
| Flete | $17.280,00 |
| Entrega a Domicilio | $5.000,00 |
| Seguro | $2.000,00 |
| Servicio de Agencia | $1.000,00 |
| **TOTAL** | **$25.280,00** |

---

## Compatibilidad

- **Envíos nuevos** (con Flete en detalles): se muestran correctamente
- **Envíos antiguos** (sin Flete en detalles): el sistema calcula el Flete como diferencia (comportamiento existente preservado)

