

# Plan: Texto Negrita para Láser + QR Directo al Envío + Tracking Corto

## Resumen de Cambios

Hay **3 mejoras** a implementar:

1. **Texto más negrita** para impresoras láser
2. **QR que lleve directo al envío** (no a la página para escribir el tracking)
3. **Acortar el código de tracking** que debe recordar el cliente

---

## 1. Texto Más Negrita (Estilo Láser)

**Problema:** El texto actual del PDF usa fuentes muy finas que se ven débiles en impresoras láser.

**Solución:** En `generateShipmentReceiptPDF.ts`:
- Aumentar grosor de líneas separadoras de `0.5` a `1.0`
- Usar `'bold'` en más lugares (nombres, conceptos, totales)
- Subir tamaños de fuente en elementos clave (+1 o +2 pt)
- Aumentar grosor del borde del cuadro TOTAL

| Elemento | Antes | Después |
|----------|-------|---------|
| Nombre empresa | 10pt bold | 12pt bold |
| Guía | 9pt bold | 11pt bold |
| Títulos secciones | 6pt bold | 7pt bold |
| Nombres personas | 7pt normal | 8pt bold |
| Total | 11pt | 14pt bold |
| Líneas separadoras | 0.5pt | 1.0pt |
| Borde Total | 0.5pt | 1.5pt |

---

## 2. QR que Lleve Directo al Envío

**Problema actual:** El QR codifica:
```
https://ejemplo.com/tracking?q=SUC01-ENV-20260128-C87880
```
El cliente escanea y ya ve el envío. **Esto ya funciona bien**.

Sin embargo, el cliente **también** necesita el tracking para consultar sin QR. Ahí está el problema: el tracking es largo.

---

## 3. Acortar el Código de Tracking

**Formato actual:**
```
{SUCURSAL}-ENV-{YYYYMMDD}-{6 chars}
Ejemplo: SUC01-ENV-20260128-C87880
Total: ~25 caracteres
```

**Propuesta - Código Corto para Clientes:**

Crear un **código corto público** adicional que sea más fácil de recordar, sin cambiar el tracking interno.

### Opción A: Mostrar solo los últimos 8 caracteres

El cliente solo necesita recordar: `28-C87880` (8 caracteres)

- El sistema buscaría por LIKE `%28-C87880` 
- Fácil de recordar y escribir
- No requiere cambios en la base de datos

### Opción B: Generar un código corto separado

Agregar columna `codigo_corto` en `envios` con formato `ABC123` (6 caracteres alfanuméricos)

- Más limpio pero requiere migración
- Búsqueda exacta más rápida

**Recomendación:** Usar **Opción A** (mostrar los últimos 8 caracteres prominentemente) porque:
- No requiere migración de datos
- El tracking completo sigue funcionando
- El cliente puede buscar con `C87880` o con el completo

### Cambios en el PDF

| Elemento | Antes | Después |
|----------|-------|---------|
| Debajo del QR | "Escanear tracking" | "Escanear o buscar con:" |
| Código visible | (ninguno) | `C87880` (en grande, negrita) |

### Cambios en Tracking.tsx y public-tracking

Modificar la búsqueda para que si el código tiene menos de 15 caracteres, busque con `ILIKE '%{codigo}'`:

```typescript
// Si el código es corto, buscar por coincidencia al final
if (codigo.length < 15) {
  query = query.ilike('tracking_number', `%${codigo}`);
} else {
  query = query.eq('tracking_number', codigo);
}
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/lib/generateShipmentReceiptPDF.ts` | Fuentes más grandes, líneas más gruesas, mostrar código corto |
| `supabase/functions/public-tracking/index.ts` | Buscar por sufijo si código es corto |
| `src/pages/Tracking.tsx` | Buscar por sufijo si código es corto |
| `src/pages/TrackingEmbed.tsx` | Buscar por sufijo si código es corto |

---

## Resultado Esperado

1. **PDF más legible** con textos negritas para impresoras láser
2. **QR sigue funcionando** igual (lleva directo al envío)
3. **Código corto visible** en el comprobante (ej: `C87880`)
4. **El cliente puede buscar** con `C87880` o con el tracking completo
5. **No se rompe nada** - el tracking largo sigue funcionando

---

## Ejemplo Visual del Código Corto en PDF

```text
┌──────────────────────────────────────────┐
│   [QR]     │  TOTAL         │            │
│            │  $ 7.370,99    │            │
│            │                │            │
│ Buscar:    │                │            │
│  C87880    │                │            │
└──────────────────────────────────────────┘
```

El código corto `C87880` se muestra en **grande y negrita** debajo del QR.

