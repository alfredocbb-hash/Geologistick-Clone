

## Plan: Incluir envíos importados con IA desde Terciarizados en "Exportar OCR"

### Situación actual

Los envíos importados con el botón **"Importar fotos con IA"** desde la pestaña Terciarizados del Planificador ya se guardan con `source_module = 'bulk_ocr_album'` (o `bulk_ocr_burst`/`bulk_ocr_manual`), por lo que **ya están incluidos** en el export OCR actual.

Sin embargo, los envíos creados **manualmente** desde el formulario de Terciarizados no tienen `source_module` asignado, por lo que no aparecen en ningún reporte filtrado por módulo.

### Cambios propuestos

| Archivo | Cambio |
|---------|--------|
| `src/components/routes/ThirdPartyShipmentsTab.tsx` | Agregar `source_module: 'third_party'` al insert de envíos creados desde el formulario manual |
| `src/pages/Reports.tsx` | Expandir el filtro del export OCR para incluir también `source_module = 'third_party'`, usando `.or('source_module.like.bulk_ocr%,source_module.eq.third_party')` |
| `src/pages/Reports.tsx` | Agregar etiqueta `third_party: 'Terciarizado'` al mapa `SOURCE_LABELS` |
| `mem://features/reports/reporte-excel-envios-ocr` | Actualizar memoria para reflejar la inclusión de terciarizados |

### Detalle técnico

**Filtro actualizado en Reports.tsx:**
```typescript
// Antes:
.like('source_module', 'bulk_ocr%')

// Después:
.or('source_module.like.bulk_ocr%,source_module.eq.third_party')
```

**Insert en ThirdPartyShipmentsTab.tsx:**
```typescript
// Agregar al objeto de inserción:
source_module: 'third_party',
```

Esto permite que tanto los envíos importados con IA como los creados manualmente desde la pestaña Terciarizados aparezcan en el Excel exportado, con su etiqueta de origen correspondiente.

