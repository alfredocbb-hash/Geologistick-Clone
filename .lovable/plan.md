

## Plan: Vincular envíos terciarizados con sellers en la creación

### Problema raíz
Cuando se crea un envío terciarizado desde el planificador, el cargo se registra solo en `terciarizado_cuenta_corriente`. No hay vínculo con el seller, por lo que el envío no aparece en la liquidación del seller.

ENV-8E8YLT tiene:
- `remitente_id`: NULL
- Sin entrada en `seller_cuenta_corriente`
- Sin `ecommerce_order` vinculada
- Cargo solo en `terciarizado_cuenta_corriente` (Correo Argentino)

### Solución

#### 1. Agregar selector de Seller en ThirdPartyShipmentsTab

En `src/components/routes/ThirdPartyShipmentsTab.tsx`:
- Agregar campo opcional **"Seller / Remitente"** al formulario (select con sellers activos que tengan cuenta corriente)
- Al crear el envío, si se seleccionó un seller:
  - Setear `remitente_id` = `seller.cliente_id` en el envío
  - Crear entrada en `seller_cuenta_corriente` con tipo `cargo`, el `envio_id`, y actualizar saldo del seller
- El cargo al terciarizado se mantiene igual (ambos registros coexisten)

#### 2. Datos necesarios

- Query adicional: `ecommerce_sellers` activos con `tiene_cuenta_corriente = true` del tenant
- En la mutación de creación, después de insertar el envío:
  ```
  if (selectedSeller && selectedSeller.tiene_cuenta_corriente) {
    // Insert seller_cuenta_corriente cargo
    // Update seller saldo_cuenta_corriente
  }
  ```

#### 3. Para el envío existente (ENV-8E8YLT)

Se puede vincular retroactivamente de dos formas:
- **Opción A**: Insertar manualmente un registro en `seller_cuenta_corriente` para ese envío (migración o script)
- **Opción B**: Agregar un botón en la UI para vincular envíos terciarizados existentes a un seller

Recomiendo **Opción A** como fix inmediato + el cambio en el formulario para futuros envíos.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/routes/ThirdPartyShipmentsTab.tsx` | Agregar selector de seller, registrar cargo en seller_cuenta_corriente al crear |
| Migración SQL | Insertar `seller_cuenta_corriente` para ENV-8E8YLT vinculándolo a PABLO GAUNA |

