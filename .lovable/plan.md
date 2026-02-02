

# Plan: Corregir Parser QR para Soportar Formato JSON de MercadoLibre Flex

## Problema Identificado

El QR de MercadoLibre Flex contiene un **objeto JSON** completo:
```json
{"id":"46071048441","sender_id":293662607,"hash_code":"05B8kXSx1f6rH4T2wgPBptCAWkchnT42OBdmfAuiZBk=","security_digit":"0"}
```

El parser actual (`qrParser.ts`) no detecta este formato y lo trata como un tracking generico, causando el error "Envio no encontrado".

## Solucion

Agregar deteccion de JSON con campo `id` numerico en el parser QR, extrayendo el shipment ID correctamente.

## Cambios Tecnicos

### Archivo: `src/lib/qrParser.ts`

Agregar deteccion de formato JSON al inicio de la funcion `parseQRCode`:

```typescript
// NUEVO: Detectar formato JSON de MercadoLibre Flex
// Formato: {"id":"46071048441","sender_id":293662607,"hash_code":"...","security_digit":"0"}
if (trimmed.startsWith('{') && trimmed.includes('"id"')) {
  try {
    const jsonData = JSON.parse(trimmed);
    // Verificar que tiene campo id numerico (8+ digitos)
    if (jsonData.id && /^\d{8,}$/.test(String(jsonData.id))) {
      return {
        type: 'ml_shipment',
        value: String(jsonData.id),
        originalData: data
      };
    }
  } catch {
    // No es JSON valido, continuar con otros metodos
  }
}
```

### Ubicacion del Cambio

Se insertara **despues** de la deteccion de hojas de ruta (`HR:`) y **antes** de la deteccion de `ML:` prefix, aproximadamente en la linea 33.

### Flujo Resultante

```text
QR Escaneado
     |
     v
  Es HR:xxx? --> Si --> Retornar route_sheet
     |
     No
     v
  Es JSON con "id"? --> Si --> Extraer id --> Retornar ml_shipment
     |
     No
     v
  Es ML:xxxxx? --> Si --> Retornar ml_shipment
     |
     No
     v
  Es numero 10+ digitos? --> Si --> Retornar ml_shipment
     |
     No
     v
  (Resto del flujo existente...)
```

## Archivo a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/lib/qrParser.ts` | Agregar deteccion de JSON con campo `id` numerico |

## Resultado Esperado

Cuando el chofer escanee un QR de MercadoLibre Flex con formato JSON:

1. El parser detectara que es JSON
2. Extraera el campo `id` (ej: `46071048441`)
3. Retornara tipo `ml_shipment` con el valor correcto
4. El sistema buscara en la base de datos por `ml_shipment_id`
5. Se mostrara el dialogo `MLDeliveryDialog` para gestionar el envio

