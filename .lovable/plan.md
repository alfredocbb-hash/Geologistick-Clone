

# Visibilidad de Conceptos para Super Admin + Concepto con Importe Libre

## Problema 1: No se ven los conceptos de otros tenants

Actualmente, aunque la base de datos permite al super admin ver todos los conceptos (la politica de seguridad lo permite), el codigo del frontend en `Rates.tsx` aplica un filtro adicional que solo muestra conceptos del tenant del usuario logueado. Si el super admin pertenece a un tenant distinto de "Black Box", no ve sus conceptos.

**Solucion**: Cuando el usuario es super admin, no aplicar el filtro de tenant en la consulta de conceptos.

## Problema 2: Concepto con importe editable por sucursal

Se necesita que ciertos conceptos (como "Servicio de agencia") permitan que el operador ingrese un importe libre al crear un envio, en lugar de usar un monto fijo predefinido en la tarifa. Ademas, esto debe ser configurable por sucursal.

**Solucion**: Agregar un campo `monto_editable` a la tabla `tarifa_conceptos`. Cuando este flag esta activo y el concepto esta seleccionado al crear un envio, se muestra un input numerico en lugar del badge con precio fijo.

## Cambios en base de datos

**Migracion**: Agregar columna `monto_editable` (boolean, default false) a `tarifa_conceptos`.

```sql
ALTER TABLE public.tarifa_conceptos 
ADD COLUMN monto_editable BOOLEAN DEFAULT false;
```

## Cambios en el frontend

### `src/pages/Rates.tsx`

1. **Query de conceptos (linea ~212-230)**: Si `isSuperAdmin()`, no aplicar el filtro `.or(tenant_id.eq..., tenant_id.is.null)`. Traer todos los conceptos y mostrar a que tenant pertenece cada uno.
2. **Formulario de concepto (linea ~1516-1535)**: Agregar un switch "Importe editable" debajo del toggle de Basico/Adicional. Cuando esta activo, significa que el operador puede ingresar un monto libre al crear el envio.
3. **Tabla de conceptos**: Mostrar un badge o indicador cuando el concepto tiene `monto_editable = true`.

### `src/pages/NewShipment.tsx`

1. **Interfaces**: Agregar `monto_editable` al tipo `TarifaConcepto`.
2. **Estado para montos editables (~linea 274)**: Agregar un estado `montosEditables: Record<string, string>` para guardar los importes que el operador ingresa manualmente.
3. **Seccion de conceptos adicionales (~linea 2338-2376)**: Cuando un concepto tiene `monto_editable = true`, mostrar un Input numerico al lado del checkbox en lugar del badge con precio fijo. El operador escribe el importe que desee.
4. **Calculo de total (~linea 593-614)**: Para conceptos con `monto_editable`, usar el valor del estado `montosEditables[concepto_id]` en lugar del `monto` de la tarifa.
5. **Mutation de creacion (~linea 855)**: Al insertar los `envio_detalles`, usar el monto personalizado para conceptos editables.

### `src/integrations/supabase/types.ts`

Se actualizara automaticamente al aplicar la migracion (campo `monto_editable` en `tarifa_conceptos`).

## Flujo de uso

1. Admin de Black Box crea el concepto "Servicio de agencia" como **Adicional** con **Importe editable** activado
2. Lo habilita solo para las sucursales que quiere (usando el dialogo de sucursales que ya existe)
3. Configura un precio por concepto en la tarifa (este sera el valor sugerido/default, puede ser $0)
4. Cuando un operador de una sucursal habilitada crea un envio, ve "Servicio de agencia" como concepto adicional con un campo de texto para ingresar el importe
5. El operador escribe el monto que corresponda y se suma al total del envio

## Resumen de archivos

| Archivo | Cambio |
|---|---|
| Migracion SQL | Agregar `monto_editable` a `tarifa_conceptos` |
| `src/pages/Rates.tsx` | Quitar filtro tenant para super admin; agregar switch "Importe editable" en formulario y tabla |
| `src/pages/NewShipment.tsx` | Input de monto libre para conceptos editables; ajustar calculo de totales |
