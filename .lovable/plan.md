

# Plan: Mejorar Tracking Publico - Mostrar Sucursal y Ocultar DNI

## Problemas Identificados

| Problema | Impacto | Ubicacion |
|----------|---------|-----------|
| DNI visible en historial | Exposicion de datos personales sensibles | `notas` en `envio_historial` se muestra en tracking publico |
| Sucursal no visible | Cliente no sabe donde retirar el paquete | `sucursal_destino` no se incluye en respuesta API |

### Ejemplo Actual (Incorrecto)

```text
Estado: "En Sucursal"
Historial: "Entregado en sucursal a Antonella rojas (DNI: 55256272727)"
```

### Objetivo

```text
Estado: "En Sucursal (Berazategui)"
Historial: "Entregado en sucursal" (sin DNI)
```

---

## Solucion Propuesta

### Parte 1: Edge Function - Sanitizar Notas

Modificar `supabase/functions/public-tracking/index.ts` para:

1. **Agregar campo `sucursal_actual`** en la respuesta con el nombre de la sucursal destino
2. **Sanitizar las notas** del historial para remover datos sensibles como DNI antes de enviarlas

**Logica de sanitizacion:**
```text
Original: "Entregado en sucursal a Antonella rojas (DNI: 55256272727)"
Sanitizado: "Entregado en sucursal"
```

El patron a detectar y remover: `(DNI: XXXXXXXX)`

### Parte 2: Frontend - Mostrar Sucursal

Modificar `src/pages/Tracking.tsx` y `src/pages/TrackingEmbed.tsx` para:

1. **Mostrar sucursal en estado "en_sucursal"**: Agregar el nombre de la sucursal junto al estado
2. **Mostrar sucursal en "entregado"** cuando fue entregado en sucursal

---

## Detalles Tecnicos

### Archivo 1: `supabase/functions/public-tracking/index.ts`

**Cambios:**

1. Agregar campo `sucursal_actual` en la respuesta (nombre de sucursal_destino)

2. Funcion para sanitizar notas:
```typescript
// Remover datos sensibles de las notas para tracking publico
const sanitizeNotasForPublic = (notas: string | null): string | null => {
  if (!notas) return null;
  
  // Remover patrones de DNI: "(DNI: XXXXX)" 
  let sanitized = notas.replace(/\s*\(DNI:\s*\d+\)/gi, '');
  
  // Remover patrones de CUIT tambien
  sanitized = sanitized.replace(/\s*\(CUIT:\s*[\d-]+\)/gi, '');
  
  return sanitized.trim();
};
```

3. Aplicar sanitizacion al mapear historial:
```typescript
historial: (historial || []).map((h) => ({
  ...
  notas: sanitizeNotasForPublic(h.notas),
  ...
})),
```

4. Agregar `sucursal_actual` a la respuesta:
```typescript
sucursal_actual: sucursalDestino?.nombre || null,
```

### Archivo 2: `src/pages/Tracking.tsx`

**Cambios:**

1. Actualizar interfaz `TrackingResponse` para incluir `sucursal_actual`

2. Modificar badge de estado para incluir sucursal:
```tsx
// Si esta en_sucursal y hay sucursal_actual
{envio.estado === 'en_sucursal' && envio.sucursal_actual && (
  <Badge>En Sucursal ({envio.sucursal_actual})</Badge>
)}
```

3. En el estado "entregado", si fue en sucursal mostrar tambien

### Archivo 3: `src/pages/TrackingEmbed.tsx`

**Cambios similares:**

1. Actualizar interfaz para incluir `sucursal_actual`
2. Mostrar sucursal en estado cuando corresponda

---

## Resultado Esperado

### Vista Tracking Publica

**Antes:**
```text
Estado: En Sucursal
Historial:
  - Entregado | "Entregado en sucursal a Antonella rojas (DNI: 55256272727)"
```

**Despues:**
```text
Estado: En Sucursal (Berazategui)
Historial:
  - Entregado | "Entregado en sucursal"
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `supabase/functions/public-tracking/index.ts` | Agregar sanitizacion de notas + campo sucursal_actual |
| `src/pages/Tracking.tsx` | Mostrar sucursal en estado + actualizar interfaz |
| `src/pages/TrackingEmbed.tsx` | Mostrar sucursal en estado + actualizar interfaz |

---

## Seguridad

Esta solucion protege la privacidad al:

1. **Nunca exponer DNI/CUIT** en el tracking publico
2. **Mantener los datos internos intactos** - el historial original con DNI sigue guardado para uso interno
3. **Sanitizar en el punto de salida** - la Edge Function filtra datos sensibles antes de enviar al cliente

