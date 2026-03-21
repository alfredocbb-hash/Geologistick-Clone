

## Plan: APIs públicas de cotización y sucursales por tenant

### Cambios

**1. `supabase/functions/public-rates/index.ts`** — Nueva Edge Function de cotización:

- Autenticación via `x-api-key` → `validate_api_key` RPC → `tenant_id`
- Parámetros (POST body o query): `peso`, `bultos`, `tipo_servicio`, `cp_destino`, `ciudad_destino`, `valor_declarado`
- Busca tarifas activas del tenant, calcula precio total (base + peso + conceptos filtrados por tipo servicio + seguro si aplica)
- **Respuesta simplificada**: solo precio total por tarifa, sin desglose de conceptos
- Incluye pickup points si el tipo de servicio implica retiro en sucursal

**2. `supabase/functions/public-branches/index.ts`** — Nueva Edge Function de sucursales:

- Autenticación via `x-api-key`
- Filtro opcional por tipo: `todas`, `retiro`, `despacho`, `entrega`
- Devuelve sucursales activas con nombre, dirección, ciudad, CP, coordenadas, horarios, capacidades

**3. `src/components/tenants/TenantApiKeysDialog.tsx`** — Agregar documentación de ambos endpoints nuevos

### Respuesta API de cotización

```text
POST /functions/v1/public-rates
Headers: x-api-key: tk_xxx...

Body: {
  "peso": 5,
  "bultos": 2,
  "tipo_servicio": "puerta_puerta",
  "cp_destino": "1425",
  "valor_declarado": 50000
}

Response: {
  "rates": [
    {
      "tarifa": "Envío Estándar",
      "precio": 4850.00,
      "moneda": "ARS",
      "dias_entrega_min": 3,
      "dias_entrega_max": 5
    },
    {
      "tarifa": "Express",
      "precio": 6200.00,
      "moneda": "ARS",
      "dias_entrega_min": 1,
      "dias_entrega_max": 1
    }
  ],
  "pickup_points": [
    {
      "nombre": "Sucursal Centro",
      "direccion": "Av. Corrientes 1234",
      "ciudad": "CABA",
      "codigo_postal": "1043",
      "precio": 3500.00,
      "lat": -34.60,
      "lng": -58.38
    }
  ]
}
```

### Respuesta API de sucursales

```text
GET /functions/v1/public-branches?tipo=retiro
Headers: x-api-key: tk_xxx...

Response: {
  "sucursales": [
    {
      "nombre": "Sucursal Centro",
      "codigo": "CEN",
      "direccion": "Av. Corrientes 1234",
      "ciudad": "CABA",
      "codigo_postal": "1043",
      "telefono": "+54 11 1234-5678",
      "email": "centro@empresa.com",
      "lat": -34.6037,
      "lng": -58.3816,
      "horario_apertura": "09:00",
      "horario_cierre": "18:00",
      "permite_retiro_clientes": true,
      "puede_despachar": true,
      "realiza_entregas": true
    }
  ]
}
```

### Lógica de cálculo

- Precio base de tarifa (× bultos si `multiplicar_flete_por_bultos`)
- Adicional por peso según rangos configurados
- Conceptos básicos sumados al total (filtrados por tipo servicio: "entrega a domicilio" solo si destino es puerta, "retiro" solo si origen es puerta)
- **Seguro**: si `valor_declarado` > 0, consulta `configuracion_seguro` del tenant y suma `seguro_base` + excedente proporcional
- Se devuelve **solo el precio total**, sin desglose

### Seguridad

- Ambos endpoints requieren API Key válida
- Solo datos del tenant autenticado
- No expone IDs internos

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/public-rates/index.ts` | Nueva Edge Function cotización |
| `supabase/functions/public-branches/index.ts` | Nueva Edge Function sucursales |
| `src/components/tenants/TenantApiKeysDialog.tsx` | Documentación endpoints nuevos |

No requiere migraciones de base de datos.

