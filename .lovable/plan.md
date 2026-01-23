

# Plan: Corregir Reconocimiento de QR para Tracking Case-Insensitive

## Problema Identificado

El QR no es reconocido por la app del chofer debido a dos problemas:

1. **`qrParser.ts` (línea 82)**: Convierte el tracking extraído a mayúsculas (`tracking.toUpperCase()`)
2. **`ActiveRouteNavigation.tsx` (línea 327)**: Usa `.eq()` (comparación exacta, case-sensitive)

**Ejemplo del flujo actual:**
```
QR escaneado: "a2100Bp1n268"
         ↓
qrParser.ts → "A2100BP1N268" (convertido a mayúsculas)
         ↓
Búsqueda con .eq('tracking_number', 'A2100BP1N268')
         ↓
Base de datos tiene: "a2100Bp1n268" (mixto)
         ↓
❌ NO ENCONTRADO (PostgreSQL es case-sensitive con =)
```

---

## Solución

### Opción A: Mantener la normalización y usar `.ilike()` en todas partes (Recomendado)
Esto garantiza que cualquier búsqueda funcione sin importar el formato del tracking.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/ActiveRouteNavigation.tsx` | Cambiar `.eq()` por `.ilike()` en línea 327 |
| `src/lib/qrParser.ts` | **Opcional**: Remover `.toUpperCase()` para preservar el case original |

---

## Cambio Principal

### Archivo: `src/pages/ActiveRouteNavigation.tsx`

**Línea 327 - Antes:**
```typescript
.eq('tracking_number', data)
```

**Después:**
```typescript
.ilike('tracking_number', data)
```

---

## Cambio Opcional (Normalización consistente)

### Archivo: `src/lib/qrParser.ts`

**Líneas 79-84 - Antes:**
```typescript
if (tracking && tracking.length >= 5) {
  return {
    type: 'tracking',
    value: tracking.toUpperCase(),  // ← Convierte a mayúsculas
    originalData: data
  };
}
```

**Después:**
```typescript
if (tracking && tracking.length >= 5) {
  return {
    type: 'tracking',
    value: tracking,  // ← Preserva el case original
    originalData: data
  };
}
```

**Nota**: Este cambio es opcional si usamos `.ilike()` en todas las búsquedas, pero es más limpio preservar el case original.

---

## Verificación de Consistencia

Otros archivos que ya usan `.ilike()` correctamente:
- `src/pages/ScanQR.tsx:189` ✅
- `src/pages/ScanQR.tsx:210` ✅  
- `src/components/mobile/MobileScanTab.tsx:111` ✅
- `src/components/mobile/MobileScanTab.tsx:124` ✅
- `supabase/functions/public-tracking/index.ts:96` ✅

---

## Flujo Corregido

```
QR escaneado: "a2100Bp1n268"
         ↓
qrParser.ts → "a2100Bp1n268" (preservado) o "A2100BP1N268" (normalizado)
         ↓
Búsqueda con .ilike('tracking_number', 'a2100Bp1n268')
         ↓
Base de datos tiene: "a2100Bp1n268"
         ↓
✅ ENCONTRADO (ILIKE ignora mayúsculas/minúsculas)
```

---

## Resumen de Cambios

1. **Obligatorio**: Actualizar `ActiveRouteNavigation.tsx` para usar `.ilike()`
2. **Opcional pero recomendado**: Remover `.toUpperCase()` de `qrParser.ts` para consistencia

