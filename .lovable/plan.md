

## Problema

La consulta de conceptos de tarifa en la pantalla de comisiones de sucursales **no filtra por tenant**. Esto causa que se muestren conceptos de TODOS los tenants (Empresa Principal, Beraexpress, BlackBox, PlataBus), resultando en múltiples filas repetidas de "Flete", "Seguro", etc.

## Solución

Agregar el filtro `.eq('tenant_id', tenantId)` a la query de `tarifa_conceptos` en `src/pages/Branches.tsx` (línea ~185), que actualmente solo filtra por `activo = true`.

## Cambio técnico

**Archivo:** `src/pages/Branches.tsx`

- Línea 181-192: Agregar filtro de tenant a la query de conceptos
- Agregar `tenantId` como dependencia del `queryKey` para que se recargue si cambia
- Habilitar la query solo cuando `tenantId` esté disponible

```typescript
const { data: conceptos = [] } = useQuery({
  queryKey: ['tarifa_conceptos', tenantId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('tarifa_conceptos')
      .select('*')
      .eq('activo', true)
      .eq('tenant_id', tenantId)
      .order('orden');
    if (error) throw error;
    return data as TarifaConcepto[];
  },
  enabled: !!tenantId,
});
```

Es un cambio de una sola línea que resuelve el problema de raíz.

