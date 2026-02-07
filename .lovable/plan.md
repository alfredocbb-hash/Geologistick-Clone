

# Integrar Facturacion ARCA para Beraexpress

## Resumen

El sistema tiene los componentes de facturacion creados pero desconectados. Este plan conecta todas las piezas para que cuando un cliente solicite factura, el operador pueda completar los datos fiscales y emitir la factura electronica (sandbox por ahora).

## Paso 1: Crear registro en `arca_config` para Beraexpress

Insertar en la tabla `arca_config` los datos del contribuyente Beraexpress para que el hook `useARCAIntegration` pueda determinar automaticamente el tipo de factura segun condicion IVA.

Campos a completar:
- `tenant_id`: 94a9ea85-43c5-49ac-9bfa-86843072c2ce
- `cuit`: 30717265811
- `razon_social`: Beraexpress (o la razon social fiscal correcta)
- `condicion_iva`: (a confirmar, por defecto `responsable_inscripto`)
- `punto_venta`: 7
- `factura_a_habilitada`: true
- `factura_b_habilitada`: true
- `factura_c_habilitada`: true
- `is_active`: true
- `environment`: sandbox

## Paso 2: Integrar InvoiceDataDialog en el flujo de entrega en sucursal

**Archivo**: `src/components/scan/BranchDeliveryDialog.tsx`

Cuando el operador marca "El cliente solicita factura" y confirma la entrega, se abrira automaticamente el `InvoiceDataDialog` para completar los datos fiscales del receptor (CUIT, razon social, condicion IVA, domicilio).

Cambios:
- Importar `InvoiceDataDialog`
- Agregar estado `showInvoiceDialog` y `deliveredEnvioId`
- Despues de confirmar la entrega exitosamente, si `requiereFactura === true`, abrir el dialog de facturacion en vez de cerrar inmediatamente
- Pasar `envioId` y `precio_total` al dialog

## Paso 3: Agregar boton "Emitir Factura" en el detalle del envio

**Archivo**: `src/components/shipments/ShipmentDetailsDialog.tsx`

Agregar una seccion de facturacion visible en el detalle del envio:
- Si el envio tiene `requiere_factura === true` y no tiene `factura_cae`, mostrar un boton "Emitir Factura" que abre el `InvoiceDataDialog`
- Si el envio ya tiene `factura_cae`, mostrar los datos de la factura emitida (numero, CAE, fecha, tipo)
- Importar y renderizar `InvoiceDataDialog` condicionalmente

## Paso 4: Permitir solicitar factura desde el detalle del envio

Agregar un boton secundario "Solicitar Factura" en el detalle de cualquier envio que aun no tenga factura, permitiendo que un administrador pueda emitir factura en cualquier momento (no solo al entregar en sucursal).

## Resultado esperado

```text
Flujo 1 - Entrega en sucursal:
  Escanear paquete -> Confirmar entrega -> Marcar "solicita factura"
  -> Confirmar -> Se abre formulario de datos fiscales
  -> Completar CUIT, razon social, condicion IVA -> Emitir Factura
  -> Se genera CAE (sandbox) y se guarda en el envio

Flujo 2 - Desde detalle del envio:
  Abrir detalle de cualquier envio -> Seccion Facturacion
  -> Boton "Emitir Factura" -> Formulario de datos fiscales
  -> Completar datos -> Emitir Factura -> CAE generado

Flujo 3 - Envios pendientes de factura:
  Envios con requiere_factura=true y sin CAE
  -> Se pueden facturar desde el detalle del envio en cualquier momento
```

## Seccion tecnica

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/scan/BranchDeliveryDialog.tsx` | Importar InvoiceDataDialog, abrir despues de entrega si requiere factura |
| `src/components/shipments/ShipmentDetailsDialog.tsx` | Agregar seccion de facturacion con boton y visualizacion de datos |

### Migracion de base de datos

Insertar registro en `arca_config` para Beraexpress con los datos fiscales del contribuyente.

### Flujo de datos

1. El operador marca `requiere_factura = true` en el envio (ya existente)
2. Se abre `InvoiceDataDialog` con el `envio_id` y `importe_total`
3. El dialog llama a la edge function `arca-factura` con los datos del receptor
4. La funcion verifica la configuracion ARCA del tenant en `system_integrations`
5. Crea registro en tabla `facturas`
6. En sandbox: genera CAE simulado y actualiza el envio con `factura_cae`, `factura_numero`, etc.
7. El dialog muestra confirmacion con el CAE generado

### Consideraciones

- La integracion real con AFIP (WSAA + WSFEv1) no esta implementada aun (hay un TODO en la edge function). En modo sandbox se generan CAEs ficticios para testing
- Para pasar a produccion se necesitara implementar la autenticacion con certificados X.509 contra los webservices de AFIP
- El certificado configurado es valido hasta 2028

