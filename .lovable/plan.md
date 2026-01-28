
# Plan: Corregir 3 Problemas en Hoja de Reparto, Planificador y Envíos

## Resumen de Problemas Identificados

| # | Problema | Archivo Afectado | Causa Raíz |
|---|----------|------------------|------------|
| 1 | Observaciones no aparecen en hoja de reparto | `PrintPlannedRoute.tsx` | El campo `notas` del envío no se consulta ni muestra |
| 2 | Nombre "Echevarria" aparece incorrectamente en mapa del planificador | `ShipmentMapPopup.tsx` | No usa `nombre_remitente`/`nombre_destinatario` del envío |
| 3 | Campos del destinatario desaparecen al seleccionar cuenta corriente | `NewShipment.tsx` | Condición lógica incorrecta oculta la sección |

---

## Problema 1: Observaciones en Hoja de Reparto

### Situación Actual
- El query obtiene `descripcion` pero NO obtiene el campo `notas` del envío
- La tabla de paradas no tiene columna para mostrar observaciones

### Solución
1. Agregar `notas` al select del query de envíos
2. Agregar una fila debajo de cada parada para mostrar las notas cuando existan

### Cambio en Query

Se modificará la consulta para incluir el campo:

```
envio:envios(
  tracking_number,
  ...
  descripcion,
  notas,          ← AGREGAR
  cantidad_bultos,
  ...
)
```

### Cambio en Renderizado

Agregar una fila adicional debajo de cada parada para mostrar observaciones:

```
┌────────────────────────────────────────────────────────────────────┐
│ # │ Tipo │ Tracking │ Cliente │ Dirección │ Tel │ COD │ ✓ │
├───┼──────┼──────────┼─────────┼───────────┼─────┼─────┼───┤
│ 1 │  E   │ GEO-001  │ Juan    │ Calle 123 │ ... │ $50 │ □ │
│   │      │ 📝 Dejar en portería, tocar timbre 3          │
├───┼──────┼──────────┼─────────┼───────────┼─────┼─────┼───┤
│ 2 │  R   │ GEO-002  │ María   │ Av. 456   │ ... │     │ □ │
└───┴──────┴──────────┴─────────┴───────────┴─────┴─────┴───┘
```

---

## Problema 2: Nombre Incorrecto en Mapa del Planificador

### Situación Actual

El componente `ShipmentMapPopup.tsx` construye el nombre del cliente así:

```typescript
const clienteNombre = envio.tipo === "retiro"
  ? `${envio.remitente?.nombre || ''} ${envio.remitente?.apellido || ''}`.trim()
  : `${envio.destinatario?.nombre || ''} ${envio.destinatario?.apellido || ''}`.trim();
```

Este código usa los datos de la relación FK con `clientes`, que puede tener datos diferentes a los del envío mismo.

### Causa del Bug

Cuando un envío se importa masivamente o viene del e-commerce:
- Los campos `nombre_remitente` y `nombre_destinatario` del envío tienen el nombre correcto
- Pero el FK apunta a un cliente diferente (posiblemente un registro antiguo como "Echevarria")

### Solución

Modificar la lógica para usar primero los campos directos del envío:

```typescript
const clienteNombre = envio.tipo === "retiro"
  ? (envio.nombre_remitente || 
     `${envio.remitente?.nombre || ''} ${envio.remitente?.apellido || ''}`.trim() || 
     "Sin nombre")
  : (envio.nombre_destinatario || 
     `${envio.destinatario?.nombre || ''} ${envio.destinatario?.apellido || ''}`.trim() || 
     "Sin nombre");
```

### Actualizar Interface

También se debe actualizar la interfaz `EnvioData` para incluir:

```typescript
interface EnvioData {
  // ... campos existentes
  nombre_remitente?: string;
  nombre_destinatario?: string;
}
```

---

## Problema 3: Destinatario Desaparece con Cuenta Corriente

### Situación Actual

La condición en línea 1488 de `NewShipment.tsx`:

```typescript
{!esRetiroAlmacenaje && (formData.tipo_pago !== 'cuenta_corriente' || !formData.cliente_cta_cte_id) && (
  <Card> {/* Datos del Destinatario */} </Card>
)}
```

Esta lógica significa:
- Si es retiro almacenaje → NO mostrar destinatario (correcto)
- Si tipo_pago es cuenta_corriente Y cliente_cta_cte_id está seleccionado → NO mostrar destinatario (INCORRECTO)

### Por qué está mal

Al seleccionar cuenta corriente:
1. Usuario elige "Cuenta Corriente" como método de pago
2. Usuario selecciona el cliente con cta cte
3. Los campos del destinatario desaparecen
4. El usuario no puede ingresar datos del destinatario (que puede ser diferente al cliente con cta cte)

### Solución

Cambiar la condición para SOLO ocultar el destinatario en caso de retiro almacenaje:

```typescript
{!esRetiroAlmacenaje && (
  <Card> {/* Datos del Destinatario */} </Card>
)}
```

La cuenta corriente es solo un método de pago y no debe afectar si se muestra o no el destinatario.

---

## Resumen de Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/pages/PrintPlannedRoute.tsx` | Agregar `notas` al query + mostrar observaciones en tabla |
| `src/components/maps/ShipmentMapPopup.tsx` | Usar `nombre_remitente`/`nombre_destinatario` como prioridad |
| `src/pages/NewShipment.tsx` | Corregir condición para mostrar destinatario |

---

## Sección Técnica

### Cambio 1: PrintPlannedRoute.tsx

**Query modificado (líneas 47-64):**

```typescript
envio:envios(
  tracking_number,
  direccion_entrega,
  direccion_retiro,
  ciudad_entrega,
  ciudad_retiro,
  precio_total,
  tipo_pago,
  pago_contra_entrega,
  descripcion,
  notas,              // ← AGREGAR
  cantidad_bultos,
  nombre_destinatario,
  nombre_remitente,
  destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, telefono, direccion),
  remitente:clientes!envios_remitente_id_fkey(nombre, apellido, telefono, direccion)
)
```

**Renderizado de observaciones (después de cada fila de parada):**

```typescript
{envio?.notas && (
  <tr className="bg-amber-50">
    <td></td>
    <td colSpan={7} className="px-2 py-1 text-xs italic text-amber-800">
      📝 {envio.notas}
    </td>
  </tr>
)}
```

### Cambio 2: ShipmentMapPopup.tsx

**Actualizar interfaz (líneas 6-30):**

```typescript
interface EnvioData {
  id: string;
  tracking_number: string;
  tipo: "retiro" | "entrega";
  estado: string;
  coords?: { lat: number | null; lng: number | null };
  nombre_remitente?: string;    // ← AGREGAR
  nombre_destinatario?: string; // ← AGREGAR
  remitente?: { ... };
  destinatario?: { ... };
  // ... resto igual
}
```

**Actualizar lógica de nombre (líneas 52-54):**

```typescript
const clienteNombre = envio.tipo === "retiro"
  ? (envio.nombre_remitente || 
     `${envio.remitente?.nombre || ''} ${envio.remitente?.apellido || ''}`.trim() || 
     "Sin nombre")
  : (envio.nombre_destinatario || 
     `${envio.destinatario?.nombre || ''} ${envio.destinatario?.apellido || ''}`.trim() || 
     "Sin nombre");
```

### Cambio 3: NewShipment.tsx

**Simplificar condición (línea 1488):**

```typescript
// ANTES:
{!esRetiroAlmacenaje && (formData.tipo_pago !== 'cuenta_corriente' || !formData.cliente_cta_cte_id) && (

// DESPUÉS:
{!esRetiroAlmacenaje && (
```

---

## Resultado Esperado

1. **Hoja de reparto**: Mostrará las observaciones/notas de cada envío debajo de su fila correspondiente
2. **Planificador**: Mostrará el nombre correcto del cliente usando los campos directos del envío
3. **Nuevo envío**: Los campos del destinatario permanecerán visibles al seleccionar cuenta corriente como método de pago
