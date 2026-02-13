
# Plan: Agregar tracking externo de empresa terciarizada al EPOD

## Problema

Cuando se descarga el EPOD de un envio terciarizado, no aparece el tracking externo ni el nombre de la empresa terciarizada. Estos campos existen en la base de datos (`tracking_externo`, `empresa_terciarizada`, `es_terciarizado`) pero no estan incluidos en la generacion del PDF.

## Cambios

### Archivo: `src/lib/generateEPODPDF.ts`

1. **Agregar campos al interface `Envio`**:
   - `tracking_externo?: string | null`
   - `empresa_terciarizada?: string | null`
   - `es_terciarizado?: boolean | null`

2. **Mostrar en el PDF**: Agregar una seccion debajo del banner de estado (o junto al tracking number) que muestre:
   - **Empresa Terciarizada**: nombre de la empresa
   - **Tracking Externo**: el codigo de seguimiento externo
   - Solo se muestra cuando `es_terciarizado === true` y hay datos disponibles

### Archivo: `src/components/shipments/ShipmentDetailsDialog.tsx`

Verificar que al pasar el `envio` a `generateEPODPDF`, los campos `tracking_externo`, `empresa_terciarizada` y `es_terciarizado` ya esten incluidos en el objeto (deberian estarlo si se hace el select completo de la tabla `envios`).

## Detalle tecnico

En el PDF, se agrega un bloque informativo despues del tracking principal:

```
TRACKING: ADMIN-ENV-20260213-640DD0
------------------------------------
[Terciarizado] Empresa: NombreEmpresa
Tracking Externo: EXT-123456789
```

Se renderiza como un recuadro con fondo gris claro, solo visible cuando `es_terciarizado` es true. El tracking externo se muestra con fuente monospace para facilitar la lectura.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/lib/generateEPODPDF.ts` | Agregar campos al interface y seccion al PDF |
| `src/components/shipments/ShipmentDetailsDialog.tsx` | Verificar que los campos se pasen correctamente |
