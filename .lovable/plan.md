

# Plan: Corregir Nombres de Remitente/Destinatario en EPOD

## Problema Identificado

En el PDF EPOD, tanto el remitente como el destinatario muestran el mismo nombre "Alejandro Maximiliano Echavarria" porque el sistema usa únicamente los datos del cliente vinculado (tabla `clientes`) y NO los campos directos `nombre_remitente` y `nombre_destinatario` de la tabla `envios`.

Este problema ya fue corregido en otros componentes como:
- `Shipments.tsx` (lista de envíos)
- `RoutePlanner.tsx` (planificador de rutas)
- `ActiveRouteNavigation.tsx` (navegación del chofer)
- `PrintRouteSheet.tsx` / `PrintPlannedRoute.tsx` (impresión)

Pero **faltó aplicarlo en el EPOD**.

---

## Patrón Correcto (ya usado en otros lugares)

```typescript
// Prioridad: campo directo primero, fallback al cliente vinculado
envio.nombre_remitente || `${envio.remitente?.nombre || ''} ${envio.remitente?.apellido || ''}`.trim()
envio.nombre_destinatario || `${envio.destinatario?.nombre || ''} ${envio.destinatario?.apellido || ''}`.trim()
```

---

## Cambios Requeridos

### Archivo: `src/lib/generateEPODPDF.ts`

#### 1. Actualizar interface `Envio` (agregar campos faltantes)

Agregar los campos directos a la interfaz:

```typescript
interface Envio {
  // ... campos existentes ...
  nombre_remitente?: string | null;      // NUEVO
  nombre_destinatario?: string | null;   // NUEVO
  // ... resto de campos ...
}
```

#### 2. Actualizar lógica de nombre del remitente (línea 259-261)

**Antes:**
```typescript
const senderName = envio.remitente 
  ? sanitizeText(`${envio.remitente.nombre} ${envio.remitente.apellido || ''}`.trim())
  : 'No especificado';
```

**Después:**
```typescript
const senderName = sanitizeText(
  envio.nombre_remitente || 
  (envio.remitente ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}`.trim() : '') || 
  'No especificado'
);
```

#### 3. Actualizar lógica de nombre del destinatario (línea 279-281)

**Antes:**
```typescript
const recipientName = envio.destinatario
  ? sanitizeText(`${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`.trim())
  : 'No especificado';
```

**Después:**
```typescript
const recipientName = sanitizeText(
  envio.nombre_destinatario || 
  (envio.destinatario ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`.trim() : '') || 
  'No especificado'
);
```

---

## Resumen de Cambios

| Archivo | Cambio |
|---------|--------|
| `src/lib/generateEPODPDF.ts` | Agregar `nombre_remitente` y `nombre_destinatario` a interface |
| `src/lib/generateEPODPDF.ts` | Actualizar lógica de `senderName` con prioridad al campo directo |
| `src/lib/generateEPODPDF.ts` | Actualizar lógica de `recipientName` con prioridad al campo directo |

---

## Resultado Esperado

| Campo | Antes | Después |
|-------|-------|---------|
| Remitente | Alejandro Maximiliano Echavarria (del cliente genérico) | Nombre específico del envío |
| Destinatario | Alejandro Maximiliano Echavarria (del cliente genérico) | Nombre específico del envío |

---

## Notas Técnicas

El campo `*` en la query de Supabase ya trae `nombre_remitente` y `nombre_destinatario` de la tabla `envios`, por lo que no es necesario modificar `ShipmentDetailsDialog.tsx`. Solo falta usar estos campos en el generador del PDF.

