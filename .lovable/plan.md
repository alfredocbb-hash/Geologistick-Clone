
# Plan: Corregir Error de UUID Undefined en Entrega desde APK

## Problema Identificado

El error **"invalid input syntax for type uuid: 'undefined'"** ocurre cuando el usuario Lucas intenta confirmar una entrega desde la APK móvil. Esto sucede porque:

1. El componente intenta insertar registros con `user?.id` cuando el usuario no está completamente autenticado
2. Si la sesión expiró o hay problemas de sincronización, `user` es `null` y `user?.id` se convierte en la cadena `"undefined"` que PostgreSQL rechaza

---

## Archivos Afectados

| Archivo | Problema |
|---------|----------|
| `src/components/scan/BranchDeliveryDialog.tsx` | Usa `user?.id` sin validación previa |
| `src/components/delivery/DeliveryConfirmation.tsx` | Usa `user?.id` sin validación previa |

---

## Solución Propuesta

### 1. Agregar Validación de Autenticación Antes de Procesar

En ambos componentes, agregar verificación temprana de que el usuario está autenticado antes de proceder con la operación:

```typescript
// En handleConfirmDelivery y confirmMutation
if (!user?.id) {
  toast.error('Sesión expirada', {
    description: 'Por favor, inicia sesión nuevamente'
  });
  return;
}
```

### 2. Modificar BranchDeliveryDialog.tsx

**Línea ~138**: Agregar validación al inicio de `handleConfirmDelivery`:

```typescript
const handleConfirmDelivery = async () => {
  if (!shipment || !validateForm()) return;
  
  // NUEVA VALIDACIÓN
  if (!user?.id) {
    toast.error('Sesión expirada', {
      description: 'Por favor, inicia sesión nuevamente'
    });
    return;
  }

  setIsProcessing(true);
  // ... resto del código
```

**Líneas 155-170**: Cambiar usos de `user?.id` por `user.id` (ya validado):

```typescript
entregado_por: user.id, // Antes: user?.id
// ...
created_by: user.id, // Antes: user?.id
```

### 3. Modificar DeliveryConfirmation.tsx

**Línea ~133 en mutationFn**: Agregar validación temprana:

```typescript
mutationFn: async () => {
  // NUEVA VALIDACIÓN
  if (!user?.id) {
    throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
  }

  const timestamp = Date.now();
  // ... resto del código
```

**Líneas donde usa user?.id**: Cambiar a `user.id` después de la validación.

---

## Sección Técnica

### Cambios en BranchDeliveryDialog.tsx

```typescript
// Línea 138 - Agregar validación
const handleConfirmDelivery = async () => {
  if (!shipment || !validateForm()) return;
  
  if (!user?.id) {
    toast.error('Sesión expirada', {
      description: 'Por favor, inicia sesión nuevamente'
    });
    return;
  }

  setIsProcessing(true);
  // ...
```

```typescript
// Línea 155-156 - Cambiar user?.id por user.id
entregado_por: user.id,

// Línea 169 - Cambiar user?.id por user.id  
created_by: user.id,

// Línea 181 - Cambiar user?.id por user.id
created_by: user.id,

// Línea 195 - Cambiar user?.id por user.id
created_by: user.id,
```

### Cambios en DeliveryConfirmation.tsx

```typescript
// Línea 133 - Agregar validación en mutationFn
mutationFn: async () => {
  if (!user?.id) {
    throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
  }
  
  const timestamp = Date.now();
  // ...
```

```typescript
// Línea 173 - Cambiar user?.id por user.id
created_by: user.id,
```

### Cambios Adicionales de Seguridad

También agregar validación en el cálculo de comisiones:

```typescript
// Línea 176-177 ya tiene if (!user?.id) return; pero el tipo sigue siendo opcional
// Después de la validación, usar user.id directamente
const commissionPromise = (async () => {
  if (!user?.id) return;
  
  // user.id está garantizado aquí
  // ...
```

---

## Resultado Esperado

Después de aplicar estos cambios:

1. Si el usuario no está autenticado, verá un mensaje claro: **"Sesión expirada - Por favor, inicia sesión nuevamente"**
2. No se intentarán operaciones de base de datos con valores `undefined`
3. El usuario podrá refrescar su sesión y volver a intentar la entrega
4. Se evitarán errores de PostgreSQL relacionados con UUIDs inválidos
