

## Plan: Permitir excluir envíos individuales de la liquidación de seller

### Problema
Al calcular una liquidación, aparecen envíos con fecha de hoy que el usuario no quiere liquidar aún. No hay forma de quitarlos de la pre-visualización.

### Solución
Agregar checkboxes en cada fila de la tabla de envíos para que el usuario pueda desmarcar los que no quiere incluir. Los envíos desmarcados se excluyen de los totales y de la generación.

### Cambios en `src/pages/ecommerce/Settlements.tsx`

1. **Nuevo estado `excludedEnvioIds`** (`Set<string>`) para rastrear los envíos desmarcados por el usuario. Se resetea al recalcular.

2. **Checkbox en cada fila** (solo para envíos con `estado_liquidacion === 'a_liquidar'`):
   - Checked por defecto
   - Al desmarcar, se agrega al set de excluidos
   - Checkbox "select all" en el header

3. **Recalcular totales** al cambiar la selección: los stats (Total Envíos, Saldo Período) solo suman envíos marcados y no excluidos.

4. **Proteger generación**: `generateMutation` filtra los `excludedEnvioIds` además de los `liquidado`.

5. **Visual**: filas excluidas se muestran con `opacity-40` y texto tachado para indicar que no se liquidarán.

### Archivo a modificar
- `src/pages/ecommerce/Settlements.tsx`

