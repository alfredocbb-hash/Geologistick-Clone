

## Plan: Agregar selector de Punto de Venta en Sincronización AFIP

### Problema
La sincronización desde AFIP solo consulta el punto de venta configurado en ARCA (7). Las facturas emitidas desde la web de AFIP con otro punto de venta no se importan.

### Solución
Agregar un campo de entrada de "Punto de Venta" en el dialog/botón de sincronización para que el usuario pueda indicar desde qué punto de venta importar.

### Cambios

**1. Frontend — `src/pages/Facturacion.tsx`**
- Agregar un input numérico "Punto de Venta" junto al botón "Sincronizar desde AFIP" (o en un mini-dialog previo).
- Pre-cargar el valor con el punto de venta configurado (7), pero permitir cambiarlo.
- Enviar el valor `punto_venta` en el body de la llamada a `arca-factura`.

**2. Backend — `supabase/functions/arca-factura/index.ts`**
- En la acción `sync_from_afip`, aceptar un parámetro opcional `punto_venta` en el body.
- Si viene, usarlo en lugar del `puntoVenta` de la config de ARCA.
- Esto permite consultar comprobantes de cualquier punto de venta del mismo CUIT.

### Archivos a modificar
| Archivo | Cambio |
|---------|--------|
| `src/pages/Facturacion.tsx` | Input de punto de venta + pasarlo en la llamada |
| `supabase/functions/arca-factura/index.ts` | Leer `punto_venta` opcional del body en `sync_from_afip` |

