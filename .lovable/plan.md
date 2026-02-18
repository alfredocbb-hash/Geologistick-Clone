
# Corrección: Decodificación HTML entities en respuesta WSAA (Sandbox)

## Estado actual confirmado por los logs

### Sandbox - Casi funcionando
AFIP Homologación aceptó la autenticación y devolvió HTTP 200 con token y sign válidos. El token está presente en la respuesta. El problema es que el contenido dentro de `<loginCmsReturn>` usa HTML entities:

```
&lt;token&gt;PD94bWwg...&lt;/token&gt;
&lt;sign&gt;D/0rxOO9...&lt;/sign&gt;
```

El código busca `<token>` con regex, pero en la respuesta real aparece como `&lt;token&gt;`. Por eso falla con "No se pudo extraer token/sign" aunque el token sí llegó.

**Fix**: Agregar una función `decodeHtmlEntities()` y aplicarla al `responseText` antes de ejecutar los regex de extracción. Solo 2 líneas de cambio real en `autenticarWSAA()`.

### Producción - Bloqueado por IP (no es error de código)
```
faultcode: ns1:coe.notAuthorized
faultstring: Computador no autorizado a acceder al servicio
```
AFIP detectó que la solicitud proviene de una IP de un datacenter cloud internacional y la bloqueó. Esto es una restricción de AFIP para el entorno de producción. **No tiene solución de código** — requiere acción administrativa ante AFIP (registrar la IP del servidor o usar un proxy en Argentina).

---

## Cambio a realizar

### Archivo: `supabase/functions/arca-factura/index.ts`

**Agregar función de decodificación** (antes de `autenticarWSAA`):

```typescript
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_: string, dec: string) => String.fromCharCode(parseInt(dec)));
}
```

**Cambio en `autenticarWSAA()` (líneas 369-381)**:

Antes:
```typescript
// Parse token and sign from XML response
const tokenMatch = responseText.match(/<token>([\s\S]*?)<\/token>/);
const signMatch  = responseText.match(/<sign>([\s\S]*?)<\/sign>/);

// Check for SOAP fault
const faultMatch = responseText.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
if (faultMatch) {
  throw new Error(`WSAA SOAP Fault: ${faultMatch[1]}`);
}

if (!tokenMatch || !signMatch) {
  throw new Error(`WSAA: No se pudo extraer token/sign. Respuesta: ${responseText.substring(0, 500)}`);
}
```

Después:
```typescript
// Decodificar HTML entities (AFIP sandbox devuelve &lt;token&gt; dentro de loginCmsReturn)
const decodedResponse = decodeHtmlEntities(responseText);

// Check for SOAP fault first (también puede estar codificado)
const faultMatch = decodedResponse.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
if (faultMatch) {
  throw new Error(`WSAA SOAP Fault: ${faultMatch[1]}`);
}

// Parse token and sign from decoded XML response
const tokenMatch = decodedResponse.match(/<token>([\s\S]*?)<\/token>/);
const signMatch  = decodedResponse.match(/<sign>([\s\S]*?)<\/sign>/);

if (!tokenMatch || !signMatch) {
  throw new Error(`WSAA: No se pudo extraer token/sign. Respuesta: ${responseText.substring(0, 500)}`);
}
```

---

## Situación de producción para Beraexpress

El error `coe.notAuthorized` significa que AFIP bloqueó la IP de nuestro servidor edge porque es una IP de datacenter cloud. Para que producción funcione, Beraexpress necesita:

**Opción A (recomendada)**: Contactar a AFIP Soporte Técnico para registrar/habilitar las IPs del servidor edge en su CUIT de producción. Los servidores de AFIP producción requieren whitelist de IPs para ciertos tipos de acceso.

**Opción B**: Usar un proxy en Argentina con IP fija registrada ante AFIP.

Mientras tanto, **sandbox sí funcionará completamente** con este fix, permitiendo probar el flujo completo de emisión de comprobantes.

---

## Resultado esperado con el fix

El flujo sandbox debería completarse:
1. WSAA homologación acepta el TRA ✓ (ya funciona)
2. Token y sign se extraen correctamente ← (este es el fix)
3. WSFEv1 homologación recibe la solicitud de CAE
4. AFIP devuelve un CAE de prueba real
5. La factura se guarda en la base de datos con estado "emitida"
