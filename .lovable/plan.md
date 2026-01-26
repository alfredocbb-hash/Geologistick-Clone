

# Plan: Enviar Link de Conexión por Email/WhatsApp al Seller

## Resumen del Problema

Actualmente, cuando un admin quiere que un seller conecte su tienda Tiendanube:
1. El admin hace clic en "Conectar" desde el panel
2. Se abre un popup que requiere que el admin tenga las credenciales del seller
3. El seller no puede completar esto por su cuenta

**Solución propuesta:** Permitir al admin enviar un link de conexión por Email o WhatsApp para que el seller complete la sincronización desde su propio dispositivo.

## Arquitectura de la Solución

```text
+------------------+     +-------------------+     +------------------+
|  Panel Admin     | --> | Edge Function     | --> | Email/WhatsApp   |
|  (Sellers.tsx)   |     | send-seller-link  |     | al Seller        |
+------------------+     +-------------------+     +------------------+
                                                          |
                                                          v
                                              +----------------------+
                                              | Seller abre link     |
                                              | en su dispositivo    |
                                              +----------------------+
                                                          |
                                                          v
                                              +----------------------+
                                              | OAuth Tiendanube     |
                                              | Página de éxito      |
                                              +----------------------+
```

## Implementación

### 1. Nueva Edge Function: `send-seller-connection-link`

Crear una función que:
- Reciba el `seller_id` y el método de envío (`email` o `whatsapp`)
- Genere el link de OAuth: `https://[supabase_url]/functions/v1/tiendanube-oauth/authorize?seller_id=[id]`
- Envíe por Email (usando integración SMTP) o WhatsApp (usando WhatsApp Business API)

```typescript
// supabase/functions/send-seller-connection-link/index.ts
// - Obtener datos del seller (email, telefono)
// - Obtener credenciales de integración (SMTP o WhatsApp)
// - Construir el link de OAuth
// - Enviar email/WhatsApp con el link
```

### 2. Actualizar UI en Sellers.tsx

Agregar un nuevo menú desplegable o diálogo con opciones:
- **Conectar directamente** (comportamiento actual)
- **Enviar link por Email**
- **Enviar link por WhatsApp**

```typescript
// Nuevo componente o diálogo para enviar invitación
<DropdownMenuItem onClick={() => handleSendInvitation(seller, 'email')}>
  <Mail className="mr-2 h-4 w-4" />
  Enviar invitación por Email
</DropdownMenuItem>
<DropdownMenuItem onClick={() => handleSendInvitation(seller, 'whatsapp')}>
  <MessageSquare className="mr-2 h-4 w-4" />
  Enviar invitación por WhatsApp
</DropdownMenuItem>
```

### 3. Opción Simplificada (Sin Edge Function)

Alternativamente, para una implementación más rápida sin backend:
- Generar el link en el frontend
- Abrir cliente de email/WhatsApp del navegador con mensaje pre-armado
- Similar a como ya funciona `handleShareWhatsApp` para tracking

```typescript
const handleSendConnectionLink = (seller: Seller, method: 'email' | 'whatsapp') => {
  const oauthUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tiendanube-oauth/authorize?seller_id=${seller.id}`;
  
  const message = `Hola ${seller.nombre},\n\nPara conectar tu tienda Tiendanube, haz clic en el siguiente enlace:\n\n${oauthUrl}\n\nEste link te permitirá autorizar la sincronización de pedidos.`;
  
  if (method === 'whatsapp') {
    const cleanPhone = seller.telefono?.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  } else {
    window.open(`mailto:${seller.email}?subject=Conecta tu tienda&body=${encodeURIComponent(message)}`, '_blank');
  }
};
```

## Archivos a Modificar/Crear

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/pages/ecommerce/Sellers.tsx` | Modificar | Agregar opciones de envío de link en el dropdown |
| `supabase/functions/send-seller-connection-link/index.ts` | Crear (opcional) | Edge function para envío automático |

## Recomendación

**Opción A (Rápida):** Implementar la solución frontend-only que abre el cliente de email/WhatsApp del navegador. No requiere configuración adicional y funciona inmediatamente.

**Opción B (Completa):** Crear Edge Function que envíe automáticamente usando las integraciones SMTP/WhatsApp configuradas. Más profesional pero requiere que las integraciones estén configuradas.

## Flujo del Seller

1. Admin selecciona "Enviar invitación por Email/WhatsApp"
2. Se abre el cliente de correo/WhatsApp con mensaje pre-armado
3. Admin envía el mensaje
4. Seller recibe el link en su dispositivo
5. Seller hace clic en el link
6. Se abre Tiendanube y el seller autoriza con SU cuenta
7. Conexión completada
8. El panel del admin se actualiza automáticamente

## Consideraciones de Seguridad

- El link de OAuth es seguro porque solo funciona para el seller_id específico
- El link no expone credenciales ni tokens
- La autorización requiere que el seller inicie sesión en SU cuenta de Tiendanube

## Detalles Técnicos

### Estructura del mensaje sugerido

**Email:**
```
Asunto: Conecta tu tienda a [NombreEmpresa]

Hola [NombreSeller],

Para sincronizar automáticamente tus pedidos de Tiendanube, 
necesitamos que autorices la conexión.

Haz clic en el siguiente enlace:
[LINK]

Este proceso es seguro y solo toma unos segundos.

Saludos,
[NombreEmpresa]
```

**WhatsApp:**
```
Hola [NombreSeller] 👋

Para conectar tu tienda y sincronizar tus pedidos automáticamente, 
haz clic aquí:

[LINK]

Solo toma unos segundos 🚀
```

