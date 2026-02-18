
# Corrección: Respetar entorno seleccionado (Sandbox vs Producción)

## Problema identificado

En las líneas 791-797 del edge function, la lógica actual es:

```typescript
let environment: 'sandbox' | 'production' = 'production';
let arcaConfig = await getARCAConfig(supabase, tenantId, 'production');

if (!arcaConfig) {
  environment = 'sandbox';
  arcaConfig  = await getARCAConfig(supabase, tenantId, 'sandbox');
}
```

Esto tiene dos problemas críticos:

**Problema 1 - Fallback silencioso**: El sistema siempre intenta producción primero. Si producción está configurado pero falla (ej: certificado homologación), no hay forma de usar sandbox. No hay forma de elegir qué entorno usar desde la UI.

**Problema 2 - Sandbox no llama a AFIP**: Cuando el entorno es `sandbox`, el código en `emitirFacturaARCA` devuelve un CAE **inventado** sin llamar al servidor de homologación real de AFIP (`wsaahomo.afip.gov.ar`). Esto significa que Beraexpress no puede probar su integración real con el servidor de test de AFIP aunque tenga certificados de sandbox configurados.

```typescript
// Sandbox actual: FAKE - no llama a AFIP
if (environment === 'sandbox') {
  const cae = `${Date.now()}${Math.floor(Math.random() * 10000)}`;  // Inventado
  return { success: true, cae, caeVencimiento };
}
```

## Solución propuesta

### Cambio 1: Agregar campo `environment` al request

El frontend (`InvoiceDataDialog.tsx`) debe enviar el entorno deseado. Si no se envía, se usa producción como default.

### Cambio 2: Eliminar el fallback automático

El edge function debe usar **exactamente** el entorno que se pidió. Si no hay configuración para ese entorno, devolver error claro en lugar de silenciosamente cambiar de entorno.

### Cambio 3: Sandbox llama al servidor real de AFIP homologación

En `emitirFacturaARCA`, cuando `environment === 'sandbox'`, hacer el flujo SOAP completo pero contra `wsaahomo.afip.gov.ar` y `wswhomo.afip.gov.ar`, en lugar de devolver un CAE inventado. Esto permite que Beraexpress pruebe con sus certificados de sandbox reales.

```typescript
async function emitirFacturaARCA(..., environment: 'sandbox' | 'production', ...) {
  // Ambos entornos usan el mismo flujo SOAP real
  // Solo cambia el endpoint (sandbox vs producción)
  const endpoints = ARCA_ENDPOINTS[environment];  // Ya están definidos arriba
  
  try {
    const { token, sign } = await autenticarWSAA(config.cert_pem, config.private_key, endpoints.wsaa);
    const { cae, caeVencimiento } = await solicitarCAE(token, sign, ..., endpoints.wsfe);
    return { success: true, cae, caeVencimiento };
  } catch (err) { ... }
}
```

### Cambio 4: UI muestra el entorno activo en el dialog

En `InvoiceDataDialog.tsx`, mostrar qué entorno se usará (sandbox o producción) basándose en `useARCAIntegration`, y enviar ese valor en el body de la llamada al edge function.

## Archivos a modificar

### `supabase/functions/arca-factura/index.ts`

1. Aceptar campo `environment?: 'sandbox' | 'production'` en el body del request
2. Buscar config solo para el entorno pedido (sin fallback silencioso):
   ```typescript
   const requestedEnv = body.environment || 'production';
   const arcaConfig = await getARCAConfig(supabase, tenantId, requestedEnv);
   
   if (!arcaConfig) {
     // Si hay config del otro entorno, sugerir usarlo. Si no hay ninguno, guardar pendiente.
     const otherEnv = requestedEnv === 'production' ? 'sandbox' : 'production';
     const otherConfig = await getARCAConfig(supabase, tenantId, otherEnv);
     return error con mensaje: `No hay configuración ARCA para ${requestedEnv}. ${otherConfig ? `Hay configuración para ${otherEnv}.` : ''}`
   }
   
   environment = requestedEnv;
   ```
3. En `emitirFacturaARCA`: eliminar el bloque especial de sandbox, usar siempre el flujo SOAP real con el endpoint del entorno correspondiente.

### `src/components/invoicing/InvoiceDataDialog.tsx`

1. Usar `useARCAIntegration` para detectar qué entornos están configurados
2. Si hay dos configurados, mostrar un toggle Sandbox/Producción para elegir
3. Enviar `environment` en el body de `supabase.functions.invoke('arca-factura', { body: { ..., environment } })`
4. Mostrar claramente en el alert de estado qué entorno se usará

## Resultado esperado

- Beraexpress puede elegir si facturar contra sandbox (con sus certificados de homologación y AFIP test) o producción (cuando tenga el certificado real)
- Sandbox llama al servidor real de AFIP homologación, permitiendo validar que los certificados y la configuración funcionan correctamente antes de ir a producción
- No hay más cambios silenciosos de entorno que confundan al usuario
- Mensajes de error claros cuando el entorno pedido no está configurado
