

# Plan: Búsqueda de Tracking Insensible a Mayúsculas/Minúsculas

## Problema Identificado

El tracking `a2100Rp1n268` no se encuentra porque:

1. **En base de datos**: Guardado como `a2100Rp1n268` (mixto)
2. **Búsqueda actual**: Busca `A2100RP1N268` (todo mayúsculas)
3. **PostgreSQL**: Comparación exacta (`=`) es case-sensitive

---

## Solución

Usar `ILIKE` (case-insensitive) o la función `UPPER()` en la consulta SQL para garantizar que la búsqueda funcione independientemente de cómo se guardó el tracking.

---

## Cambio Requerido

### Archivo: `supabase/functions/public-tracking/index.ts`

**Antes (línea 73-96):**
```typescript
let query = supabaseClient
  .from("envios")
  .select(`...`)
  .eq("tracking_number", trackingCode.toUpperCase());
```

**Después (usando ilike para búsqueda case-insensitive):**
```typescript
let query = supabaseClient
  .from("envios")
  .select(`...`)
  .ilike("tracking_number", trackingCode);
```

---

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/public-tracking/index.ts` | Cambiar `.eq()` por `.ilike()` para búsqueda case-insensitive |

---

## Resultado Esperado

| Búsqueda del usuario | Tracking en BD | Resultado |
|---------------------|----------------|-----------|
| `a2100Rp1n268` | `a2100Rp1n268` | ✅ Encontrado |
| `A2100RP1N268` | `a2100Rp1n268` | ✅ Encontrado |
| `a2100rp1n268` | `a2100Rp1n268` | ✅ Encontrado |

---

## Consideración Adicional

Opcionalmente, también se puede normalizar los trackings al guardarlos (siempre en mayúsculas) para mantener consistencia en la base de datos. Esto sería un cambio adicional en:
- `NewShipment.tsx` (al crear envíos)
- `ThirdPartyShipmentsTab.tsx` (al crear envíos terciarizados)
- `ImportShipmentsDialog.tsx` (al importar CSV)

