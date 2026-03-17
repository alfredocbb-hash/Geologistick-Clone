

# Plan: Dos correcciones

## 1. Suscripción: mostrar conteo real de usuarios y sucursales

**Problema**: `tenant_usage` tiene `users_count` y `branches_count` siempre en 0. Las edge functions devuelven ese valor estático.

**Solución**: En ambas edge functions, después de leer `tenant_usage`, hacer queries de conteo real a `profiles` y `sucursales`.

### Archivos a modificar

**`supabase/functions/check-subscription/index.ts`** — En los 3 puntos donde se construye `usage` (líneas ~110-129, ~147-165, ~231-251), agregar antes del return:

```typescript
const { count: usersCount } = await supabaseClient
  .from("profiles")
  .select("*", { count: "exact", head: true })
  .eq("tenant_id", tenantId);

const { count: branchesCount } = await supabaseClient
  .from("sucursales")
  .select("*", { count: "exact", head: true })
  .eq("tenant_id", tenantId)
  .eq("activa", true);
```

Y reemplazar el campo `usage` en cada respuesta por:
```typescript
usage: {
  shipments_count: usage?.shipments_count || 0,
  users_count: usersCount || 0,
  branches_count: branchesCount || 0,
},
```

**`supabase/functions/mp-check-subscription/index.ts`** — Mismo patrón en los 3 puntos de retorno (líneas ~97-115, ~136-154, ~172-190).

---

## 2. Etiquetas: eliminar selector de tamaño, usar solo Compacta

**Problema**: El usuario quiere que al imprimir etiquetas salga directamente en formato compacto (10×15 cm) sin opciones de tamaño.

**Solución en `src/pages/PrintLabel.tsx`**:
- Eliminar el tipo `LabelSize`, las constantes `LABEL_SIZES` (standard/large), y el state `labelSize`
- Hardcodear el tamaño compact: `widthMm: 100, heightMm: 150, orientation: 'portrait', qrSize: 30`
- Eliminar el `Select` de tamaño del header (líneas 594-607)
- En `handlePrint`, usar directamente los valores compact sin referencia a `LABEL_SIZES`

### Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/check-subscription/index.ts` | Conteo dinámico de usuarios/sucursales |
| `supabase/functions/mp-check-subscription/index.ts` | Conteo dinámico de usuarios/sucursales |
| `src/pages/PrintLabel.tsx` | Eliminar selector de tamaño, forzar compacta |

