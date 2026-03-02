

# Priorizar entorno de produccion en facturacion

## Problema

Cuando una empresa (como Beraexpress) tiene ARCA configurado en produccion, la vista de impresion de factura (`PrintInvoice`) muestra "DOCUMENTO NO FISCAL - SANDBOX" porque la consulta a `arca_config` no filtra por entorno. Si existen ambas configuraciones (sandbox y produccion), puede devolver la de sandbox, causando que se muestre el banner incorrecto.

Ademas, el `InvoiceDataDialog` ya tiene `selectedEnvironment` con valor inicial `'production'` y el hook resuelve correctamente, pero el toggle de entorno se muestra siempre que haya ambos entornos configurados, lo cual puede confundir si la empresa ya esta en produccion.

## Plan de cambios

### 1. PrintInvoice: preferir arca_config de produccion

**Archivo**: `src/pages/PrintInvoice.tsx`

Modificar la query de `arca_config` (linea 180-194) para preferir el registro de produccion:

```typescript
const { data: arcaConfig } = useQuery({
  queryKey: ['print-invoice-arca', tenantId],
  queryFn: async () => {
    if (!tenantId) return null;
    // Intentar produccion primero
    const { data: prodConfig } = await supabase
      .from('arca_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('environment', 'production')
      .maybeSingle();
    if (prodConfig) return prodConfig;
    // Fallback a sandbox
    const { data: sbConfig } = await supabase
      .from('arca_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('environment', 'sandbox')
      .maybeSingle();
    return sbConfig;
  },
  enabled: !!tenantId,
});
```

Esto asegura que si la empresa tiene produccion configurado, la factura se muestra como documento fiscal valido (sin el banner rojo).

### 2. PrintInvoice: usar html2canvas para PDF identico a la vista previa

**Archivo**: `src/pages/PrintInvoice.tsx`

Reemplazar la generacion manual de PDF con `html2canvas` (ya instalado) para que el PDF descargado sea identico a lo que se ve en pantalla:

- Agregar `id="invoice-print-area"` al Card de la factura
- Reescribir `handleDownloadPDF` para capturar el DOM con `html2canvas` y convertirlo a PDF
- Eliminar las ~100 lineas de generacion manual con jsPDF
- Eliminar el `QRCodeCanvas` oculto (ya no necesario)

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/pages/PrintInvoice.tsx` | Preferir produccion en arca_config, PDF con html2canvas |

## Sin cambios de base de datos

No se requieren migraciones.

