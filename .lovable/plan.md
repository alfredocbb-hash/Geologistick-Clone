

# Modo Flex: Crear Hoja de Ruta desde el Movil

## Contexto

Actualmente el Modo Flex solo permite crear **rutas planificadas** (reparto a puerta). Cuando un chofer necesita transportar paquetes entre sucursales, la hoja de ruta debe ser creada por la sucursal desde el panel web. Esta funcionalidad agrega una alternativa para que el chofer pueda crear la hoja de ruta directamente desde la app movil.

## Flujo propuesto

```text
Chofer escanea paquetes (igual que ahora)
          |
          v
   Tiene paquetes escaneados
          |
    +-----+------+
    |             |
    v             v
 [INICIAR      [CREAR HOJA
  REPARTO]      DE RUTA]
    |              |
    v              v
 Ruta           Seleccionar
 planificada    sucursal destino
 (a puerta)        |
                   v
                Crea hoja de ruta
                con paquetes escaneados
                   |
                   v
                Estado envios: en_transito
                Hoja estado: en_transito
                Navega a ruta activa
```

## Problema de permisos (RLS)

La politica actual de INSERT en `hojas_ruta` permite: `admin`, `supervisor`, `operador`, `despachador`, pero **NO** incluye `chofer`.

Lo mismo para `hoja_ruta_envios`: la politica de escritura (ALL) solo permite los mismos roles.

**Solucion**: Crear una funcion RPC `create_hoja_ruta_flex` con `SECURITY DEFINER` que maneje toda la logica del lado del servidor, igual que ya hacemos con `start_ruta_planificada`. Esto evita modificar las politicas RLS existentes y mantiene la seguridad.

## Cambios necesarios

### 1. Migracion SQL: Funcion `create_hoja_ruta_flex`

Crear una funcion RPC que:
- Recibe: `sucursal_destino_id`, array de `envio_ids`
- Obtiene la sucursal del chofer desde su perfil (sucursal_id del profile)
- Genera el numero de hoja de ruta usando `generate_hoja_ruta_number()`
- Crea la `hoja_ruta` con el chofer actual como `chofer_id`
- Crea los registros en `hoja_ruta_envios`
- Actualiza los envios a `en_transito` y asigna `chofer_id`
- Inicia la hoja directamente (estado `en_transito`, `inicio_real = now()`)
- Retorna el ID de la hoja creada

Tambien: actualizar `start_hoja_ruta` para que asigne `chofer_id` a los envios (misma correccion que hicimos con `start_ruta_planificada`).

### 2. Nuevo componente: `CreateRouteSheetDialog.tsx`

Un dialog movil que:
- Muestra la cantidad de paquetes escaneados
- Lista las sucursales disponibles para seleccionar destino
- Boton de confirmacion para crear la hoja de ruta
- Al confirmar, llama a la funcion RPC y navega a la ruta activa

### 3. Modificar `FlexScanScreen.tsx`

Agregar un segundo boton de accion junto a "INICIAR REPARTO":
- **INICIAR REPARTO**: funciona igual (ruta planificada, entrega a puerta)
- **HOJA DE RUTA**: abre el `CreateRouteSheetDialog` (transporte entre sucursales)

El boton de hoja de ruta solo aparece si el chofer tiene una sucursal asignada en su perfil (necesaria como sucursal origen).

### 4. Modificar `useFlexPackages.ts`

Agregar nueva funcion `createRouteSheet`:
- Recibe `sucursalDestinoId` como parametro
- Llama a la funcion RPC `create_hoja_ruta_flex`
- Limpia los paquetes al finalizar
- Retorna el ID de la hoja creada para navegar a la ruta activa

## Detalle tecnico

### Funcion SQL `create_hoja_ruta_flex`

```text
Parametros:
  - p_sucursal_destino_id: UUID
  - p_envio_ids: UUID[]

Logica:
  1. Obtener sucursal_id del perfil del chofer actual
  2. Validar que tiene sucursal asignada
  3. Validar que sucursal destino es diferente de origen
  4. Generar numero con generate_hoja_ruta_number()
  5. INSERT en hojas_ruta (origen, destino, chofer, estado=en_transito)
  6. INSERT en hoja_ruta_envios (un registro por envio)
  7. UPDATE envios: estado=en_transito, chofer_id=usuario actual
  8. Retornar {success: true, hoja_id: id, numero: numero}
```

### Correccion de `start_hoja_ruta`

Agregar asignacion de `chofer_id` y `chofer_ultima_milla_id` en el UPDATE de envios, igual que la correccion ya aplicada a `start_ruta_planificada`.

### UI del boton en FlexScanScreen

Los dos botones de accion se muestran apilados:
- "INICIAR REPARTO" (verde, igual que ahora) - para entregas a puerta
- "HOJA DE RUTA" (azul) - para transporte entre sucursales

Si el chofer no tiene sucursal asignada, el boton de hoja de ruta no aparece (no tiene sucursal origen).

## Archivos a modificar/crear

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | Crear `create_hoja_ruta_flex` + corregir `start_hoja_ruta` |
| `src/components/scan/CreateRouteSheetDialog.tsx` | **Nuevo** - Dialog para seleccionar sucursal destino |
| `src/hooks/useFlexPackages.ts` | Agregar `createRouteSheet(sucursalDestinoId)` |
| `src/components/mobile/FlexScanScreen.tsx` | Agregar boton "Hoja de Ruta" y dialog |

