

# Fix: Pagina de conexion exitosa muestra codigo HTML crudo

## Problema

Al completar el flujo OAuth con Tiendanube, el navegador muestra el codigo fuente HTML en lugar de renderizar la pagina profesional de "Conexion Exitosa". Esto ocurre en la URL del callback (`/functions/v1/tiendanube-oauth/callback`).

## Causa

Las respuestas HTML del edge function `tiendanube-oauth` usan `{ ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }` como un objeto plano. En algunos casos, Supabase Edge Functions no aplica correctamente el `Content-Type` cuando se mezclan headers CORS con headers de contenido HTML de esta forma.

Ademas, los headers CORS no son necesarios para respuestas HTML que el navegador renderiza directamente (no son llamadas AJAX).

## Solucion

Modificar el archivo `supabase/functions/tiendanube-oauth/index.ts` para:

1. **Usar un objeto `Headers` explicito** para las respuestas HTML en lugar de un objeto plano spread
2. **Eliminar los headers CORS de las respuestas HTML** (solo son necesarios para respuestas JSON de APIs, no para paginas que el navegador navega directamente)
3. Aplicar el mismo fix a todas las respuestas HTML del archivo: la pagina de exito, las paginas de error (`errorPage`), y la redireccion

### Cambios concretos

En cada `return new Response(...)` que devuelve HTML:

**Antes:**
```typescript
return new Response(html, {
  status: 200,
  headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }
});
```

**Despues:**
```typescript
return new Response(html, {
  status: 200,
  headers: new Headers({ "Content-Type": "text/html; charset=utf-8" })
});
```

Esto aplica a:
- La funcion `errorPage` y sus usos (6 lugares)
- La pagina de conexion exitosa (1 lugar)
- Las respuestas JSON y el redirect mantienen `corsHeaders` ya que son respuestas de API

### Archivo afectado

- `supabase/functions/tiendanube-oauth/index.ts` - Unico archivo a modificar

