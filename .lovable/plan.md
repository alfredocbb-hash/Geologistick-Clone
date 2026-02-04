

# Plan: Corrección de Eliminación de Tenant y Precio Flete ML

## Problema 1: Error al Eliminar Tenant

### Causa Raíz
El error `"update or delete on table 'tenants' violates foreign key constraint 'sucursales_tenant_id_fkey'"` ocurre porque hay envíos con referencias a sucursales (`sucursal_entrega_id`, `sucursal_origen_id`, etc.) que no se limpian antes de eliminar las sucursales.

### Tablas que Referencian Sucursales (21 constraints):
| Tabla | Columna FK |
|-------|------------|
| clientes | sucursal_id |
| ecommerce_sellers | sucursal_pickup_id |
| envios | sucursal_origen_id, sucursal_destino_id, sucursal_entrega_id, sucursal_retiro_id |
| hojas_ruta | sucursal_origen_id, sucursal_destino_id |
| liquidaciones_sucursal | sucursal_id |
| profiles | sucursal_id |
| rutas_frecuentes | sucursal_id |
| rutas_planificadas | sucursal_id |
| sesiones_caja | sucursal_id |
| sucursal_comisiones | sucursal_id |
| sucursal_conceptos | sucursal_id |
| sucursal_tarifas | sucursal_id |
| sucursal_zonas | sucursal_id |
| sucursales | centro_logistico_id (auto-referencia) |
| transferencias | sucursal_origen_id, sucursal_destino_id |
| vehiculos | sucursal_id |

### Solución
Corregir el orden de eliminación en `DeleteTenantDialog.tsx`:

1. **Paso crítico agregado**: Antes de eliminar sucursales, limpiar todas las columnas que referencian sucursales:
   - Limpiar `sucursal_pickup_id` en ecommerce_sellers
   - Limpiar `sucursal_id` en profiles
   - Limpiar `sucursal_origen_id`, `sucursal_destino_id`, `sucursal_entrega_id`, `sucursal_retiro_id` en envíos
   - Limpiar `sucursal_origen_id`, `sucursal_destino_id` en hojas_ruta
   - Limpiar `sucursal_id` en rutas_frecuentes y rutas_planificadas
   - Limpiar `centro_logistico_id` auto-referencia en sucursales
   - Eliminar transferencias, sucursal_comisiones, sucursal_zonas

2. **Orden corregido de eliminación**:
   - Eliminar tablas hijas ANTES de eliminar sucursales
   - Finalmente eliminar sucursales y luego tenant

---

## Problema 2: precio_flete_ml Siempre en 0

### Causa Raíz
El envío ML existente fue creado **antes** de que se corrigiera el código para extraer `lead_time.cost`. Los logs muestran:
```
[ML Sync] Shipment already exists: 46399291666
```

El código actual ya está corregido para guardar el precio, pero los envíos existentes no se actualizan.

### Evidencia en Base de Datos
```
ml_shipment_id: 46399291666  precio_flete_ml: 0.00
```

### Solución
Opciones disponibles:

**Opción A - Actualización Manual** (recomendada):
1. Eliminar el envío existente desde la UI
2. Sincronizar nuevamente para que se cree con el precio correcto

**Opción B - Script de Actualización**:
Ejecutar un SQL para re-procesar envíos ML existentes con precio 0 (requiere llamar a la API de ML para obtener lead_time.cost)

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/tenants/DeleteTenantDialog.tsx` | Corregir orden de eliminación y agregar limpieza de FKs |

---

## Sección Técnica - Código de DeleteTenantDialog

```typescript
// ORDEN CORREGIDO DE ELIMINACIÓN:

// A. Limpiar referencias en ecommerce_sellers (ANTES de eliminar sellers)
await supabase.from('ecommerce_sellers')
  .update({ sucursal_pickup_id: null })
  .eq('tenant_id', tenant.id);

// B. Limpiar referencias FK en envíos que apuntan a sucursales
await supabase.from('envios')
  .update({ 
    sucursal_origen_id: null,
    sucursal_destino_id: null,
    sucursal_entrega_id: null,
    sucursal_retiro_id: null
  })
  .eq('tenant_id', tenant.id);

// C. Limpiar referencias en hojas_ruta
await supabase.from('hojas_ruta')
  .update({
    sucursal_origen_id: null,
    sucursal_destino_id: null
  })
  .eq('tenant_id', tenant.id);

// D. Limpiar auto-referencia centro_logistico_id antes de eliminar
await supabase.from('sucursales')
  .update({ centro_logistico_id: null })
  .eq('tenant_id', tenant.id);

// E. Eliminar transferencias (referencia doble a sucursales)
await supabase.from('transferencias')
  .delete()
  .or(`sucursal_origen_id.in.(${sucursalIds.join(',')}),sucursal_destino_id.in.(${sucursalIds.join(',')})`);

// F. Eliminar sucursal_comisiones
if (sucursalIds.length > 0) {
  await supabase.from('sucursal_comisiones').delete().in('sucursal_id', sucursalIds);
  await supabase.from('sucursal_zonas').delete().in('sucursal_id', sucursalIds);
}

// G. Limpiar sucursal_id en profiles ANTES de eliminar sucursales
await supabase.from('profiles')
  .update({ sucursal_id: null })
  .eq('tenant_id', tenant.id);

// H. Limpiar vehiculos.sucursal_id
await supabase.from('vehiculos')
  .update({ sucursal_id: null })
  .eq('tenant_id', tenant.id);

// I. Ahora sí eliminar sucursales (después de limpiar todas las FKs)
await supabase.from('sucursales').delete().eq('tenant_id', tenant.id);
```

---

## Resumen de Cambios

| Problema | Solución | Estado |
|----------|----------|--------|
| Error FK al eliminar tenant | Corregir orden y limpiar referencias | Pendiente aprobación |
| precio_flete_ml = 0 | Eliminar y re-sincronizar el envío existente | Código ya corregido, datos antiguos |

