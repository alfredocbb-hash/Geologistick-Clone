
# Plan: Corrección de Bugs en EditSellerDialog

## Problema 1: Pantalla en Blanco al Configurar

### Diagnóstico
El error proviene de la línea 586 en `EditSellerDialog.tsx`:
```tsx
<SelectItem value="">Sin express</SelectItem>
```

Radix UI Select no permite strings vacíos como valor porque el string vacío se usa internamente para limpiar la selección.

### Solución
Cambiar el valor vacío por un placeholder especial como `"none"` o `"__none__"` y ajustar la lógica del formulario:

```tsx
// Línea 586 - Cambiar de:
<SelectItem value="">Sin express</SelectItem>

// A:
<SelectItem value="__none__">Sin express</SelectItem>
```

Y actualizar la lógica de guardado para convertir `"__none__"` a `null`:
```tsx
// En el mutationFn, línea 319:
tarifa_express_id: values.tarifa_express_id === '__none__' 
  ? null 
  : (values.tarifa_express_id || null),
```

También actualizar los valores por defecto del formulario:
```tsx
// Línea 141 y 178:
tarifa_express_id: seller.tarifa_express_id || '__none__',
```

---

## Problema 2: Datos se Pierden al Navegar

### Diagnóstico
Este comportamiento es esperado en formularios que no guardan automáticamente. Cuando navegas fuera de la página:
1. El componente `EditSellerDialog` se desmonta
2. El estado local del formulario se pierde
3. Al volver, el `useQuery` refetch los datos originales del servidor

### Opciones de Solución

**Opción A: Auto-guardado (Recomendado)**
Implementar guardado automático con debounce cuando el usuario modifica campos. Esto previene pérdida de datos.

**Opción B: Confirmación al salir**
Mostrar un diálogo de confirmación si hay cambios sin guardar al intentar cerrar.

**Opción C: Estado explicativo**
Agregar un mensaje visual indicando que los cambios no guardados se perderán.

Para esta corrección, implementaremos la **Opción C** (menor impacto) junto con la corrección del bug principal.

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/ecommerce/EditSellerDialog.tsx` | Corregir SelectItem value vacío, agregar warning de cambios sin guardar |

## Cambios Técnicos Detallados

### 1. Corregir el SelectItem vacío

```tsx
// En el Select de tarifa_express_id (línea ~579-594):
<Select 
  onValueChange={field.onChange} 
  value={field.value || '__none__'}
>
  <FormControl>
    <SelectTrigger>
      <SelectValue placeholder="Sin express" />
    </SelectTrigger>
  </FormControl>
  <SelectContent>
    <SelectItem value="__none__">Sin express</SelectItem>
    {tarifas?.map((t) => (
      <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 2. Actualizar valores por defecto

```tsx
// Línea 141 (defaultValues) y 178 (reset):
tarifa_express_id: seller.tarifa_express_id || '__none__',
```

### 3. Lógica de guardado

```tsx
// En updateMutation.mutationFn (línea ~319):
tarifa_express_id: values.tarifa_express_id === '__none__' 
  ? null 
  : (values.tarifa_express_id || null),
```

### 4. Agregar indicador de cambios sin guardar (opcional)

```tsx
// Agregar hook para detectar cambios:
const isDirty = form.formState.isDirty;

// En el header del dialog:
{isDirty && (
  <Alert variant="warning" className="mb-4">
    <AlertDescription>
      Tienes cambios sin guardar. Se perderán si cierras sin guardar.
    </AlertDescription>
  </Alert>
)}
```

---

## Verificación

Después de implementar:
1. Abrir el diálogo "Configurar" de cualquier seller
2. Verificar que no hay pantalla blanca
3. Modificar campos y cerrar sin guardar
4. Verificar el mensaje de advertencia
5. Guardar cambios y confirmar que se persisten

## Complejidad

- **Impacto:** Bajo (solo un archivo)
- **Riesgo:** Bajo (cambio localizado)
- **Tiempo estimado:** 15 minutos
