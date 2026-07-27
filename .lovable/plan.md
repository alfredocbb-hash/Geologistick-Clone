## Problema

En la liquidación de eCommerce (Radikal) el WhatsApp muestra un total que no coincide con el total real de la liquidación. Revisando el código:

```
monto={liquidacion.saldo_final ?? liquidacion.saldo_periodo ?? liquidacion.total_cargos}
```

Se está enviando el **saldo final acumulado** (que arrastra saldo anterior y descuenta pagos) en lugar del **total de la liquidación del período**.

Además el mensaje pone el total al final de un párrafo largo, difícil de leer en mobile.

## Cambios

### 1. Enviar el total correcto por cada tipo de liquidación

Ajustar el `monto` que se pasa a `SendWhatsAppButton`:

| Liquidación | `monto` actual | `monto` correcto |
|---|---|---|
| Seller eCommerce (`SellerLiquidacionDetailDialog.tsx`) | `saldo_final ?? saldo_periodo ?? total_cargos` | **`total_cargos`** (total facturado en el período) |
| Chofer (`DriverSettlements.tsx`) | ya usa `monto_total` / `total_a_pagar` | verificar y dejar el total a pagar al chofer |
| Sucursal (`BranchSettlements.tsx`) | ya usa `total` | sin cambio |
| Terciarizado (`ThirdPartySettlementDetailDialog.tsx`) | ya usa `monto_total` | sin cambio |
| Partner (`PartnerSettlementDetailDialog.tsx`) | `monto_comision ?? monto_total` | sin cambio |

Foco real del fix: **Seller eCommerce** → cambiar a `total_cargos` (el "Total del período" que se ve en el detalle).

### 2. Reformatear el mensaje para que el total destaque

En `src/lib/sendSettlementWhatsApp.ts` cambiar `buildSettlementMessage` para que quede así (usando negrita WhatsApp con asteriscos):

```
{saludo}, {nombre} 👋

Te adjunto la {tipo} del período {desde} al {hasta}.

*Total: $2.967.981,62*

Aguardo comprobante de transferencia, ¡gracias! 😊

{cierre}
```

## Adjunto del PDF en WhatsApp

`wa.me` no admite adjuntos por diseño de WhatsApp; no es un bug nuestro. Para adjuntar el PDF de verdad hacen falta dos caminos:

- **Mobile (Android APK / móvil web)**: usar `navigator.share({ files: [pdf], text })`, que abre la hoja "Compartir" del sistema y permite elegir WhatsApp con el PDF ya adjunto.
- **Desktop**: mantener flujo actual (descarga + `wa.me` con el texto). WhatsApp Web/Desktop **no** acepta adjuntos por URL: es limitación de WhatsApp.

Como el usuario principal parece estar en desktop (según captura), este plan se enfoca en **corregir el total** primero. Si querés que además implemente `navigator.share` con archivo para la APK/móvil, lo agrego en el mismo cambio — avisame y lo incluyo.

## Fuera de alcance

- WhatsApp Business Cloud API (envío server-side con adjunto real sin intervención del usuario).
