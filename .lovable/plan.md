
## Objetivo
Permitir editar la direccion y geolocalización de un envío directamente desde el popup del Planificador de Rutas, sin necesidad de salir de la vista.

---

## Analisis del Estado Actual

El popup `ShipmentMapPopup` actualmente muestra:
- Tracking, tipo (retiro/entrega), estado
- Cliente, direccion, ciudad, telefono
- Estado de coordenadas (geolocalizado o sin coordenadas)
- Botones: "Geolocalizar" (solo si no tiene coords) y "Ver detalles"

La funcionalidad existente de "Geolocalizar" usa geocodificacion automatica basada en la direccion actual, pero no permite **corregir manualmente** la direccion antes de geolocalizar.

---

## Cambios Propuestos

### 1) Nuevo componente: `EditShipmentLocationDialog`
Ubicacion: `src/components/routes/EditShipmentLocationDialog.tsx`

Un dialogo dedicado para editar la direccion y coordenadas de un envío:
- Input de direccion con **AddressAutocomplete** (Google Places)
- Campos manuales para ciudad
- Muestra coordenadas capturadas automaticamente al seleccionar del autocompletado
- Boton "Guardar" que actualiza la tabla `envios` con:
  - Si es tipo "retiro": `direccion_retiro`, `ciudad_retiro`, `remitente_lat`, `remitente_lng`
  - Si es tipo "entrega": `direccion_entrega`, `ciudad_entrega`, `destinatario_lat`, `destinatario_lng`

### 2) Modificar `ShipmentMapPopup`
Agregar un boton "Editar Ubicacion" junto a los botones existentes:
- Visible siempre (tenga o no coordenadas)
- Al hacer clic, abre el nuevo `EditShipmentLocationDialog`
- Incluir callback para refrescar datos del planificador tras edicion exitosa

### 3) Integrar en `RoutePlanner.tsx`
- Agregar estado para controlar apertura del dialogo de edicion
- Pasar la funcion de invalidacion de queries para refrescar la lista de envíos

---

## Flujo de Usuario

1. Usuario selecciona envíos en el planificador
2. Hace clic en un marcador del mapa o en la tabla
3. Aparece el popup con informacion del envío
4. Hace clic en "Editar Ubicacion"
5. Se abre un dialogo con:
   - Campo de direccion con autocompletado de Google
   - Campo de ciudad (auto-rellenado)
   - Indicador visual de coordenadas capturadas
6. Usuario busca/selecciona nueva direccion
7. Guarda cambios
8. El popup se cierra y la lista se actualiza automaticamente

---

## Detalles Tecnicos

### Estructura del nuevo dialogo

```text
+------------------------------------------+
| Editar Ubicacion                         |
|------------------------------------------|
| Tracking: ADMIN-ENV-XXXXX                |
| Tipo: [Retiro/Entrega]                   |
|                                          |
| Direccion actual:                        |
| [Calle 9 5343, Berazategui]              |
|                                          |
| Nueva direccion: *                       |
| [____________________________] (autocomplete)
|                                          |
| Ciudad:                                  |
| [____________________________]           |
|                                          |
| [check] Coordenadas: -34.76, -58.21      |
|                                          |
|              [Cancelar] [Guardar]        |
+------------------------------------------+
```

### Campos a actualizar segun tipo

| Campo              | Retiro              | Entrega              |
|--------------------|---------------------|----------------------|
| Direccion          | direccion_retiro    | direccion_entrega    |
| Ciudad             | ciudad_retiro       | ciudad_entrega       |
| Latitud            | remitente_lat       | destinatario_lat     |
| Longitud           | remitente_lng       | destinatario_lng     |

### Dependencias utilizadas
- `AddressAutocomplete` (ya existe en `src/components/maps/`)
- `GoogleMapsProvider` (ya existe)
- `useMutation` + `useQueryClient` para actualizar y refrescar

---

## Archivos Involucrados

| Archivo | Accion |
|---------|--------|
| `src/components/routes/EditShipmentLocationDialog.tsx` | **Crear** - Nuevo dialogo de edicion |
| `src/components/maps/ShipmentMapPopup.tsx` | **Modificar** - Agregar boton "Editar Ubicacion" y prop de callback |
| `src/pages/RoutePlanner.tsx` | **Modificar** - Integrar estado y dialogo de edicion |

---

## Validaciones

- La direccion es requerida
- Mostrar advertencia si se guarda sin coordenadas (aunque permitirlo)
- Al guardar exitosamente:
  - Invalidar query `envios-planificador`
  - Cerrar dialogo de edicion
  - Cerrar popup del mapa
  - Mostrar toast de confirmacion

---

## Resultado Esperado

Los usuarios podran corregir direcciones incorrectas o mal geolocalizadas directamente desde el planificador, mejorando la precision de las rutas sin necesidad de ir a otra pantalla.
