
# Plan: Habilitar "Usar Ruta" en Rutas Frecuentes

## Diagnóstico del problema

El botón "Usar Ruta" está deshabilitado porque:

1. El sistema busca **envíos pendientes sin chofer asignado** (condición: `chofer_id IS NULL`)
2. Luego filtra esos envíos que coincidan con los **clientes guardados** en la ruta frecuente
3. Si no hay coincidencias (`matchingCount === 0`), el botón se deshabilita

Actualmente **todos los envíos en el sistema ya tienen un chofer asignado**, por lo que la lista de `enviosPendientes` está vacía y nunca hay coincidencias.

---

## Solución propuesta

Cambiar la lógica para que el botón "Usar Ruta" **siempre esté habilitado**, pero con comportamiento diferenciado:

| Escenario | Comportamiento |
|-----------|----------------|
| Hay envíos coincidentes | Pre-selecciona automáticamente los envíos que coinciden con los clientes de la ruta frecuente |
| No hay envíos coincidentes | Muestra un mensaje informativo pero permite continuar a la pestaña "Crear Ruta" con la información de la ruta (para referencia) |

---

## Cambios técnicos

### Archivo: `src/components/routes/FrequentRoutesTab.tsx`

1. **Eliminar la condición `disabled` del botón** (línea 233)
   - Cambiar de `disabled={matchingCount === 0}` a `disabled={false}` o remover completamente

2. **Modificar la función `handleUseRoute`** para manejar ambos casos:
   - Si hay envíos coincidentes: mantener comportamiento actual (llamar `onUseRoute`)
   - Si no hay envíos: mostrar un toast informativo diferente y aún cambiar a la pestaña "Crear Ruta"

3. **Mejorar el feedback visual**:
   - Cambiar el color del botón cuando no hay envíos disponibles (variante `outline` en vez de `default`)
   - Agregar tooltip explicativo

---

## Código a modificar

```text
Archivo: src/components/routes/FrequentRoutesTab.tsx

Líneas 228-237: Modificar el botón para siempre estar habilitado
  - Cambiar variant dinámicamente según matchingCount
  - Remover disabled={matchingCount === 0}

Líneas 88-116: Modificar handleUseRoute
  - Si no hay envíos coincidentes: mostrar toast info y llamar callback sin IDs
  - Permitir al usuario navegar a "Crear Ruta" igualmente
```

---

## Resultado esperado

El usuario podrá:
1. Ver claramente cuántos envíos hay disponibles para cada ruta frecuente
2. Hacer clic en "Usar Ruta" aunque no haya envíos pendientes
3. Recibir feedback claro sobre la situación actual de envíos
