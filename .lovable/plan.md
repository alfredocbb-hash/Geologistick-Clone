

# Diagnóstico: Foto de entrega no guardada en ADMIN-ENV-20260302-FD4AD8

## Hallazgo

Consulté la base de datos y confirmé:
- **`foto_entrega`**: `NULL` — la foto no se guardó
- **`firma_destinatario`**: Sí existe (URL firmada válida)
- **Incidentes**: No hay incidentes registrados para este envío
- **GPS**: Sí tiene coordenadas de entrega

## Causa raíz

En `DeliveryConfirmation.tsx`, cuando la subida de la foto al storage falla, el error se loguea en consola pero **no se lanza una excepción**. La entrega se confirma igual sin la foto:

```typescript
// línea 170-184: uploadFile retorna null si falla
if (error) {
  console.error('Upload error:', error);
  return null;  // fallo silencioso
}

// línea 228: si photoUrl es null, simplemente no se guarda
if (photoUrl) updateData.foto_entrega = photoUrl;
```

La firma sí se subió correctamente, lo que sugiere que el bucket de storage funciona. Probablemente la foto falló por tamaño, timeout en conexión móvil, o un error transitorio.

## Plan de fix

### `src/components/delivery/DeliveryConfirmation.tsx`

1. **Agregar retry automático** en `uploadFile`: si falla el primer intento, reintentar una vez más
2. **Lanzar error si la foto falla y el usuario sacó foto**: Si el chofer tomó una foto y la subida falla, **no confirmar la entrega silenciosamente**. Mostrar un error claro y permitir reintentar, igual que ya hace `ReportIncidentDialog` (que sí lanza error en línea 100)
3. **Mostrar toast de advertencia** si la foto no se pudo subir pero se decide continuar sin ella

### Cambio específico (líneas 208-218):

Después del `Promise.all`, verificar si había foto pero no se subió:

```typescript
// Si el chofer sacó foto pero falló la subida, informar
if ((photo || photoPreview) && !photoUrl) {
  throw new Error('No se pudo subir la foto de entrega. Verificá tu conexión e intentá nuevamente.');
}
```

Esto alinea el comportamiento con `ReportIncidentDialog` que ya hace esta validación.

