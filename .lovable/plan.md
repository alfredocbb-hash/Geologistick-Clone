
# Correccion sistematica: Conceptos de tarifa cross-tenant

## Problema

La correccion anterior solo arreglo **BlackBox Cargas**. Hay **2 tenants mas** con el mismo problema:

| Tenant | Conceptos ajenos | En precios | En sucursales | En envio_detalles |
|---|---|---|---|---|
| **Beraexpress** | Flete, Seguro, Retiro, Entrega, Embalaje (de Empresa Principal) | 15 registros | 2 registros | 41 registros |
| **PlataBus Cargas** | Flete, Seguro, Entrega (de Empresa Principal) | 3 registros | 0 registros | 0 registros |

Ademas, **no hay ninguna proteccion** para evitar que esto vuelva a ocurrir en el futuro. El codigo de `Rates.tsx` guarda el `concepto_id` directamente sin validar que pertenezca al mismo tenant.

## Solucion en 2 partes

### Parte 1: Datos - Crear conceptos nativos para Beraexpress y PlataBus

Mismo patron que se uso para BlackBox:

**Beraexpress** (ya tiene 3 propios: traslado, Servicio de Agencia, TRASLADO) - Crear 5 faltantes:
- Flete (basico)
- Seguro (basico)
- Retiro a Domicilio (basico)
- Entrega a Domicilio (basico)
- Embalaje (adicional)

Luego re-apuntar las FK en `tarifa_concepto_precios` (15), `sucursal_conceptos` (2), y `envio_detalles` (41).

**PlataBus Cargas** - Crear 3 conceptos:
- Flete (basico)
- Seguro (basico)
- Entrega a Domicilio (basico)

Luego re-apuntar las FK en `tarifa_concepto_precios` (3).

### Parte 2: Prevencion - Trigger de validacion en base de datos

Crear un trigger en `tarifa_concepto_precios` que al hacer INSERT o UPDATE valide que el `concepto_id` pertenezca al mismo `tenant_id` que la tarifa. Esto previene que cualquier tenant futuro referencie conceptos ajenos.

```sql
CREATE FUNCTION validate_concepto_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT tenant_id FROM tarifa_conceptos WHERE id = NEW.concepto_id) 
     != (SELECT tenant_id FROM tarifas WHERE id = NEW.tarifa_id) THEN
    RAISE EXCEPTION 'El concepto no pertenece al mismo tenant que la tarifa';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Detalle tecnico

### Migracion SQL para Beraexpress

1. Insertar 5 conceptos con tenant_id `94a9ea85-43c5-49ac-9bfa-86843072c2ce`
2. Mapear cada concepto ajeno al nuevo ID nativo en las 3 tablas de FK
3. Unificar duplicados traslado/TRASLADO si aplica

### Migracion SQL para PlataBus

1. Insertar 3 conceptos con tenant_id `3df5f6f8-de9c-48d9-8384-7a5de181670f`
2. Mapear en `tarifa_concepto_precios` (3 registros)

### Trigger de prevencion

Se crea en `tarifa_concepto_precios` para INSERT y UPDATE, validando que `concepto.tenant_id == tarifa.tenant_id`.

### Resumen de cambios

- Solo cambios en base de datos (datos + 1 trigger)
- No hay cambios en codigo frontend (la UI ya usa `concepto_id` correctamente, el problema era solo de datos y falta de constraint)
- Total: ~60 registros a actualizar, 8 conceptos nuevos, 1 trigger
