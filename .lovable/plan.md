

# Plan: Habilitar botón "Llamar" en la APK del chofer

## Problema Identificado

El botón **"Llamar"** está deshabilitado porque:

1. La query que trae los envíos **no incluye el campo `whatsapp_destinatario`** de la tabla `envios`
2. El código usa `contact?.telefono` donde `contact` es el cliente vinculado (`envio.destinatario`)
3. Para envíos importados (MercadoLibre, CSV, etc.), **no hay cliente vinculado** - los datos van directo en `nombre_destinatario`, `whatsapp_destinatario`, etc.
4. Por lo tanto, `contact` es `null` y el botón queda deshabilitado

**Evidencia:** El envío de "Romina Brites" tiene `whatsapp_destinatario: 1162858618` en la base de datos, pero la app no lo está usando.

---

## Solución

### 1. Agregar campos de teléfono a las queries

Modificar las 2 queries en `ActiveRouteNavigation.tsx`:

**Query de envíos de hoja de ruta (líneas 121-145):**
- Agregar: `whatsapp_destinatario`

**Query de paradas de ruta planificada (líneas 159-183):**
- Agregar: `whatsapp_destinatario`

### 2. Usar el teléfono directo como fallback

Modificar la lógica de obtención de teléfono (línea 442) para usar el teléfono del campo directo cuando no hay cliente vinculado:

```text
Antes:
  contact?.telefono

Después:
  contact?.telefono || envio?.whatsapp_destinatario
```

### 3. Actualizar las funciones de llamada y WhatsApp

Modificar los botones para usar la lógica de fallback:

- **Botón Llamar**: `onClick={() => phone && callCustomer(phone)}`
- **Botón WhatsApp**: `onClick={() => phone && whatsAppCustomer(phone, name)}`

Donde `phone` se define como:
```text
const phone = isPickup 
  ? (contact?.telefono || nextEnvio?.whatsapp_remitente)
  : (contact?.telefono || nextEnvio?.whatsapp_destinatario);
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/ActiveRouteNavigation.tsx` | Agregar campos a queries + lógica de fallback |

---

## Detalles Técnicos

### Cambio en Query de Envíos Hoja de Ruta (líneas ~125-142)
```text
envio:envios(
  id,
  tracking_number,
  ...
  nombre_destinatario,
  nombre_remitente,
+ whatsapp_destinatario,
  destinatario:clientes!...(nombre, apellido, telefono, ...),
  remitente:clientes!...(nombre, apellido, telefono, ...)
)
```

### Cambio en Query de Paradas Planificadas (líneas ~163-180)
```text
envio:envios(
  ...
  nombre_destinatario,
  nombre_remitente,
+ whatsapp_destinatario,
  destinatario:clientes!...(nombre, apellido, telefono, ...),
  remitente:clientes!...(nombre, apellido, telefono, ...)
)
```

### Nueva lógica de teléfono (después de línea 442)
```text
const contact = isPickup ? nextEnvio?.remitente : nextEnvio?.destinatario;
const phone = isPickup
  ? (contact?.telefono)
  : (contact?.telefono || nextEnvio?.whatsapp_destinatario);
```

### Actualización de botones (líneas ~606-622)
```text
<Button 
  variant="outline"
  onClick={() => phone && callCustomer(phone)}
  disabled={!phone}
>
  <Phone className="h-4 w-4 mr-1" />
  Llamar
</Button>
<Button 
  variant="outline"
  className="bg-green-500/10 border-green-500/30 text-green-600"
  onClick={() => phone && whatsAppCustomer(phone, clienteName)}
  disabled={!phone}
>
  <MessageCircle className="h-4 w-4 mr-1" />
  WhatsApp
</Button>
```

---

## Resultado Esperado

- El botón **"Llamar"** estará habilitado cuando exista teléfono (ya sea en el cliente vinculado O en `whatsapp_destinatario`)
- El botón **"WhatsApp"** funcionará de la misma manera
- Envíos importados desde MercadoLibre/CSV mostrarán el teléfono correctamente

