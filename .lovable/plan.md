

# Corregir nombre de destinatario en Detalle de Envios

## Problema

Los envios de Mercado Libre no tienen `destinatario_id` (referencia a la tabla `clientes`), sino que guardan el nombre directamente en el campo `nombre_destinatario` de la tabla `envios`. La consulta actual solo busca el nombre via la relacion con `clientes`, por lo que los envios ML aparecen con "-" en la columna Destinatario.

## Solucion

Modificar `src/components/settlements/SettlementDetailDialog.tsx` en 4 puntos:

### 1. Agregar `nombre_destinatario` al SELECT de ambas queries (lineas ~101 y ~120)

Incluir el campo `nombre_destinatario` en la seleccion de envios:

```
envio:envios(tracking_number, estado, created_at, nombre_destinatario, destinatario_id, clientes:clientes!envios_destinatario_id_fkey(nombre, apellido))
```

### 2. Actualizar la logica de nombre en la generacion del PDF (linea ~248)

Cambiar:
```typescript
const nombre = destinatario ? `${destinatario.nombre || ''} ${destinatario.apellido || ''}`.trim() : '-';
```
Por:
```typescript
const nombre = destinatario 
  ? `${destinatario.nombre || ''} ${destinatario.apellido || ''}`.trim() 
  : envio?.nombre_destinatario || '-';
```

### 3. Actualizar la logica de nombre en la tabla UI (linea ~526)

Cambiar:
```typescript
{destinatario ? `${destinatario.nombre || ''} ${destinatario.apellido || ''}`.trim() : '-'}
```
Por:
```typescript
{destinatario ? `${destinatario.nombre || ''} ${destinatario.apellido || ''}`.trim() : envio?.nombre_destinatario || '-'}
```

## Resultado

Los envios manuales seguiran mostrando el nombre desde la tabla `clientes`, y los envios ML mostraran el `nombre_destinatario` almacenado directamente en el envio.
