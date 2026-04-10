

## Plan: Correcciones del sistema (4 cambios)

### 0. WhatsApp de Geologistick
Actualizar el numero de WhatsApp hardcodeado en `Hero.tsx` de `5491112345678` a `5491151767139`.

**Archivo**: `src/components/landing/Hero.tsx` linea 20

---

### 1. Tracking: Agregar boton "Volver"
La pagina `/tracking` no tiene forma de volver a la landing o al inicio. Agregar un boton "Volver al inicio" en el header que use `navigate(-1)` o link a `/`.

**Archivo**: `src/pages/Tracking.tsx` -- agregar un boton con icono ArrowLeft arriba del titulo, linkeando a `/`

---

### 2. Shipments: Total muestra siempre 1000
El problema esta en lineas 354-356 de `Shipments.tsx`. La query hace `.select('estado')` sin especificar count, y Supabase retorna maximo 1000 rows por defecto. Luego usa `data.length` que siempre sera <= 1000.

**Solucion**: Cambiar a queries con `{ count: 'exact', head: true }` para cada estado, eliminando el limite de 1000. Hacer un count por estado individual:

```typescript
const { count: total } = await supabase
  .from('envios')
  .select('*', { count: 'exact', head: true });

const { count: pendiente } = await supabase
  .from('envios')
  .select('*', { count: 'exact', head: true })
  .eq('estado', 'pendiente');
// ... etc para cada estado
```

**Archivo**: `src/pages/Shipments.tsx` lineas 351-369

---

### 3. OAuth Result pages: Logo del tenant + diseño profesional
Actualmente las paginas `TiendanubeOAuthResult.tsx` y `MercadoLibreOAuthResult.tsx` muestran logos hardcodeados de las plataformas. El usuario quiere que muestren el logo del tenant (la empresa logistica).

**Solucion**: Las edge functions ya tienen acceso al `seller.tenant_id`. Pasar `tenant_id` como query param adicional en el redirect de exito. En las paginas OAuth result, usar ese `tenant_id` para hacer un fetch a `tenant_branding` y mostrar el logo del tenant junto al de la plataforma.

**Archivos**:
- `supabase/functions/tiendanube-oauth/index.ts`: modificar `redirectSuccess()` para incluir `tenant_id` en los params
- `supabase/functions/mercadolibre-oauth/index.ts`: idem
- `src/pages/TiendanubeOAuthResult.tsx`: agregar fetch de branding con el tenant_id, mostrar logo del tenant, mejorar diseño
- `src/pages/MercadoLibreOAuthResult.tsx`: idem

El diseño mejorado mostrara:
- Logo del tenant (empresa logistica) arriba
- Check animado
- Nombre de la empresa + plataforma conectada
- Card informativa con pasos siguientes
- Aspecto mas corporativo/profesional

---

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/landing/Hero.tsx` | WhatsApp correcto |
| `src/pages/Tracking.tsx` | Boton volver |
| `src/pages/Shipments.tsx` | Fix count con head:true |
| `supabase/functions/tiendanube-oauth/index.ts` | Pasar tenant_id en redirect |
| `supabase/functions/mercadolibre-oauth/index.ts` | Pasar tenant_id en redirect |
| `src/pages/TiendanubeOAuthResult.tsx` | Logo tenant + diseño profesional |
| `src/pages/MercadoLibreOAuthResult.tsx` | Logo tenant + diseño profesional |

### Seguridad
- El `tenant_id` en la URL del OAuth result es solo para mostrar branding (datos publicos de `tenant_branding`)
- No se modifican RLS policies ni logica de negocio
- Los counts usan `head: true` que es mas eficiente que traer todos los rows

