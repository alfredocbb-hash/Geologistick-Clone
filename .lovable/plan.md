

# Plan: Agregar Opciones de Invitación para MercadoLibre

## Situación Actual

Beraexpress ya creó un seller de MercadoLibre. Ahora necesita enviar una invitación al cliente para que conecte su cuenta.

**El problema**: El sistema solo tiene opciones de invitación para Tiendanube. Para MercadoLibre falta:
1. Las opciones "Enviar link por Email" y "Enviar link por WhatsApp" en el menú desplegable
2. Una función para generar el link de MercadoLibre

## Cómo Funciona el Flujo de Invitación

```text
ADMINISTRADOR (Beraexpress)
         │
         ▼
Crea seller "Mi Tienda ML" con plataforma "mercadolibre"
         │
         ▼
En la tabla de Sellers, abre el menú (...)
         │
         ▼
Elige "Enviar link por WhatsApp" o "Enviar link por Email"
         │
         ▼
Se abre WhatsApp/Email con mensaje pre-armado incluyendo:
"Para conectar tu cuenta de MercadoLibre, haz clic aquí: [LINK]"
         │
         ▼
CLIENTE (dueño de la tienda ML)
         │
         ▼
Recibe el mensaje y hace clic en el link
         │
         ▼
Se abre ventana de autorización de MercadoLibre
         │
         ▼
Cliente autoriza la conexión
         │
         ▼
Sistema guarda los tokens y queda conectado
```

## Cambios a Realizar

### Archivo: `src/pages/ecommerce/Sellers.tsx`

**Paso 1**: Modificar la función `handleSendConnectionLink` para soportar ambas plataformas

Actualmente solo genera links para Tiendanube:
```typescript
const oauthUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tiendanube-oauth/authorize?seller_id=${seller.id}`;
```

Cambiar para detectar la plataforma:
```typescript
const handleSendConnectionLink = (seller: Seller, method: 'email' | 'whatsapp') => {
  // Determinar la URL según la plataforma
  let oauthUrl: string;
  let platformName: string;
  
  if (seller.plataforma === 'mercadolibre') {
    oauthUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadolibre-oauth/authorize?seller_id=${seller.id}`;
    platformName = 'MercadoLibre';
  } else {
    oauthUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tiendanube-oauth/authorize?seller_id=${seller.id}`;
    platformName = 'Tiendanube';
  }
  
  // ... resto de la lógica igual, usando platformName en los mensajes
};
```

**Paso 2**: Agregar opciones de menú para MercadoLibre (después de la línea 505)

```typescript
{seller.plataforma === 'mercadolibre' && !isConnected(seller) && (
  <>
    <DropdownMenuItem onClick={() => handleConnectMercadoLibre(seller)}>
      <Link2 className="mr-2 h-4 w-4" />
      Conectar MercadoLibre
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => handleSendConnectionLink(seller, 'email')}>
      <Mail className="mr-2 h-4 w-4" />
      Enviar link por Email
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleSendConnectionLink(seller, 'whatsapp')}>
      <MessageSquare className="mr-2 h-4 w-4" />
      Enviar link por WhatsApp
    </DropdownMenuItem>
  </>
)}
```

---

## Resultado Esperado

Después de los cambios, el administrador de Beraexpress podrá:

| Acción | Descripción |
|--------|-------------|
| Conectar MercadoLibre | El admin conecta directamente si tiene acceso a la cuenta ML |
| Enviar link por Email | Abre cliente de correo con mensaje pre-armado |
| Enviar link por WhatsApp | Abre WhatsApp Web con mensaje pre-armado |

**Mensaje de ejemplo por WhatsApp:**
```
Hola Mi Tienda ML 👋

Para conectar tu cuenta de MercadoLibre y sincronizar tus pedidos automáticamente, haz clic aquí:

https://uhlgimnmfifmrxraorrl.supabase.co/functions/v1/mercadolibre-oauth/authorize?seller_id=xxx

Solo toma unos segundos 🚀
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/ecommerce/Sellers.tsx` | Actualizar función de envío de links + agregar opciones de menú para ML |

