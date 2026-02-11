

# Plan: Corregir 4 problemas reportados

## Problema 1: Flujo de e-commerce confuso (recolectar -> escanear en sucursal -> planificador)

El flujo actual de los pedidos e-commerce se salta el paso intermedio: el chofer colecta y luego los paquetes van directo al planificador sin pasar por la recepcion en sucursal. El flujo correcto que pide BeraExpress es:

1. Chofer colecta los pedidos (ya funciona con Modo Flex / Colecta Rapida)
2. Al llegar a la sucursal/centro logistico, el operador escanea los paquetes para recibirlos (**este paso ya existe** en ScanQR.tsx con "Recibir en Centro")
3. Una vez en estado `en_sucursal`, el operador los ve en el planificador y crea rutas

**Problema real**: El planificador excluye automaticamente los envios vinculados a pedidos e-commerce (linea 260 de RoutePlanner.tsx), a menos que vengan explicitamente por URL. Esto impide que los envios de e-commerce aparezcan en el planificador aunque esten en estado `en_sucursal`.

**Solucion**: Modificar el filtro del planificador para que los envios de e-commerce en estado `en_sucursal` o `recogido` **no sean excluidos**. La logica sera: excluir envios de e-commerce solo si estan en estado `pendiente` (aun no colectados).

**Archivo**: `src/pages/RoutePlanner.tsx` (linea ~260)
- Cambiar la condicion del filtro para que envios e-commerce en estados avanzados (`recogido`, `en_sucursal`, `en_reparto`) pasen al planificador sin necesidad del parametro URL.

---

## Problema 2: Conceptos basicos duplicados en Tarifas

La consulta de conceptos en `Rates.tsx` (linea 216) no filtra por `tenant_id`. Esto provoca que un tenant vea conceptos de **todos** los tenants, creando la ilusion de duplicados.

**Datos en BD** (tenant BeraExpress `94a9ea85...`):
- Tiene sus propios conceptos (`BE-FLETE`, `BE-SEGURO`, etc.)
- Ademas ve los conceptos de otros tenants (`PB-FLETE`, `FLETE`, etc.)
- Y ve conceptos globales sin tenant (`Recepcion`, `Cobros`)

**Solucion**: Filtrar la consulta de conceptos por el `tenant_id` del usuario actual, incluyendo tambien los conceptos globales (sin tenant).

**Archivo**: `src/pages/Rates.tsx` (linea ~216-222)
- Agregar `.or('tenant_id.eq.{userTenantId},tenant_id.is.null')` a la consulta de `tarifa_conceptos`

---

## Problema 3: Modo Flex - Optimizacion y geolocalizacion

Hay dos sub-problemas:

### 3a. Boton de optimizar ruta no esta visible antes de iniciar reparto
El boton "Optimizar" solo aparece dentro del mapa (`FlexMapPreview`). El chofer debe poder optimizar la ruta directamente desde la pantalla principal del Modo Flex.

**Solucion**: Agregar un boton "OPTIMIZAR RUTA" en la seccion de acciones de `FlexScanScreen.tsx`, junto a los botones existentes.

**Archivo**: `src/components/mobile/FlexScanScreen.tsx`
- Agregar boton de optimizacion entre "Ver Mapa" y "COLECTAR TODOS"
- El boton llamara a `handleOptimize` y mostrara cuantos paquetes tienen coordenadas

### 3b. Doble geolocalizacion (NewShipment guarda en `destinatario_lat/lng`, planner no lo considera)
Al crear un envio, las coordenadas se guardan en `destinatario_lat/lng`. El `geocodeEnvio` del planificador tambien guarda en `destinatario_lat/lng`. Sin embargo, el `useFlexPackages` busca `entrega_lat/lng`. Esto causa que paquetes creados normalmente no aparezcan como geolocalizados en Flex.

**Solucion**: En `useFlexPackages.ts`, al construir el `FlexPackage`, usar fallback: `entrega_lat || destinatario_lat` y lo mismo para `lng`. Ademas, en el geocode del planificador, tambien guardar en `entrega_lat/lng` cuando el tipo es entrega.

**Archivos**:
- `src/hooks/useFlexPackages.ts` (~linea 247-260): al mapear el envio a FlexPackage, usar `entrega_lat || envio.destinatario_lat`
- `src/pages/RoutePlanner.tsx` (~linea 566-574): al geocodificar, guardar tambien en `entrega_lat/entrega_lng` ademas de `destinatario_lat/destinatario_lng`

---

## Problema 4: Modo comun - Falta boton de recepcion masiva (pickup)

En `ScanQR.tsx` el modo de escaneo es uno-a-uno: el chofer escanea, confirma pickup, y luego debe escanear el siguiente. No hay un modo masivo de pickup (colectar multiples paquetes de una vez y confirmar todos juntos).

El "Modo Flex" ya tiene esta funcionalidad con "COLECTAR TODOS". El modo comun (`ScanQR.tsx`) necesita una opcion similar.

**Solucion**: Agregar un modo de "Colecta Masiva" al `ScanQR.tsx` que permita:
1. Escanear multiples paquetes en modo continuo
2. Acumularlos en una lista
3. Confirmar el pickup de todos a la vez

**Archivo**: `src/pages/ScanQR.tsx`
- Agregar un boton "Colecta Masiva" junto a los botones de accion rapida existentes (para el rol chofer)
- Al hacer click, abrir el componente `CollectScanScreen` existente (ya tiene toda la logica) en un overlay/dialog
- Esto reutiliza la funcionalidad ya creada en `CollectScanScreen.tsx`

---

## Resumen de cambios

| Archivo | Cambio |
|---------|--------|
| `src/pages/RoutePlanner.tsx` | No excluir envios e-commerce en estados avanzados + guardar `entrega_lat/lng` en geocode |
| `src/pages/Rates.tsx` | Filtrar conceptos por tenant_id del usuario |
| `src/components/mobile/FlexScanScreen.tsx` | Agregar boton OPTIMIZAR RUTA visible |
| `src/hooks/useFlexPackages.ts` | Fallback de coordenadas `entrega_lat || destinatario_lat` |
| `src/pages/ScanQR.tsx` | Agregar boton "Colecta Masiva" que abre `CollectScanScreen` |

## Sin cambios de base de datos
No se necesitan migraciones.

