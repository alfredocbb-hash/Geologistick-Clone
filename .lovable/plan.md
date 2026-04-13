

## Plan: Auto-aplicar estado de ML cuando ML marca como entregado

### Problema
La sincronización de ML (`mercadolibre-sync`) actualiza solo el campo `estado_ml` pero nunca toca el `estado` interno. Esto genera discrepancias donde envíos quedan como "Recogido" internamente pero ML ya los marca como "Entregado". Actualmente hay que aplicar el estado manualmente desde el detalle del envío.

### Solución
Modificar `mercadolibre-sync` para que, cuando el `estado_ml` nuevo sea un estado "final" o "superior" al interno, también actualice el `estado` interno automáticamente. Se respeta la protección contra downgrades (no retroceder estados).

### Cambios

#### `supabase/functions/mercadolibre-sync/index.ts`

En la sección "DUAL STATUS" (~líneas 261-266), agregar lógica para auto-aplicar el estado ML al estado interno cuando corresponda:

- Definir prioridades de estado (igual que ya existen en el webhook)
- Si el `estado_ml` nuevo tiene prioridad mayor o igual al `estado` interno actual, actualizar ambos campos
- Registrar entrada en `envio_historial` cuando se aplica el cambio automático
- Mantener la protección: nunca retroceder de `entregado`/`cancelado`/`devuelto` a un estado anterior

```typescript
// Prioridades de estado (mayor = más avanzado)
const STATE_PRIORITY: Record<string, number> = {
  pendiente: 1, recogido: 2, en_sucursal: 3,
  en_transito: 4, en_reparto: 5,
  primera_visita: 6, segunda_visita: 6,
  entregado: 10, devuelto: 9, cancelado: 9,
};

const newPriority = STATE_PRIORITY[newEnvioEstado] || 0;
const currentPriority = STATE_PRIORITY[currentEstado] || 0;

// Auto-apply if ML state is more advanced
if (newPriority > currentPriority) {
  updatePayload.estado = newEnvioEstado;
  // + insert envio_historial
}
```

### Archivos a modificar
| Archivo | Cambio |
|---------|--------|
| `supabase/functions/mercadolibre-sync/index.ts` | Auto-aplicar estado interno cuando ML avanza el estado |

### Notas
- El webhook ya hace esto parcialmente; ahora la sincronización periódica también lo hará
- Solo avanza estados, nunca retrocede (protección contra downgrades)
- Se registra en el historial como "Estado actualizado automáticamente por sincronización ML"

