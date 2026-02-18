
# Agregar Botón "Test de Conexión ARCA" en Integraciones

## Objetivo
Agregar un botón en la pestaña ARCA de la página Configuración → Integraciones que llame al servidor de AFIP (WSAA) con los certificados configurados para el entorno seleccionado (Sandbox o Producción) y muestre el resultado: token obtenido o error exacto.

## Arquitectura de la solución

Se necesitan dos cambios:

1. **Nuevo endpoint en el edge function `arca-factura`**: Agregar una acción `test_connection` que solo autentique contra WSAA sin crear ninguna factura ni tocar la base de datos.
2. **UI en `IntegrationSettings.tsx`**: Agregar el botón "Test de Conexión" exclusivamente en la pestaña ARCA, con selector de entorno y panel de resultado.

## Cambio 1: Edge Function `supabase/functions/arca-factura/index.ts`

El handler principal (`serve`) actualmente solo procesa solicitudes de emisión de facturas. Se agregará lógica para detectar una acción `test_connection`:

```
body.action === 'test_connection'
```

Cuando se detecta esta acción:
1. Lee el entorno solicitado (`body.environment`: `sandbox` o `production`)
2. Busca la config ARCA para ese entorno (`getARCAConfig`)
3. Si no hay config, retorna error descriptivo
4. Llama a `autenticarWSAA(...)` con los endpoints del entorno seleccionado
5. Retorna el resultado:
   - **Éxito**: `{ success: true, token_preview, sign_preview, environment, wsaa_url }`
   - **Error**: `{ success: false, error: "mensaje exacto de AFIP" }`

No se modifica ni crea ningún registro en la base de datos. Es una llamada de solo lectura/verificación.

### Snippet del nuevo bloque en el handler:

```typescript
// Detect test_connection action
const body = await req.json();

if (body.action === 'test_connection') {
  const env: 'sandbox' | 'production' = body.environment || 'production';
  const arcaConfig = await getARCAConfig(supabase, tenantId, env);

  if (!arcaConfig) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `No hay configuración ARCA activa para el entorno ${env === 'production' ? 'Producción' : 'Sandbox'}.` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const endpoints = ARCA_ENDPOINTS[env];
  try {
    const { token, sign } = await autenticarWSAA(arcaConfig.cert_pem, arcaConfig.private_key, endpoints.wsaa);
    return new Response(
      JSON.stringify({
        success: true,
        environment: env,
        wsaa_url: endpoints.wsaa,
        token_preview: token.substring(0, 40) + '...',
        sign_preview: sign.substring(0, 40) + '...',
        message: 'Autenticación WSAA exitosa. Los certificados son válidos.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        environment: env,
        wsaa_url: endpoints.wsaa,
        error: err instanceof Error ? err.message : String(err),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
```

## Cambio 2: UI `src/pages/IntegrationSettings.tsx`

Se agrega un bloque condicional `{key === 'arca' && (...)}` dentro del `CardContent` de cada tab, ubicado **después del webhook/docs block y antes del botón Guardar**.

### Nuevo estado necesario:
```typescript
const [arcaTestEnv, setArcaTestEnv] = useState<IntegrationEnvironment>('sandbox');
const [arcaTestResult, setArcaTestResult] = useState<{
  success: boolean;
  message?: string;
  error?: string;
  token_preview?: string;
  sign_preview?: string;
  environment?: string;
  wsaa_url?: string;
} | null>(null);
const [arcaTesting, setArcaTesting] = useState(false);
```

### Lógica del botón:
```typescript
const testArcaConnection = async (env: IntegrationEnvironment) => {
  setArcaTesting(true);
  setArcaTestResult(null);
  try {
    const { data, error } = await supabase.functions.invoke('arca-factura', {
      body: { action: 'test_connection', environment: env },
    });
    if (error) throw error;
    setArcaTestResult(data);
  } catch (err) {
    setArcaTestResult({ success: false, error: err instanceof Error ? err.message : 'Error desconocido' });
  } finally {
    setArcaTesting(false);
  }
};
```

### UI del panel de test (solo visible en tab ARCA):

```
┌─────────────────────────────────────────────────────────────┐
│ Test de Conexión WSAA                                       │
│ Verifica que los certificados se aceptan en AFIP            │
│                                                             │
│  Entorno: [ Sandbox ]  [ Producción ]                       │
│                                                             │
│  [ ⚡ Test de Conexión ]                                     │
│                                                             │
│  ┌─ Resultado ──────────────────────────────────────────┐   │
│  │ ✅ Autenticación WSAA exitosa                        │   │
│  │ Entorno: Sandbox  │  URL: wsaahomo.afip.gov.ar       │   │
│  │ Token: PD94bWwg...                                   │   │
│  │ Sign: D/0rxOO9...                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

El selector de entorno del test es independiente del selector global de la página (que controla qué configuración se carga en el formulario). Esto permite, por ejemplo, estar viendo la config de Sandbox y testear Producción al mismo tiempo.

El panel de resultado muestra:
- En éxito (verde): mensaje de confirmación, entorno, URL WSAA usada, preview del token y del sign
- En error (rojo): el error exacto retornado por AFIP (ej: `WSAA SOAP Fault: cms.cert.untrusted`, `WSAA SOAP Fault: coe.notAuthorized`, etc.)

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/arca-factura/index.ts` | Detectar `body.action === 'test_connection'` antes de parsear el resto del body, ejecutar solo la autenticación WSAA y retornar el resultado |
| `src/pages/IntegrationSettings.tsx` | Agregar estado, función `testArcaConnection`, y panel UI exclusivo para la pestaña ARCA |

## Resultado esperado

Beraexpress podrá:
1. Ir a Configuración → Integraciones → ARCA
2. Seleccionar Sandbox o Producción en el panel de test
3. Hacer clic en "Test de Conexión"
4. Ver inmediatamente si los certificados configurados son aceptados por AFIP
5. En caso de error, ver el mensaje exacto de AFIP (p.ej. `cms.cert.untrusted`, `coe.notAuthorized`, `generationTime inválido`) sin tener que emitir ninguna factura

No se crean facturas, no se modifica la base de datos, no se incrementa ningún contador.
