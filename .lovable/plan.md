

## Plan: Corrección de Incidencias del Chofer

Se identificaron 3 problemas relacionados con el flujo de incidencias desde la aplicación móvil del chofer:

---

## Problema 1: Incidencias se Registran Varias Veces

### Causa
El botón "Reportar Incidente" puede ser clickeado múltiples veces antes de que `isPending` se actualice. Esto ocurre porque:
1. El usuario hace clic rápidamente varias veces
2. La mutación tarda en iniciar y el estado `isPending` no se activa instantáneamente

**Evidencia en BD:** El envío `3da241a8-3525...` tiene 2 incidentes duplicados creados con solo 14 segundos de diferencia (17:24:42 y 17:24:56).

### Solución
Agregar un estado local `isSubmitting` que se active inmediatamente al hacer clic, y deshabilitar el botón al instante:

**Archivo:** `src/components/incidents/ReportIncidentDialog.tsx`

```typescript
// Agregar estado local
const [isSubmitting, setIsSubmitting] = useState(false);

// En el onClick del botón
onClick={() => {
  if (isSubmitting || reportMutation.isPending) return;
  setIsSubmitting(true);
  reportMutation.mutate();
}}

// Combinar ambos estados para disabled
disabled={isSubmitting || reportMutation.isPending || !incidentType}
```

Adicionalmente, agregar validación en la base de datos para verificar si ya existe un incidente pendiente para ese envío antes de insertar.

---

## Problema 2: Las Fotos de Evidencia No Cargan

### Causa
La función `uploadFile` retorna `null` si hay un error de upload, pero la mutación **no falla** cuando esto ocurre. El código continúa creando el incidente sin la foto y luego llama `onSuccess()`, cerrando el diálogo sin avisar al usuario que la foto no se subió.

```typescript
// Código actual - la foto falla silenciosamente
if (photo) {
  const photoPath = `incidents/${shipment.id}/evidence_${Date.now()}.jpg`;
  photoUrl = await uploadFile(photo, photoPath);
  // Si photoUrl es null, no hace nada y continúa
}
```

**Evidencia:** No hay archivos en el bucket `delivery-photos` con path `incidents/*`.

### Solución
Lanzar un error explícito cuando falla la subida de la foto para que el usuario pueda reintentar:

```typescript
if (photo) {
  const photoPath = `incidents/${shipment.id}/evidence_${Date.now()}.jpg`;
  photoUrl = await uploadFile(photo, photoPath);
  
  if (!photoUrl) {
    throw new Error('Error al subir la foto de evidencia. Por favor intenta nuevamente.');
  }
}
```

También agregar un timeout y mejor manejo de errores en el upload.

---

## Problema 3: Cerrar Hoja de Ruta Automáticamente Cuando No Quedan Pendientes

### Causa
El cálculo de `stats.pending` no considera los envíos en estado `incidencia` como "finalizados" desde el punto de vista del chofer. La lógica actual es:

```typescript
const completed = envios.filter(e => 
  e.envio?.estado === 'entregado' || 
  e.envio?.estado === 'devuelto' ||
  e.envio?.estado_retiro === 'retirado'
).length;
const pending = total - completed; // incidencia NO cuenta como completed
```

Por lo tanto, si todos los envíos terminan en `incidencia`, `pending` nunca llega a 0 y el modal "Ruta Completada" nunca aparece.

### Solución
Incluir `incidencia` en la lista de estados "finalizados" para el chofer (ya no hay acción que el chofer pueda tomar sobre ese envío):

**Archivo:** `src/pages/ActiveRouteNavigation.tsx`

```typescript
const stats = useMemo(() => {
  const total = envios.length;
  const completed = envios.filter(e => 
    e.envio?.estado === 'entregado' || 
    e.envio?.estado === 'devuelto' ||
    e.envio?.estado === 'incidencia' ||    // NUEVO: incidencia cuenta como "terminado" para el chofer
    e.envio?.estado_retiro === 'retirado'
  ).length;
  const failed = envios.filter(e => 
    e.envio?.estado === 'devuelto' ||
    e.envio?.estado === 'incidencia' ||    // NUEVO: incidencia es un "fallo"
    e.envio?.estado_retiro === 'fallido'
  ).length;
  const pending = total - completed;
  const progress = total > 0 ? (completed / total) * 100 : 0;
  
  return { total, completed, failed, pending, progress };
}, [envios]);
```

También actualizar la lógica de `nextStop` para ignorar envíos en estado `incidencia`:

```typescript
const nextStop = useMemo(() => {
  return envios.find(e => {
    const envio = e.envio;
    if (!envio) return false;
    
    // Envíos con incidencia ya no requieren acción del chofer
    if (envio.estado === 'incidencia') return false;
    
    // ... resto de la lógica
  });
}, [envios]);
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/incidents/ReportIncidentDialog.tsx` | Agregar protección contra doble-clic + lanzar error si foto falla |
| `src/pages/ActiveRouteNavigation.tsx` | Incluir `incidencia` en stats.completed y excluir de nextStop |

---

## Flujo Resultante

```text
Chofer reporta incidencia
        │
        ├── Botón deshabilitado inmediatamente
        │
        ├── ¿Hay foto? 
        │     ├── Sí → Subir al storage
        │     │         ├── Éxito → Continuar
        │     │         └── Error → Mostrar mensaje, permitir reintentar
        │     └── No → Continuar
        │
        ├── Insertar incidente en BD
        │
        ├── Actualizar envío a estado 'incidencia'
        │
        ├── Invalidar queries
        │
        └── Si no quedan pendientes (incluyendo incidencias como "terminados")
              └── Mostrar modal "Ruta Completada" → Cerrar automáticamente
```

---

## Resultado Esperado

1. **Sin duplicados:** El botón se deshabilita instantáneamente al hacer clic
2. **Fotos funcionando:** Si la foto falla, el usuario ve el error y puede reintentar
3. **Cierre automático:** Cuando todos los envíos están entregados, devueltos o con incidencia, el chofer puede cerrar la ruta

