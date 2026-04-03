

## Plan: Fix "Planificar Ruta" después de OCR masivo

### Problema raíz
El botón "PLANIFICAR RUTA" navega a `/route-planner?envios=ids`, pero esa ruta **no existe**:
- En **web**, la ruta del planificador es `/planner` (no `/route-planner`)
- En **nativo (APK)**, no existe ninguna ruta de planificador — el wildcard `*` redirige a `MobileAppLayout`, por eso "vuelve a la pantalla anterior"

### Solución

**`src/components/mobile/BulkOCRScreen.tsx`**:
- Cambiar `navigate('/route-planner?envios=...')` → `navigate('/planner?envios=...')`

**`src/components/scan/MLRegisterDialog.tsx`**:
- Mismo fix: cambiar `/route-planner` → `/planner`

**`src/App.tsx`** (para soporte nativo):
- Agregar la ruta `/planner` dentro de `NativeAppWrapper` para que funcione en la APK:
```
<Route path="/planner" element={<RoutePlanner />} />
```
Esto va junto a las rutas existentes `/route-start` y `/active-route`.

### Archivos a modificar
- `src/components/mobile/BulkOCRScreen.tsx` — Fix ruta `/route-planner` → `/planner`
- `src/components/scan/MLRegisterDialog.tsx` — Fix ruta `/route-planner` → `/planner`
- `src/App.tsx` — Agregar ruta `/planner` en NativeAppWrapper para que funcione desde la APK

