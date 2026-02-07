

# Corregir paginas de error en OAuth de Tiendanube y MercadoLibre

## Estado Actual

Las paginas de **exito** ya estan correctamente implementadas en ambas integraciones:
- **Tiendanube**: Muestra una pagina con fondo degradado violeta, animacion de check, mensaje "Conexion Exitosa!" y agradecimiento
- **MercadoLibre**: Muestra una pagina con fondo amarillo (branding ML), animacion de check, mensaje "Conexion Exitosa!" y agradecimiento

Sin embargo, hay **5 puntos donde el usuario veria JSON crudo** en lugar de una pagina amigable si ocurre un error:

## Problemas Identificados

### 1. MercadoLibre - Errores en authorize (3 puntos)
Cuando un seller intenta conectar su tienda de ML y algo falla ANTES de redirigir a MercadoLibre, ve JSON crudo:

- **seller_id faltante** (linea 59-62): Responde `{"error": "seller_id is required"}`
- **Seller no encontrado** (linea 74-77): Responde `{"error": "Seller not found"}`
- **Integracion no configurada** (linea 85-88): Responde `{"error": "MercadoLibre integration not configured..."}`

### 2. MercadoLibre - Error general catch (linea 318-324)
Si ocurre un error inesperado, responde JSON: `{"error": "..."}`

### 3. Tiendanube - Error general catch (linea 455-461)
Si ocurre un error inesperado en el flujo OAuth de Tiendanube, responde JSON: `{"error": "..."}`

## Solucion

### Archivo: `supabase/functions/mercadolibre-oauth/index.ts`

Cambios:
1. Convertir las 3 respuestas de error del endpoint `authorize` de JSON a HTML, usando la funcion `generateHtmlResponse(false, ...)` que ya existe
2. Convertir el catch general a HTML usando `generateHtmlResponse(false, ...)`
3. Convertir el "Unknown endpoint" a HTML

### Archivo: `supabase/functions/tiendanube-oauth/index.ts`

Cambios:
1. Convertir el catch general (linea 455-461) para usar la funcion `errorPage()` que ya existe en lugar de JSON

## Seccion Tecnica

### MercadoLibre OAuth - authorize endpoint

```
ANTES (linea 59-62):
  return new Response(JSON.stringify({ error: 'seller_id is required' }), ...)

DESPUES:
  return new Response(
    generateHtmlResponse(false, 'Enlace invalido. Solicita un nuevo enlace a tu proveedor logistico.', ''),
    { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
```

Aplicar el mismo patron a:
- Seller no encontrado (linea 74-77)
- Integracion no configurada (linea 85-88)
- Catch general (linea 318-324)
- Unknown endpoint (linea 313-315)

### Tiendanube OAuth - catch general

```
ANTES (linea 457-460):
  return new Response(JSON.stringify({ error: message }), ...)

DESPUES:
  return new Response(
    errorPage("Error inesperado", "Ocurrio un error procesando la conexion. Intenta nuevamente."),
    { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
```

### Re-despliegue
Desplegar ambas funciones: `tiendanube-oauth` y `mercadolibre-oauth`

## Resultado Esperado
- En cualquier escenario (exito o error), el usuario siempre vera una pagina HTML estilizada con un mensaje claro en espanol
- Nunca vera JSON crudo ni codigo fuente

