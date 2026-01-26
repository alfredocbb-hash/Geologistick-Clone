
# Plan: Corregir Actualización Automática de Estados después de Crear Envío

## Problema Identificado

Cuando se crea un envío desde un pedido e-commerce:
1. El `fulfillment_status` SÍ se actualiza correctamente en la base de datos a `'processing'`
2. **PERO la tabla NO se refresca** para mostrar el cambio

### Causa del Bug

En `CreateShipmentFromOrderDialog.tsx`, el método `handleClose()` tiene un error de lógica:

```typescript
const handleClose = () => {
  setCreatedEnvio(null);    // ← Limpia el estado PRIMERO
  onOpenChange(false);       
  if (createdEnvio) {        // ← SIEMPRE es false (ya lo limpiamos arriba)
    onSuccess();             // ← NUNCA se ejecuta
  }
};
```

Resultado: `onSuccess()` nunca se llama, y `queryClient.invalidateQueries()` nunca se ejecuta.

---

## Solución

### Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/ecommerce/CreateShipmentFromOrderDialog.tsx` | Corregir orden de operaciones en handleClose |

---

## Cambio Técnico

### Corregir `handleClose()` (líneas 242-248)

**Antes (bug):**
```typescript
const handleClose = () => {
  setCreatedEnvio(null);
  onOpenChange(false);
  if (createdEnvio) {
    onSuccess();
  }
};
```

**Después (correcto):**
```typescript
const handleClose = () => {
  const wasCreated = !!createdEnvio;  // Guardar referencia ANTES de limpiar
  setCreatedEnvio(null);
  onOpenChange(false);
  if (wasCreated) {
    onSuccess();  // Ahora SÍ se ejecuta
  }
};
```

---

## Flujo Corregido

```text
Usuario crea envío → Click "Cerrar" o "Imprimir"
                           ↓
                   handleClose()
                           ↓
        wasCreated = true (guardamos antes de limpiar)
                           ↓
                   setCreatedEnvio(null)
                           ↓
                   onOpenChange(false)
                           ↓
        if (wasCreated) → onSuccess()
                           ↓
          queryClient.invalidateQueries(['ecommerce-orders'])
                           ↓
        Tabla se refresca automáticamente
                           ↓
        fulfillment_status muestra "En Preparación"
        Columna Envío muestra "Creado" + 🖨
```

---

## Resultado Esperado

Después de crear un envío:

| Columna | Antes | Después |
|---------|-------|---------|
| Fulfillment | Sin Preparar | **En Preparación** |
| Envío | [Crear] | **[Creado] 🖨** |

La tabla se actualizará automáticamente mostrando los nuevos estados sin necesidad de recargar la página.
