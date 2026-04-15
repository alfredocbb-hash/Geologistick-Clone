

## Plan: Corregir asignación de dirección en envíos terciarizados tipo "Retiro"

### Problema

Cuando se crea un envío terciarizado con tipo de operación **"Retiro"**, la dirección cargada en el formulario se guarda siempre como `direccion_entrega`, y la dirección de la empresa terciarizada se guarda como `direccion_retiro`. Esto es incorrecto para retiros: la dirección del formulario es donde se retira el paquete, y la empresa/sucursal es el destino.

### Solución

Modificar `src/components/routes/ThirdPartyShipmentsTab.tsx` para que, cuando `tipo_operacion === "retiro"`:

- `direccion_retiro` / `ciudad_retiro` / coordenadas de retiro = dirección del formulario (la que carga el usuario)
- `direccion_entrega` / `ciudad_entrega` / coordenadas de entrega = dirección de la empresa terciarizada (o sucursal)

Y cuando es "Entrega" (el caso actual), mantener el comportamiento existente.

### Cambio técnico

En el insert de `envios` (~línea 483-504), condicionar los campos según `tipo_operacion`:

```typescript
// Retiro: la dirección del form es donde se retira
direccion_retiro: shipment.tipo_operacion === "retiro" ? shipment.direccion_entrega : (selectedEmpresa?.direccion || null),
ciudad_retiro: shipment.tipo_operacion === "retiro" ? shipment.ciudad_entrega : (selectedEmpresa?.ciudad || null),
remitente_lat: shipment.tipo_operacion === "retiro" ? shipment.entrega_lat : null,
remitente_lng: shipment.tipo_operacion === "retiro" ? shipment.entrega_lng : null,

// Entrega: si es retiro, el destino es la empresa; si es entrega, el destino es el form
direccion_entrega: shipment.tipo_operacion === "retiro" ? (selectedEmpresa?.direccion || '') : shipment.direccion_entrega,
ciudad_entrega: shipment.tipo_operacion === "retiro" ? (selectedEmpresa?.ciudad || '') : shipment.ciudad_entrega,
entrega_lat: shipment.tipo_operacion === "retiro" ? null : shipment.entrega_lat,
entrega_lng: shipment.tipo_operacion === "retiro" ? null : shipment.entrega_lng,
```

Solo se modifica un archivo: `src/components/routes/ThirdPartyShipmentsTab.tsx`.

