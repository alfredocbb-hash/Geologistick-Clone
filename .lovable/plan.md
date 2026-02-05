

## Diagnóstico (por qué “ahora no aparecen”)

En la landing, el componente `src/components/landing/Clients.tsx` está consultando así:

- `tenants` (filtra `activo = true`)
- con un join a `tenant_branding(logo_light, logo_dark)`
- luego filtra los que tengan algún logo.

El problema es que **para visitantes anónimos la tabla `tenants` no es visible por RLS**, entonces la request pública devuelve:

- `GET /rest/v1/tenants?...&activo=eq.true` → `200` pero **`[]` (vacío)**

Si `tenants` devuelve vacío, el componente hace `return null` y **desaparece toda la sección**.

Importante: la política que se agregó para `tenant_branding` (“Acceso público a logos…”) no arregla esto porque el query empieza en `tenants`.  
Además, esa política pública en `tenant_branding` **no es ideal de seguridad**, porque al permitir `SELECT` sobre la tabla, un visitante podría leer **todas las columnas** del branding (no solo logos).

---

## Enfoque propuesto (seguro y estable)

En vez de hacer pública la tabla `tenants` (que expondría columnas que no queremos), vamos a:

1) **Crear una función de base de datos “pública” (RPC) SECURITY DEFINER** que devuelva únicamente los campos necesarios para la landing:
   - `id`, `nombre`, `slug`, `logo_light`, `logo_dark`
   - solo para tenants `activo=true`
   - solo donde haya logo configurado

2) **Dar permiso de ejecución** de esa función a usuarios anónimos y autenticados.

3) **Actualizar `Clients.tsx`** para llamar a `supabase.rpc('get_public_client_logos')` en lugar de consultar `tenants` directamente.

4) **(Recomendado) Remover la política pública** recién creada en `tenant_branding`, para evitar exponer accidentalmente campos extra.

Con esto:
- la landing vuelve a mostrar los logos (aunque el visitante sea anónimo),
- no se hace pública la tabla `tenants`,
- no se expone el resto del branding por accidente.

---

## Cambios en Backend (migración SQL)

### A) Crear RPC segura para la landing

Crear función (ejemplo de forma; lo implementaré como migración):

```sql
create or replace function public.get_public_client_logos()
returns table (
  id uuid,
  nombre text,
  slug text,
  logo_light text,
  logo_dark text
)
language sql
security definer
set search_path = public
as $$
  select
    t.id,
    t.nombre,
    t.slug,
    tb.logo_light,
    tb.logo_dark
  from public.tenants t
  join public.tenant_branding tb on tb.tenant_id = t.id
  where
    t.activo = true
    and (tb.logo_light is not null or tb.logo_dark is not null)
  order by t.nombre;
$$;

grant execute on function public.get_public_client_logos() to anon, authenticated;
```

### B) Cerrar el agujero de seguridad (recomendado)

Eliminar la policy pública que habilita `SELECT` directo en `tenant_branding`:

```sql
drop policy if exists "Acceso público a logos para landing" on public.tenant_branding;
```

Esto fuerza a que la landing solo pueda acceder a logos vía la función (que devuelve solo lo necesario).

---

## Cambios en Frontend

### 1) `src/components/landing/Clients.tsx`

- Reemplazar el `.from('tenants').select(...).eq('activo', true)` por:

```ts
const { data, error } = await supabase.rpc('get_public_client_logos');
```

- Ajustar el type/interface local para coincidir con el retorno de la RPC:
  - `id`, `nombre`, `slug`, `logo_light`, `logo_dark` (ya “aplanados”, sin `tenant_branding` anidado).

- Mantener:
  - el `getLogoSrc` por tema claro/oscuro
  - el duplicado 4x + animación marquee
  - el tamaño y centrado que ya mejoramos

- Agregar manejo explícito de error (para debug):
  - si `error`, loguear en consola y devolver `null` (o un fallback).

### 2) (Opcional, pero coherente) `src/components/landing/CTASection.tsx`

Hoy `CTASection` intenta contar `tenants` activos con un query directo a `tenants`, que para anónimos también puede dar incorrecto.  
Podemos crear otra RPC simple:

- `get_public_active_tenant_count()` y usarla para el contador del badge.

Esto es opcional porque no bloquea logos, pero evita inconsistencias públicas.

---

## Pruebas / Verificación (checklist)

1) Probar landing en ventana incógnito (sin sesión):
   - La sección “Empresas que confían en nosotros” debe mostrarse.
   - Deben aparecer los 3 logos (Beraexpress, BlackBox Cargas, PlataBus Cargas).
2) Probar con tema claro y oscuro:
   - En claro usa `logo_light` si existe; en oscuro usa `logo_dark` si existe.
3) Verificar en Network:
   - request a `/rest/v1/rpc/get_public_client_logos` devuelve array con filas.
4) Confirmar que ya no se puede leer `tenant_branding` completo como anónimo (si quitamos la policy pública).

---

## Impacto y trade-offs

- Ventaja: no publicamos tablas completas, solo una “salida controlada” para la landing.
- Ventaja: no dependemos de policies complejas cruzando tablas.
- Consideración: la función es `SECURITY DEFINER` (lo correcto para este caso), por eso debe ser muy estricta en lo que devuelve (solo logos + nombre/slug).

