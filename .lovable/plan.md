## Objetivo

Marcar el envío `MAN-1777930500711-626` como entregado con:
- Coordenadas de entrega en Falucho 2811, Florencio Varela (lat: `-34.8055332`, lng: `-58.2853618`)
- Nota indicando que el chofer cobró $71.629 al cliente para descontar en su liquidación
- Foto de evidencia adjunta (la imagen de la etiqueta de Grupo Utopía con "COBRAR $71.629")

## Pasos

### 1. Subir la foto de evidencia a Storage
- Subir `WhatsApp_Image_2026-05-04_at_17.18.56.jpeg` al bucket de evidencias de entrega (`shipment-photos` o equivalente que ya use el sistema para `foto_entrega`).
- Path sugerido: `{tenant_id}/MAN-1777930500711-626/evidencia-entrega.jpeg`.
- Obtener la URL pública para guardar en `foto_entrega`.

### 2. Migración SQL para actualizar el envío
Sobre la fila `envios` con `tracking_number = 'MAN-1777930500711-626'`:

```sql
UPDATE public.envios
SET
  estado = 'entregado',
  fecha_entrega = COALESCE(fecha_entrega, now()),
  entrega_lat = -34.8055332,
  entrega_lng = -58.2853618,
  destinatario_lat = -34.8055332,   -- mantener sync (regla de proyecto)
  destinatario_lng = -58.2853618,
  foto_entrega = '<URL pública subida>',
  notas = COALESCE(notas || E'\n\n', '') ||
    '[ENTREGA] Se cobró al cliente $71.629 en efectivo. ' ||
    'Monto cobrado por el chofer — descontar en su próxima liquidación.'
WHERE tracking_number = 'MAN-1777930500711-626';
```

Notas:
- Se respeta la regla de sincronización de coordenadas (`entrega_*` y `destinatario_*` quedan iguales).
- No se toca `chofer_id` ni `tenant_id`.
- Se preserva cualquier nota previa.

### 3. Registrar el cobro para descuento en liquidación del chofer
Para que el monto se refleje al liquidar al chofer, agregar un movimiento en la cuenta corriente del chofer (tabla equivalente a `seller_cuenta_corriente` para choferes; verificar nombre exacto antes de ejecutar — probablemente `chofer_cuenta_corriente` o registrar como gasto/cobranza asociada al envío).

Si existe la tabla de cobros por envío (cash collection), insertar un registro de `cobro_efectivo = 71629` vinculado a este envío para que aparezca como descuento en la liquidación.

### 4. Verificación
- Abrir `/shipments` y confirmar estado "Entregado" con la foto y la nota visibles.
- Confirmar en el tracking público (`/tracking/MAN-1777930500711-626`) que el mapa muestra Falucho 2811.
- Confirmar que en la liquidación del chofer aparece el descuento de $71.629.

## Detalles técnicos

- Coordenadas extraídas del link de Google Maps proporcionado: `-34.8055332, -58.2853618`.
- Bucket y nombre exacto de la columna se verifican antes de la migración leyendo el flujo de `DeliveryConfirmationDialog` para usar la misma convención (`foto_entrega` + bucket usado por choferes).
- La inserción en cuenta corriente del chofer se hace solo si existe esa estructura; si no, se deja registrado solo en `notas` y se avisa al usuario para descuento manual en próxima liquidación.