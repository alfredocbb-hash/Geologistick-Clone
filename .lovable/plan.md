
El usuario reporta que al exportar OCR desde Reportes, no se respeta el período personalizado seleccionado.

Reviso `handleExportOCR` en `src/pages/Reports.tsx`.
<lov-tool-use id="toolu_vrtx_013fvT7QMcPs8xroT32BbgQw" name="code--search_files" integration-id="code" data="{\"query\": \"handleExportOCR\", \"include_patterns\": \"src/pages/Reports.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013SVWyLX7aLBXrJ9iggorTf" name="code--search_files" integration-id="code" data="{\"query\": \"handleExportOCR\", \"include_patterns\": \"src/pages/Reports.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Dn18X1NDpYQd8bRxcK5xbq" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/Reports.tsx\", \"lines\": \"40-180\"}">
</lov-tool-use>
Confirmado el bug en línea 82-83: `handleExportOCR` siempre usa el `preset.getValue()`, ignorando `customFrom`/`customTo` cuando el usuario eligió "Personalizado".

<lov-plan>
## Bug
En `Reports.tsx` línea 82-83, `handleExportOCR` calcula el rango así:
```ts
const preset = DATE_PRESETS.find(p => p.label === datePreset) || DATE_PRESETS[2];
const { from, to } = preset.getValue();
```
Siempre usa el `getValue()` del preset, así que cuando el usuario eligió **"Personalizado"** y cargó `customFrom`/`customTo`, esos valores se ignoran y se exporta otro rango (probablemente el default).

El resto del dashboard (`useReportsData`) sí respeta el rango custom porque construye `dateFrom/dateTo` correctamente — solo este export quedó desincronizado.

## Fix
Usar la misma lógica que el resto: si `datePreset === 'Personalizado'` y existen `customFrom`/`customTo`, usar esos valores; si no, caer al preset.

```ts
let from: Date, to: Date;
if (datePreset === 'Personalizado' && customFrom && customTo) {
  from = customFrom;
  to = customTo;
} else {
  const preset = DATE_PRESETS.find(p => p.label === datePreset) || DATE_PRESETS[2];
  ({ from, to } = preset.getValue());
}
```

Cambio puntual de ~6 líneas en `src/pages/Reports.tsx` (handleExportOCR).

## Verificación
1. En Reportes, elegir "Personalizado", cargar un rango específico (ej: 01/03 al 15/03).
2. Click en "Exportar OCR" → el Excel debe contener solo envíos OCR/terciarizados creados dentro de ese rango.
3. Probar también con un preset (ej: "Última Semana") para confirmar que sigue funcionando.

## Riesgo
Nulo. Cambio aislado a una función de export.
