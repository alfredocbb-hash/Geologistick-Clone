

# Mostrar Hoja de Ruta / Ruta en el historial del envío

## Problema
El historial del envío muestra cambios de estado pero no indica en qué hoja de ruta o ruta planificada se encontraba el envío en ese momento. El operador no puede rastrear qué transporte movió el paquete.

## Solución

### `src/components/shipments/ShipmentHistoryDialog.tsx`

**1. Consultar las hojas de ruta y rutas planificadas del envío** junto con el historial existente:

```typescript
// Fetch hojas de ruta donde participó este envío
const { data: hojasData } = await supabase
  .from('hoja_ruta_envios')
  .select('hoja_ruta_id, hojas_ruta:hojas_ruta!hoja_ruta_envios_hoja_ruta_id_fkey(numero, estado, sucursal_origen:sucursales!hojas_ruta_sucursal_origen_id_fkey(nombre), sucursal_destino:sucursales!hojas_ruta_sucursal_destino_id_fkey(nombre))')
  .eq('envio_id', envioId);

// Fetch rutas planificadas donde participó este envío
const { data: rutasData } = await supabase
  .from('ruta_paradas')
  .select('ruta_id, rutas_planificadas:rutas_planificadas!ruta_paradas_ruta_id_fkey(numero, estado)')
  .eq('envio_id', envioId);
```

Construir un mapa de lookup: para cada entrada del historial donde `estado_nuevo` sea `en_transito` o `en_reparto`, buscar la hoja/ruta correspondiente por proximidad temporal o por el estado.

**2. Enfoque simplificado**: En vez de correlacionar por timestamp (complejo), mostrar una sección fija arriba del timeline con las rutas/hojas asociadas al envío:

```tsx
{/* Rutas asociadas */}
{(hojas?.length > 0 || rutas?.length > 0) && (
  <div className="mb-4 space-y-2">
    <p className="text-xs font-medium text-muted-foreground uppercase">Rutas asociadas</p>
    {hojas.map(h => (
      <div className="flex items-center gap-2 text-sm bg-muted/30 rounded px-3 py-2">
        <Truck className="h-3.5 w-3.5" />
        <span className="font-mono text-xs">{h.numero}</span>
        <span className="text-muted-foreground">
          {h.sucursal_origen.nombre} → {h.sucursal_destino.nombre}
        </span>
        <Badge variant="outline" className="text-xs ml-auto">{h.estado}</Badge>
      </div>
    ))}
    {rutas.map(r => (
      <div className="flex items-center gap-2 text-sm bg-muted/30 rounded px-3 py-2">
        <Route className="h-3.5 w-3.5" />
        <span className="font-mono text-xs">{r.numero}</span>
        <Badge variant="outline" className="text-xs ml-auto">{r.estado}</Badge>
      </div>
    ))}
    <Separator />
  </div>
)}
```

**3. Enriquecer entradas del timeline**: Para las entradas con `estado_nuevo = 'en_transito'`, agregar debajo de la ubicación un badge con el número de hoja de ruta. Para `estado_nuevo = 'en_reparto'`, mostrar el número de ruta planificada.

La correlación se hace comparando timestamps: la hoja/ruta cuya fecha de inicio sea más cercana (y anterior) al `created_at` del historial entry.

