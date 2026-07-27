## Objetivo

Sumar un botón **"Enviar por WhatsApp"** junto a las acciones ya existentes (PDF, etc.) en cada liquidación generada, para Sellers eCommerce, Choferes, Sucursales, Terciarizados y Partners.

## Comportamiento

- Abre `https://wa.me/<telefono>?text=<mensaje>` en una pestaña nueva (funciona en web y en la APK vía WhatsApp instalado).
- El teléfono se toma del registro del destinatario y se normaliza con `normalizePhoneAR`.
- Dispara además la descarga del PDF de la liquidación para que el usuario lo adjunte manualmente (wa.me no permite adjuntos).
- Si no hay teléfono cargado, el botón queda deshabilitado con tooltip *"Sin teléfono cargado"*.

## Mensaje (cordial, según horario y día)

Se arma dinámicamente en AR-Spanish. Estructura:

```
{saludo_horario}, adjunto liquidación correspondiente al período {desde} al {hasta}
por un total de ${monto}. Aguardo comprobante de transferencia, ¡gracias! 😊
{cierre_dia}
```

- **saludo_horario** según hora local:
  - 05:00–12:59 → "Buenos días"
  - 13:00–19:59 → "Buenas tardes"
  - resto → "Buenas noches"
- **cierre_dia** según día de la semana:
  - Lunes → "¡Que tengas un excelente comienzo de semana!"
  - Martes–Jueves → "¡Que tengas un excelente día!"
  - Viernes → "¡Buen finde!"
  - Sábado/Domingo → "¡Que disfrutes el finde!"
- Se personaliza con el nombre del destinatario cuando esté disponible ("Buenos días, Ariel, …").

## Origen del teléfono por tipo

| Liquidación | Fuente |
|---|---|
| Seller eCommerce | `ecommerce_sellers.telefono` (fallback `clientes.telefono`) |
| Chofer | `profiles.telefono` del `chofer_id` |
| Sucursal | `sucursales.telefono` |
| Terciarizado | `empresas_terciarizadas.telefono` |
| Partner | `tenants.telefono` del `partner_tenant_id` |

## Implementación técnica

1. **Helper** `src/lib/sendSettlementWhatsApp.ts`:
   - `buildSettlementMessage({ tipo, nombre, periodoInicio, periodoFin, monto, now })` → arma el texto con saludo/cierre según fecha.
   - `sendSettlementViaWhatsApp({ phone, message, onDownloadPdf })` → normaliza con `normalizePhoneAR`, descarga PDF y abre `wa.me` en `_blank`.

2. **Componente** `src/components/settlements/SendWhatsAppButton.tsx` — botón reutilizable (ícono verde tipo WhatsApp), deshabilitado sin teléfono, con tooltip explicativo.

3. **Integraciones** (solo agregar el botón junto al de PDF existente):
   - `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx`
   - `src/pages/DriverSettlements.tsx`
   - `src/pages/BranchSettlements.tsx`
   - `src/components/settlements/ThirdPartySettlementDetailDialog.tsx`
   - `src/components/settlements/PartnerSettlementDetailDialog.tsx`

4. **Consultas**: extender los `select()` de cada listado/dialog para traer `telefono` y `nombre` del destinatario cuando falte.

## Fuera de alcance

- Envío automático con PDF adjunto (requeriría WhatsApp Business API).
- Cambios en cálculos, permisos o estados de liquidación.
