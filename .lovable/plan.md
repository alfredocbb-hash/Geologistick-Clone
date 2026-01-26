

# Plan: Corregir Errores de Sincronización y Mejorar Páginas OAuth

## Problema 1: Error de Sincronización (404 "Last page is 0")

### Diagnóstico
Los logs muestran:
```
Failed to fetch orders: {
  "code": 404,
  "message": "Not Found", 
  "description": "Last page is 0"
}
```

Cuando una tienda **no tiene pedidos**, Tiendanube devuelve un 404 en lugar de un array vacío. El código actual (líneas 118-132 de `tiendanube-sync`) interpreta esto como error fatal cuando debería ser un caso válido.

### Solución
Detectar el error 404 con "Last page is 0" y tratarlo como "sin pedidos" en lugar de error:

```typescript
if (!response.ok) {
  const errorText = await response.text();
  
  // Tiendanube returns 404 when store has no orders ("Last page is 0")
  if (response.status === 404 && errorText.includes("Last page is 0")) {
    console.log("Store has no orders yet");
    hasMore = false;
    break; // Exit loop gracefully
  }
  
  // ... resto del manejo de errores
}
```

---

## Problema 2: Página de Éxito OAuth Muestra Código

### Diagnóstico
La página de éxito no incluye `charset=utf-8` en los headers ni en el meta tag, causando que algunos navegadores móviles muestren el HTML crudo.

### Solución
Mejorar el HTML con charset correcto y diseño profesional.

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/tiendanube-sync/index.ts` | Manejar 404 "Last page is 0" como caso válido |
| `supabase/functions/tiendanube-oauth/index.ts` | Mejorar página de éxito con charset UTF-8 |

---

## Cambios Detallados

### 1. tiendanube-sync/index.ts (líneas 118-133)

**Antes:**
```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error("Failed to fetch orders:", errorText);
  
  if (response.status === 401) {
    return new Response(...);
  }
  
  return new Response(
    JSON.stringify({ error: "Failed to fetch orders from Tiendanube" }),
    { status: 500, ... }
  );
}
```

**Después:**
```typescript
if (!response.ok) {
  const errorText = await response.text();
  
  // Tiendanube returns 404 when store has no orders ("Last page is 0")
  if (response.status === 404 && errorText.includes("Last page is 0")) {
    console.log("Store has no orders yet - this is normal for new stores");
    hasMore = false;
    break;
  }
  
  console.error("Failed to fetch orders:", errorText);
  
  if (response.status === 401) {
    return new Response(...);
  }
  
  return new Response(
    JSON.stringify({ error: "Failed to fetch orders from Tiendanube" }),
    { status: 500, ... }
  );
}
```

### 2. tiendanube-oauth/index.ts (líneas 286-315)

Reemplazar la página de éxito actual con una versión mejorada:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conexion Exitosa - Tiendanube</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; 
      align-items: center; 
      justify-content: center; 
      min-height: 100vh; 
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .card { 
      background: white; 
      padding: 48px 40px; 
      border-radius: 16px; 
      text-align: center; 
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 420px;
      width: 100%;
      animation: slideUp 0.5s ease-out;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #1a1a1a; margin-bottom: 12px; font-size: 24px; font-weight: 600; }
    .subtitle { color: #666; font-size: 16px; margin-bottom: 24px; line-height: 1.6; }
    .hint { font-size: 13px; color: #999; margin-top: 24px; }
    .loader { 
      width: 24px; height: 24px; 
      border: 3px solid #eee; 
      border-top-color: #667eea; 
      border-radius: 50%; 
      animation: spin 1s linear infinite;
      margin: 20px auto 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Tienda Conectada</h1>
    <p class="subtitle">Tu tienda de Tiendanube se ha vinculado correctamente con el sistema de envios.</p>
    <p class="hint">Esta ventana se cerrara automaticamente...</p>
    <div class="loader"></div>
  </div>
  <script>
    setTimeout(function() {
      if (window.opener) {
        window.opener.postMessage({ type: 'tiendanube-oauth-success', sellerId: '${sellerId}' }, '*');
      }
      window.close();
    }, 3000);
  </script>
</body>
</html>
```

**Nota importante:** El HTML usa caracteres ASCII simples (sin tildes) para evitar problemas de encoding en algunos navegadores.

---

## Resultado Esperado

1. **Sincronización:** Cuando una tienda no tiene pedidos, mostrará:
   - Mensaje de éxito: "Sincronizado: 0 pedidos (tienda sin pedidos aún)"
   - En lugar de error 500

2. **Página OAuth:** Los sellers verán una página profesional con:
   - Fondo gradiente
   - Animación de entrada
   - Loader mientras se cierra
   - Mensaje claro de éxito

