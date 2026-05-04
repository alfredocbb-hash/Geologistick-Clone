# Selector de empresa terciarizada en OCR masivo

## Contexto

Hoy en `Planificador → Terciarizados`, al abrir el OCR masivo (`BulkOCRScreen`), solo se pide la **fecha de ingreso**. Los envíos creados quedan como `pendiente` normales, sin marcar como terciarizados ni vinculados a una empresa, lo que impide liquidarlos después en `Liquidaciones de terceros`.

## Cambios

### 1. `src/components/mobile/BulkOCRScreen.tsx`

- Nuevas props opcionales:
  - `terciarizadoMode?: boolean` — activa la UI del selector y obliga elegir empresa.
  - `defaultEmpresaTerciarizadaId?: string` (opcional, no requerido).
- Nuevo estado `empresaTerciarizadaId` + carga de empresas activas (`empresas_terciarizadas` filtradas por `tenant_id` y `activa = true`).
- En el header (junto a "Fecha de ingreso"), agregar un `Select` "Empresa terciarizada" cuando `terciarizadoMode` esté activo. Visible tanto en mobile como desktop (mismo patrón que el datepicker actual).
- Bloqueo: si `terciarizadoMode` y no hay empresa elegida, deshabilitar el botón de "Procesar"/"Iniciar" y mostrar toast "Seleccioná una empresa terciarizada".
- En los 4 puntos de `INSERT` en `envios` (OCR album, force-save duplicado, manual entry, burst — líneas ~244, ~302, ~400, ~543), agregar cuando hay empresa seleccionada:
  ```
  es_terciarizado: true,
  empresa_terciarizada_id: empresaTerciarizadaId,
  empresa_terciarizada: <nombre de la empresa elegida>,
  ```
- Ajustar `source_module` a `bulk_ocr_terciarizado` para trazabilidad.

### 2. `src/components/routes/ThirdPartyShipmentsTab.tsx`

- Pasar `terciarizadoMode` al render del dialog OCR (línea 1042):
  ```tsx
  <BulkOCRScreen
    terciarizadoMode
    defaultEmpresaTerciarizadaId={formData.empresa_terciarizada || undefined}
    onClose={...}
  />
  ```
- Invalidar también `["envios-terciarizados-pendientes"]` (ya lo hace) — sin cambios.

### 3. Otras llamadas a `BulkOCRScreen`

`MobileScanTab`, `FlexMixtoScreen`, `CollectScanScreen` — **sin cambios**. Al no pasar `terciarizadoMode`, mantienen el comportamiento actual.

## Resultado

- En `Planificador → Terciarizados`, al abrir "Importar fotos con IA", aparece un selector de empresa terciarizada junto al de fecha.
- Los envíos creados por OCR quedan marcados como terciarizados y vinculados a la empresa elegida → aparecen en `Liquidaciones de terceros` para liquidar.
- Resto de pantallas que usan el OCR masivo (chofer, Flex mixto, recolección) no se ven afectadas.
