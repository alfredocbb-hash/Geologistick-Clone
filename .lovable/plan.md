

# Plan: Corregir la perdida del dialogo de entrega al sacar foto en Android

## Problema

Cuando el chofer toca "Tomar Foto" en el dialogo de Confirmacion de Entrega, Android abre la camara nativa y puede recargar la WebView al volver. Esto causa que:

1. `ActiveRouteNavigation` se vuelve a montar desde cero
2. Los estados `selectedShipment` y `dialogType` se pierden (son `useState` normales)
3. El usuario ve el listado de paradas en vez de volver al dialogo con su foto

El componente `DeliveryConfirmation` YA guarda su estado interno (foto, firma, notas) en `sessionStorage`, pero nunca llega a montarse porque el padre no sabe que dialogo tenia abierto.

## Solucion

Persistir `selectedShipment` y `dialogType` en `sessionStorage` dentro de `ActiveRouteNavigation`, de manera que al recargar la WebView, el dialogo se reabra automaticamente con el envio correcto, y luego `DeliveryConfirmation` restaure la foto desde su propia clave de sessionStorage.

## Cambios

### Archivo: `src/pages/ActiveRouteNavigation.tsx`

1. **Agregar persistencia del dialogo activo**: Crear una clave de sessionStorage (`active-route-dialog-state`) que guarde `selectedShipment` y `dialogType` cada vez que se abran.

2. **Restaurar al montar**: En un `useEffect` inicial, verificar si existe estado guardado en sessionStorage. Si existe, restaurar `selectedShipment` y `dialogType` para que el dialogo se reabra automaticamente.

3. **Limpiar al cerrar**: Cuando el dialogo se cierra (en los callbacks `onClose`), remover la clave de sessionStorage.

### Flujo corregido

```text
[Chofer toca "Tomar Foto"]
       |
       v
[DeliveryConfirmation guarda foto/firma/notas en sessionStorage]
[handleOpenCamera -> sessionStorage.setItem('delivery-state-{id}')]
       |
       v
[Android abre camara nativa, recarga WebView]
       |
       v
[ActiveRouteNavigation se monta de nuevo]
[useEffect detecta 'active-route-dialog-state' en sessionStorage]
[Restaura selectedShipment + dialogType = 'delivery']
       |
       v
[DeliveryConfirmation se monta]
[useEffect detecta 'delivery-state-{id}' en sessionStorage]
[Restaura la foto tomada + firma + notas]
       |
       v
[El chofer ve su foto y puede confirmar la entrega]
```

### Detalle tecnico

En `ActiveRouteNavigation.tsx`:

- Cada vez que se ejecuta `setSelectedShipment(envio)` + `setDialogType(tipo)`, tambien se guarda en sessionStorage:
```typescript
const DIALOG_STATE_KEY = 'active-route-dialog-state';

// Al abrir un dialogo:
sessionStorage.setItem(DIALOG_STATE_KEY, JSON.stringify({
  shipment: envio,
  dialogType: tipo
}));
```

- Al montar el componente, se busca si hay estado guardado:
```typescript
useEffect(() => {
  const saved = sessionStorage.getItem(DIALOG_STATE_KEY);
  if (saved) {
    const { shipment, dialogType } = JSON.parse(saved);
    setSelectedShipment(shipment);
    setDialogType(dialogType);
  }
}, []);
```

- Al cerrar cualquier dialogo, se limpia:
```typescript
const closeDialog = () => {
  setSelectedShipment(null);
  setDialogType(null);
  sessionStorage.removeItem(DIALOG_STATE_KEY);
};
```

### Puntos a considerar

- Solo se necesita modificar `ActiveRouteNavigation.tsx` - el `DeliveryConfirmation` ya tiene toda la logica de restauracion de foto/firma/notas
- Se crea una funcion helper `openDialog(envio, tipo)` que centraliza el setState + sessionStorage para evitar repetir codigo en los ~8 lugares donde se abren dialogos
- Se crea una funcion helper `closeDialog()` que centraliza la limpieza
- La clave de sessionStorage se limpia automaticamente en `onSuccess` y `onClose` de todos los dialogos
