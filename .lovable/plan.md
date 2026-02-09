

# Fix: Redirigir a pagina frontend en lugar de devolver HTML desde Edge Function

## Problema real

El Edge Function ya usa `new Headers({ "Content-Type": "text/html; charset=utf-8" })` pero el navegador sigue mostrando el codigo HTML crudo. Esto ocurre porque la infraestructura de Supabase Edge Functions puede sobreescribir o ignorar el Content-Type para respuestas HTML largas.

## Solucion

En lugar de devolver HTML desde el Edge Function, **redirigir al frontend** con parametros en la URL. El frontend (React) se encarga de renderizar la pagina profesional.

### Flujo actual (falla)

```text
Tiendanube --> Edge Function --> Devuelve HTML (el navegador no lo renderiza)
```

### Flujo nuevo (confiable)

```text
Tiendanube --> Edge Function --> Redirect 302 a /oauth/tiendanube/success
                                 El navegador carga la app React --> Renderiza la pagina bonita
```

## Archivos a modificar/crear

### 1. Crear: `src/pages/TiendanubeOAuthResult.tsx`

Pagina React que muestra el resultado de la conexion OAuth:
- Recibe parametros via query string: `?status=success&seller_id=xxx` o `?status=error&title=...&message=...`
- Si `status=success`: muestra la pagina profesional con el diseno actual (logo Tiendanube, animaciones, mensaje de exito, cierre automatico)
- Si `status=error`: muestra la pagina de error con titulo y mensaje
- Envia `postMessage` al opener y cierra la ventana despues de 4 segundos (igual que ahora)

### 2. Modificar: `src/App.tsx`

Agregar ruta publica `/oauth/tiendanube/result` que apunte a `TiendanubeOAuthResult`

### 3. Modificar: `supabase/functions/tiendanube-oauth/index.ts`

Cambiar todas las respuestas HTML por redirects 302:

**Exito (callback exitoso):**
```text
Redirect a: https://geologic.lovable.app/oauth/tiendanube/result?status=success&seller_id=xxx
```

**Errores:**
```text
Redirect a: https://geologic.lovable.app/oauth/tiendanube/result?status=error&title=...&message=...
```

La URL base del frontend se obtiene de una variable de entorno o se hardcodea como la URL publicada.

- Se elimina todo el HTML inline del edge function (mas de 100 lineas de HTML/CSS)
- Se elimina la funcion `errorPage()`
- El edge function solo hace logica de negocio + redirects (mas limpio y mantenible)

## Beneficios

- El navegador siempre renderiza correctamente (es una pagina React normal)
- El edge function queda mas limpio sin HTML inline
- Mas facil de mantener y modificar el diseno en el futuro
- Funciona con cualquier navegador sin depender del Content-Type del edge function

