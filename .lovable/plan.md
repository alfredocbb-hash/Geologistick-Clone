

# Extraer horarios de entrega de Mercado Libre Flex y usarlos en la ruta

## Contexto actual
- La tabla `envios` ya tiene un campo `horario_preferido_entrega` con valores como `manana`, `tarde`, `noche`, `cualquier_hora`
- La API de ML devuelve en `lead_time.estimated_delivery_time.time_frame` un rango horario con `from` y `to` (ej: `from: 8, to: 14` para horario comercial)
- La API tambien indica `shipping_method.deliver_to` que puede ser `address` (domicilio) o `agency`
- Actualmente el edge function `register-ml-shipment` NO extrae esta informacion

## Solucion

### 1. Edge Function: Extraer horario de ML al registrar

**Archivo:** `supabase/functions/register-ml-shipment/index.ts`

Despues de obtener el shipment de la API de ML (linea 144), extraer el `time_frame` y mapearlo a los valores existentes del sistema:

- `time_frame.from: 8, to: 12` --> `manana`
- `time_frame.from: 12, to: 18` --> `tarde`  
- `time_frame.from: 18, to: 21` --> `noche`
- Otros rangos o sin datos --> `cualquier_hora`

Guardar este valor en `horario_preferido_entrega` al crear el envio (linea ~291).

### 2. Mostrar horario en la lista Flex

**Archivo:** `src/components/mobile/FlexScanScreen.tsx`

Agregar el horario preferido junto a la direccion en cada paquete escaneado. Mostrarlo como un badge pequenio (ej: "AM", "PM", "Noche") para que el chofer vea de un vistazo las restricciones horarias.

### 3. Usar horario en la optimizacion de ruta

**Archivo:** `src/hooks/useFlexPackages.ts`

Modificar la funcion `nearestNeighborSort` para que, ademas de la distancia, considere los horarios:
- Paquetes con horario `manana` se priorizan primero
- Paquetes con horario `tarde` despues
- Paquetes con `noche` al final
- Dentro de cada franja, se ordena por proximidad (nearest-neighbor actual)

Esto es una heuristica simple pero efectiva: primero por franja horaria, luego por distancia.

### 4. Agregar campo horario al FlexPackage

**Archivo:** `src/hooks/useFlexPackages.ts`

Agregar `horario_preferido_entrega` a la interfaz `FlexPackage` y cargarlo al escanear/agregar paquetes.

## Resumen de cambios

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/register-ml-shipment/index.ts` | Extraer `time_frame` de ML y mapear a `horario_preferido_entrega` |
| `src/hooks/useFlexPackages.ts` | Agregar campo horario a FlexPackage, ordenar por franja + distancia |
| `src/components/mobile/FlexScanScreen.tsx` | Mostrar badge de horario en cada paquete |

## Sin cambios de base de datos
El campo `horario_preferido_entrega` ya existe en la tabla `envios`. No se necesitan migraciones.
