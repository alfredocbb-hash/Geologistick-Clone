
El EPOD muestra las coordenadas correctas pero no renderiza la imagen del mapa estático. Mirando `generateEPODPDF.ts`, el static map se genera solo si se pasa `mapsApiKey` como parámetro. Necesito verificar dónde se llama `generateEPODPDF` para ver si se está pasando la API key.

Déjame revisar el llamador.
<lov-tool-use id="toolu_vrtx_01HMxqQUGqJaGFR2v9cSrcGB" name="code--search_files" integration-id="code" data="{\"query\": \"generateEPODPDF\", \"include_patterns\": \"*.tsx,*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01KXsHZRs7wUu5btZpejUtyU" name="code--search_files" integration-id="code" data="{\"query\": \"generateEPODPDF\", \"include_patterns\": \"*.tsx,*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_019YDnZvzJ3aLQzi1XpxrrMa" name="code--view" integration-id="code" data="{\"file_path\": \"src/lib/generateEPODPDF.ts\", \"lines\": \"100-250\"}">
</lov-tool-use>
The map generation code is in place. The issue is that in the PDF the map isn't being rendered—likely `mapBase64` is null. Let me check how it's drawn and why it might fail.
<lov-tool-use id="toolu_vrtx_016yHcuk7GDYswjaCvQdzhxK" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/lib/generateEPODPDF.ts\", \"query\": \"mapBase64|GPS|Ubicacion\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01N4EUDg9sdFtefyH3Qwv24d" name="code--view" integration-id="code" data="{\"file_path\": \"src/lib/generateEPODPDF.ts\", \"lines\": \"270-330\"}">
</lov-tool-use>
The PDF in the screenshot shows GPS coords but no map image — meaning `mapBase64` is null. The Static Maps URL fetch likely failed. Possible reasons:
1. The Google Maps API key from `useMapsApiKey`/`get-maps-config` may have HTTP referrer restrictions blocking Static Maps API or the key may not have Static Maps API enabled.
2. CORS: the Static Maps API does serve images cross-origin but `fetch()` + `blob()` requires CORS headers. Google Static Maps responses are CORS-friendly (with no-cors but readable). Actually they DO send `Access-Control-Allow-Origin: *`. So fetch should work IF the key allows it.

Let me check `useMapsApiKey` usage in `ShipmentDetailsDialog`.
<lov-tool-use id="toolu_vrtx_01QHk7SZ34Sydfi8zhcXNRB6" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/components/shipments/ShipmentDetailsDialog.tsx\", \"query\": \"mapsApiKey|useMapsApiKey\"}">
</lov-tool-use>
OK, key comes from `useGoogleMaps()` which loads via JS API loader with `key=...&libraries=places,geometry,visualization`. That key should also work for Static Maps if Static Maps API is enabled in GCP. The fetch fails silently in `loadImageAsBase64`.

The fix could be: instead of fetching+base64, call Static Maps via an Edge Function that proxies and returns base64 (server-side, no CORS/referrer issues). Or simpler: render an `<img>` then convert via canvas. But simplest: add an edge function `static-map` that fetches with the server-side key and returns base64.

Let me check console logs to confirm the actual failure.
<lov-tool-use id="toolu_vrtx_01VvFYs2GW15paXBki5n8aJp" name="code--read_console_logs" integration-id="code" data="{\"search\": \"staticmap\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0151Q3QeJsD98sVcSWu1JU9D" name="code--read_network_requests" integration-id="code" data="{\"search\": \"staticmap\"}">
</lov-tool-use>
<lov-plan>
## Problema
El EPOD muestra coordenadas y link de Google Maps pero **no la imagen del mapa**. La función `generateEPODPDF` ya intenta descargar un Static Map (líneas 132-167 y 298-319 en `src/lib/generateEPODPDF.ts`), pero el `fetch()` directo a `https://maps.googleapis.com/maps/api/staticmap` con la API key del cliente falla silenciosamente — típicamente por una de estas causas:

1. La API key cargada vía `useGoogleMaps()` está restringida por **HTTP referrer** y/o no tiene habilitada la **Static Maps API** en GCP.
2. CORS / política del navegador bloquea la lectura del blob como base64.

El bloque `try/catch` en `loadImageAsBase64` devuelve `null` sin logs, así que el PDF se genera sin imagen.

## Solución
Crear una nueva **Edge Function `static-map`** que actúe como proxy server-side: recibe `lat`, `lng`, `zoom`, `size` y devuelve la imagen PNG (o base64) usando la misma key que ya usa `get-maps-config` (resuelta desde `system_integrations` o env). Server-side no hay restricciones de referrer ni CORS y la key se mantiene segura.

Luego modificar `generateEPODPDF.ts` para llamar a esa edge function (vía `supabase.functions.invoke`) en vez de hacer `fetch` directo al endpoint público de Google.

### Cambios

| Archivo | Cambio |
|---|---|
| `supabase/functions/static-map/index.ts` (nuevo) | Edge function autenticada que toma `lat/lng/zoom/size`, resuelve la API key del tenant (igual lógica que `get-maps-config`), llama a `https://maps.googleapis.com/maps/api/staticmap?...`, y retorna `{ image: "data:image/png;base64,..." }` |
| `src/lib/generateEPODPDF.ts` | Reemplazar `loadImageAsBase64(staticMapUrl)` por una llamada a `supabase.functions.invoke('static-map', { body: { lat, lng } })`. Mantener fallback "Mapa no disponible" si falla. Quitar el helper `generateStaticMapUrl` (ya no se necesita en cliente). El parámetro `mapsApiKey` se vuelve opcional (sólo se usa para detectar si hay capacidad de mapas). |
| `src/components/shipments/ShipmentDetailsDialog.tsx` | Sin cambios funcionales (sigue invocando `generateEPODPDF`). |

### Lógica de la edge function (resumen)
- Validar JWT del usuario (igual que `get-maps-config`).
- Resolver `tenant_id` desde `profiles`.
- Buscar API key activa en `system_integrations` (production → sandbox), fallback a env var.
- Hacer `fetch` server-side al Static Map URL con `markers=color:red|<lat>,<lng>`, `zoom=16`, `size=400x200`, `scale=2`.
- Convertir respuesta a base64 y devolver `{ image: 'data:image/png;base64,...' }`.

### Riesgo
Bajo. La función nueva no rompe nada existente; si falla, el PDF cae al estado actual (sin mapa) pero con coordenadas y link visibles.

### Verificación posterior
Regenerar el EPOD del envío 1564 y comprobar que la imagen del mapa aparece centrada en las coordenadas correctas.
