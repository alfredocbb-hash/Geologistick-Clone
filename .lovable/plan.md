
# Plan: Auto-Registro de Envios ML Flex al Escanear

## Problema Identificado

Cuando se escanea un QR de MercadoLibre Flex y el envio no existe en la base de datos, el sistema muestra "Envio ML no encontrado" sin ofrecer la opcion de registrarlo automaticamente.

### Datos del QR escaneado
El QR contiene JSON con la estructura:
```json
{
  "id": "46389045746",      // <-- ML Shipment ID
  "sender_id": 293662607,   // <-- store_id del seller (FULLIMPORT)
  "hash_code": "...",
  "security_digit": "0"
}
```

El seller "FULLIMPORT" (store_id: 293662607) esta registrado en el sistema con token valido, pero el envio nunca fue sincronizado (ni por webhook ni manualmente).

---

## Solucion Propuesta

Modificar el flujo de escaneo para que cuando un envio ML no se encuentre:
1. Extraer el `sender_id` del QR JSON para identificar al seller
2. Mostrar un dialogo preguntando si desea registrar el envio
3. Llamar a una nueva edge function que consulte la API de ML y cree el envio

---

## Cambios Tecnicos

### 1. Actualizar QR Parser para extraer sender_id

**Archivo**: `src/lib/qrParser.ts`

El parser ya detecta ML JSON, pero necesita retornar tambien el `sender_id`:

```typescript
export interface ParsedQR {
  type: 'tracking' | 'route_sheet' | 'ml_shipment' | 'unknown';
  value: string;
  originalData: string;
  mlSenderId?: string; // Nuevo campo
}
```

---

### 2. Nueva Edge Function: register-ml-shipment

**Archivo**: `supabase/functions/register-ml-shipment/index.ts`

Esta funcion recibe un `ml_shipment_id` y `sender_id`:

1. Busca el seller por `store_id = sender_id`
2. Obtiene el access_token valido (refresh si es necesario)
3. Consulta `GET /shipments/{ml_shipment_id}` en la API de ML
4. Verifica que sea tipo `self_service` (Flex)
5. Crea el `ecommerce_order` y el `envio` con el ml_shipment_id original
6. Registra el cargo en cuenta corriente si corresponde
7. Retorna el envio creado

---

### 3. Actualizar ScanQR.tsx y MobileScanTab.tsx

Modificar la funcion `searchShipmentByML` para que cuando no encuentre el envio:

1. Muestre un dialogo preguntando: "Envio ML no registrado. Desea registrarlo ahora?"
2. Si el usuario acepta, llame a `register-ml-shipment`
3. Al completarse, muestre el dialogo de ML Delivery con el envio creado

---

### 4. Nuevo Componente: MLRegisterDialog

**Archivo**: `src/components/scan/MLRegisterDialog.tsx`

Dialogo que muestra:
- "Este envio de MercadoLibre no esta registrado"
- Shipment ID: 46389045746
- Seller detectado: FULLIMPORT (si se encuentra)
- Boton "Registrar Envio" que invoca la edge function
- Estado de carga mientras se procesa

---

## Archivos a Crear/Modificar

| Archivo | Accion |
|---------|--------|
| `src/lib/qrParser.ts` | MODIFICAR - Extraer y retornar sender_id |
| `supabase/functions/register-ml-shipment/index.ts` | CREAR - Nueva edge function |
| `src/components/scan/MLRegisterDialog.tsx` | CREAR - Dialogo de registro |
| `src/pages/ScanQR.tsx` | MODIFICAR - Integrar dialogo de registro |
| `src/components/mobile/MobileScanTab.tsx` | MODIFICAR - Integrar dialogo de registro |
| `supabase/config.toml` | MODIFICAR - Registrar nueva function |

---

## Flujo de Usuario

```text
Usuario escanea QR de ML Flex
        |
        v
parseQRCode() detecta JSON ML
  -> type: 'ml_shipment'
  -> value: '46389045746'
  -> mlSenderId: '293662607'
        |
        v
Busca en envios por ml_shipment_id
        |
    ┌───┴───┐
    |       |
 Existe   No existe
    |       |
    v       v
MLDelivery  MLRegisterDialog
  Dialog    "Desea registrar?"
                |
            [Registrar]
                |
                v
    register-ml-shipment()
                |
                v
    Crea envio con datos de ML API
                |
                v
    Toast: "Envio registrado"
                |
                v
    Muestra MLDeliveryDialog
```

---

## API de MercadoLibre Utilizada

```text
GET https://api.mercadolibre.com/shipments/{shipment_id}

Headers:
  Authorization: Bearer {access_token}

Respuesta incluye:
- id (shipment_id)
- order_id
- status
- logistic_type (debe ser "self_service")
- receiver_address (nombre, direccion, telefono)
- shipping_cost
```

---

## Logica de la Edge Function

```typescript
// register-ml-shipment/index.ts (pseudocodigo)

1. Recibir { ml_shipment_id, sender_id } del body
2. Buscar seller: WHERE store_id = sender_id AND plataforma = 'mercadolibre'
3. Si no existe: return error "Seller no encontrado"
4. Obtener access_token valido (refresh si vencido)
5. GET /shipments/{ml_shipment_id}
6. Verificar logistic_type === 'self_service'
7. Verificar status (debe ser ready_to_ship o shipped)
8. Crear ecommerce_order
9. Crear envio con:
   - ml_shipment_id = shipment.id (EL ORIGINAL)
   - tracking_number = generado
   - estado = 'pendiente'
   - datos del receiver_address
10. Registrar cargo en cuenta corriente
11. Retornar { envio, tracking_number }
```

---

## Consideraciones Importantes

1. **ML Shipment ID Original**: El envio se crea con el `ml_shipment_id` exacto del QR, NO se genera uno nuevo
2. **Seller Correcto**: Se usa el `sender_id` del QR JSON para identificar al seller (en este caso FULLIMPORT, no Pablo Gauna)
3. **Validacion**: Solo se registran envios tipo Flex (logistic_type = self_service)
4. **Sin Autenticacion de Usuario**: La edge function usa service_role_key ya que puede ser invocada sin usuario logueado desde el escaneo
5. **Cuenta Corriente**: El cargo se registra automaticamente si el seller tiene tarifa asignada
