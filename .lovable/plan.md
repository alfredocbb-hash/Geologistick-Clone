
# Corrección: Conceptos no visibles para BlackBox Cargas

## Problema Detectado

BlackBox Cargas **no tiene ningún concepto de tarifa propio**. Sus tarifas ("ENVIOS GENERAL" y "TERCERIZADAS EXTERNAS") referencian 7 conceptos que pertenecen a otros tenants:

| Concepto | Pertenece a |
|---|---|
| Flete | Otro tenant |
| Seguro | Otro tenant |
| Retiro a Domicilio | Otro tenant |
| Entrega a Domicilio | Otro tenant |
| Servicio de Agencia | Otro tenant |
| traslado | Otro tenant |
| TRASLADO | Otro tenant |

La politica de seguridad de la base de datos filtra conceptos por empresa, por lo que los usuarios de BlackBox no pueden ver ninguno de estos conceptos. Esto afecta:
- La pantalla de **Tarifas** (no ven conceptos para configurar precios)
- La pantalla de **Sucursales** (no ven conceptos para habilitar/deshabilitar)
- La creacion de **Nuevo Envio** (no se calculan conceptos adicionales)

## Solucion

Crear conceptos propios para BlackBox y re-apuntar las referencias existentes:

1. **Crear 5 conceptos unicos** en `tarifa_conceptos` con el `tenant_id` de BlackBox (los duplicados "traslado"/"TRASLADO" se unifican en uno solo):
   - Flete (basico)
   - Seguro (basico)
   - Retiro a Domicilio (basico)
   - Entrega a Domicilio (basico)
   - Servicio de Agencia (adicional)
   - Traslado (adicional)

2. **Actualizar `tarifa_concepto_precios`** para apuntar a los nuevos concepto IDs de BlackBox (manteniendo los montos actuales).

3. **Actualizar `sucursal_conceptos`** para apuntar a los nuevos concepto IDs de BlackBox (manteniendo las habilitaciones actuales).

4. **Actualizar `envio_detalles`** existentes (si hay) para apuntar a los nuevos concepto IDs, para que las liquidaciones funcionen correctamente.

## Detalle Tecnico

Se ejecutara un script SQL que:
- Inserta los nuevos registros en `tarifa_conceptos` con UUIDs generados
- Actualiza las FK en `tarifa_concepto_precios` (7 registros)
- Actualiza las FK en `sucursal_conceptos` (12 registros)
- Actualiza las FK en `envio_detalles` si existen registros vinculados
- No modifica esquema, solo datos
