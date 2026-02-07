

# Mapa Interactivo para Zonas de Cobertura

## Que cambia

El dialogo actual de "Zonas de Cobertura" solo permite ingresar datos manualmente (Ciudad, Provincia, CP). Se va a agregar un **mapa interactivo** como modo principal para definir zonas, similar a como funciona en Mercado Libre.

## Como va a funcionar

El dialogo tendra dos pestanas:

- **Mapa**: Vista principal con un mapa interactivo de Google Maps donde el administrador puede:
  - Hacer clic en cualquier punto del mapa para detectar automaticamente la ciudad/localidad
  - Ver un popup de confirmacion con los datos detectados (ciudad, provincia, CP)
  - Confirmar para agregar la zona a la lista
  - Buscar localidades con un buscador integrado (autocompletado de Google Places)
  - Ver las zonas ya agregadas representadas como circulos coloreados en el mapa

- **Lista**: La interfaz actual con los campos manuales de Ciudad, Provincia y Codigo Postal (para cuando el administrador necesite ingresar datos especificos o rangos de CP)

```text
+-------------------------------------------+
|  Zonas de Cobertura -- Berazategui        |
|  [Mapa]  [Lista]                          |
+-------------------------------------------+
|  [Buscar localidad...              ]      |
|  +-------------------------------------+  |
|  |                                     |  |
|  |     Google Map                      |  |
|  |       (click para agregar)          |  |
|  |                                     |  |
|  |   [circulo azul] = zona activa      |  |
|  |                                     |  |
|  +-------------------------------------+  |
|                                           |
|  Zonas configuradas:                      |
|  [San Isidro, Buenos Aires]  [x]          |
|  [Pilar, Buenos Aires]      [x]          |
|  [Campana, Buenos Aires]    [x]          |
+-------------------------------------------+
```

## Flujo del usuario

1. Abre "Zonas de Cobertura" de una sucursal
2. Ve el mapa centrado en la ubicacion de la sucursal (si tiene coordenadas) o en Buenos Aires
3. Hace clic en una localidad del mapa (ej: San Isidro)
4. Aparece un popup: "Agregar San Isidro, Buenos Aires? CP: 1642" con botones Confirmar/Cancelar
5. Al confirmar, la zona se agrega a la lista y aparece como un circulo azul en el mapa
6. Puede repetir para agregar mas zonas
7. Tambien puede usar el buscador para encontrar localidades por nombre
8. Las zonas se pueden eliminar desde los chips debajo del mapa

## Detalle tecnico

### Archivo nuevo: `src/components/branches/CoverageMapSelector.tsx`

Componente del mapa interactivo que:
- Usa `GoogleMap` de `@react-google-maps/api` (ya disponible en el proyecto)
- Implementa `onClick` en el mapa para capturar coordenadas
- Usa `google.maps.Geocoder` para reverse-geocode el click y obtener ciudad/provincia/CP
- Renderiza `google.maps.Circle` para cada zona activa existente (radio visual de ~5km)
- Incluye un campo de busqueda con `google.maps.places.Autocomplete` para buscar localidades
- Muestra un `InfoWindow` de confirmacion al hacer click con los datos detectados

### Archivo modificado: `src/components/branches/BranchCoverageZonesDialog.tsx`

- Agregar `Tabs` con dos pestanas: "Mapa" y "Lista"
- La pestana "Mapa" renderiza el nuevo `CoverageMapSelector`
- La pestana "Lista" mantiene el formulario actual (Ciudad, Provincia, CP desde/hasta)
- Mover las funcionalidades compartidas (copiar zonas, tabla de zonas) fuera de las tabs para que sean visibles en ambas vistas
- Recibir las coordenadas de la sucursal como props para centrar el mapa

### Archivo modificado: `src/pages/Branches.tsx`

- Pasar las coordenadas `lat`/`lng` de la sucursal al dialogo de cobertura para centrar el mapa correctamente

### Logica del reverse geocoding al hacer click

```text
1. Usuario hace click en el mapa
2. Se obtienen las coordenadas (lat, lng)
3. Se llama a google.maps.Geocoder.geocode({ location: { lat, lng } })
4. Del resultado se extraen:
   - locality -> ciudad
   - administrative_area_level_1 -> provincia
   - postal_code -> codigo postal
5. Se muestra InfoWindow con los datos y botones Confirmar/Cancelar
6. Al confirmar: se ejecuta addZoneMutation con los datos
7. Se cierra el InfoWindow y el circulo aparece en el mapa
```

### Visualizacion de zonas existentes en el mapa

Las zonas ya agregadas se muestran como circulos semi-transparentes azules en el mapa. Para obtener la posicion del circulo:
- Si la zona fue agregada desde el mapa, ya tenemos las coordenadas del click
- Para zonas existentes (agregadas por texto), se geocodifica la ciudad al cargar el mapa
- Se guarda la posicion en la tabla para no re-geocodificar cada vez

### Migracion SQL

Agregar columnas `lat` y `lng` a la tabla `sucursal_zonas` para almacenar las coordenadas de cada zona y poder mostrarlas en el mapa sin necesidad de re-geocodificar:

```text
ALTER TABLE sucursal_zonas
  ADD COLUMN lat double precision,
  ADD COLUMN lng double precision;
```

### Archivos afectados

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | Agregar columnas lat/lng a sucursal_zonas |
| `src/components/branches/CoverageMapSelector.tsx` | **Nuevo** - Mapa interactivo con click y busqueda |
| `src/components/branches/BranchCoverageZonesDialog.tsx` | Agregar tabs Mapa/Lista, pasar coordenadas |
| `src/pages/Branches.tsx` | Pasar lat/lng de sucursal al dialogo |

