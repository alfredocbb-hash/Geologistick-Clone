

## Plan: Soporte para PV de Factura en Línea (PV 3 y 6)

### Problema
Los PV 3 y 6 son de tipo "Factura en Línea - Responsable Inscripto". AFIP no permite consultar estos PV vía WSFEv1 (error 11002). Solo los PV tipo "RECE" (1, 2, 4, 5, 7) son accesibles por API.

### Solución
Dos cambios:

**1. Mensaje claro de error en la sincronización**
Cuando AFIP devuelve error 11002, mostrar un mensaje explicativo en vez de fallar silenciosamente con "0 importados":
- "El Punto de Venta X es de tipo 'Factura en Línea' y no es consultable por web service. Solo los PV tipo RECE son sincronizables. Podés cargar estos comprobantes manualmente."

**2. Carga manual de comprobantes emitidos**
Agregar un botón "Cargar Factura Manual" en la pestaña "Emitidas" de Facturación que permita registrar facturas emitidas desde la web de AFIP (PV 3, 6, etc.) con los datos básicos:
- Tipo (A/B/C), Punto de Venta, Número, Fecha, CUIT receptor, Nombre receptor, Neto, IVA, Total, CAE
- Se insertan en la tabla `facturas` con `importada: true` y `estado: 'emitida'`

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/arca-factura/index.ts` | Detectar error 11002 en respuesta AFIP y retornar mensaje claro por tipo |
| `src/pages/Facturacion.tsx` | Agregar dialog "Cargar Factura Manual" + mostrar mensaje de error 11002 |

### Detalle técnico
- En `getUltimoComprobanteAFIP`, parsear el XML de respuesta buscando `<Code>11002</Code>` y lanzar un error específico tipo `ARCA_PV_NOT_RECE`
- En el loop de `sync_from_afip`, capturar ese error y agregarlo al array `errors` con mensaje descriptivo
- El formulario manual inserta directamente en `facturas` vía Supabase client (no necesita Edge Function)

