
## Objetivo
Que los envíos en estado **“incidencia”** aparezcan en **Bandeja de Incidencias** para poder asignarles una acción.

## Hallazgo (causa raíz)
El módulo **Incidencias** no está mostrando nada porque la consulta está fallando con **HTTP 400** (no es que no existan datos).

En los requests de la app aparece este error:

- `PGRST200 ... Could not find a relationship between 'incidentes' and 'profiles' ... hint 'incidentes_chofer_id_fkey'`

Esto ocurre porque el frontend pide un join así:
- `chofer:profiles!incidentes_chofer_id_fkey(nombre, apellido)`

pero en la base **no existe** el foreign key `incidentes_chofer_id_fkey` entre `incidentes.chofer_id` y `profiles` (hoy `incidentes` solo tiene FK a `envios`, `tenants` y `auth.users` para `resuelto_por`).

Resultado: la query falla, React Query no muestra error en UI, y termina pareciendo “no hay incidencias”.

## Verificación de datos (ya en backend)
Existe el envío y existe su incidencia pendiente:
- `envios.estado = 'incidencia'`
- `incidentes.estado = 'pendiente'`
- `tenant_id` coincide

O sea: los datos están, el problema es el join roto.

---

## Cambios propuestos

### 1) Backend (migración): agregar FK faltante para habilitar el join
Crear el foreign key exactamente con el nombre que usa el frontend, apuntando a `profiles.user_id` (que es UNIQUE):

1. Verificación previa (solo para seguridad):
   - Confirmar que no haya incidentes con `chofer_id` sin profile (ya validé y da 0, pero lo re-chequeamos antes de aplicar en el entorno que corresponda).

2. Migración SQL:
   - `ALTER TABLE public.incidentes ADD CONSTRAINT incidentes_chofer_id_fkey FOREIGN KEY (chofer_id) REFERENCES public.profiles(user_id);`
   - (Opcional recomendado) índice:
     - `CREATE INDEX IF NOT EXISTS incidentes_chofer_id_idx ON public.incidentes(chofer_id);`

Con esto PostgREST puede “entender” la relación y el select con `profiles!incidentes_chofer_id_fkey` deja de fallar.

Notas:
- Mantengo `chofer_id` como NOT NULL (así está hoy). Si en el futuro quieren permitir incidentes “sin chofer”, ahí sí conviene hacerlo nullable + `ON DELETE SET NULL`, pero eso sería un cambio funcional más grande.

### 2) Frontend (Incidents.tsx): mostrar errores de consulta (en vez de “no hay incidencias”)
Mejora necesaria para que si algo vuelve a fallar, el usuario lo vea claramente.

Cambios en `src/pages/Incidents.tsx`:
- Leer `error` desde `useQuery`.
- Renderizar un estado “Error cargando incidencias” con:
  - Mensaje breve
  - Botón “Reintentar” (llama `refetch()`)
  - (Opcional) detalle técnico colapsable en modo dev

### 3) Frontend (Incidents.tsx): refresco más confiable
Para evitar confusiones por caché:
- En esa query setear opciones más “operativas”, por ejemplo:
  - `staleTime: 0`
  - `refetchOnMount: 'always'`
  - `refetchOnWindowFocus: true`
Esto no rompe nada y hace que “Incidencias” siempre esté fresco aunque el resto del sistema tenga caché más largo.

---

## Pasos de prueba (end-to-end)
1. Iniciar sesión con el usuario admin del tenant.
2. Ir a **/incidents**:
   - Confirmar que el request a `/rest/v1/incidentes?...chofer:profiles!...` ya no devuelve 400.
   - Confirmar que la incidencia pendiente aparece listada.
3. Abrir la incidencia y ejecutar una acción (re_intento / reprogramar / devolver / cancelar):
   - Verificar que:
     - `incidentes.estado` pase a `resuelto`
     - `envios.estado` cambie según la acción
     - Se inserte registro en `envio_historial`
4. Volver a **/shipments** y confirmar que el envío ya no queda “trabado” en incidencia.

---

## Archivos / componentes involucrados
- Backend (migración SQL):
  - Agregar FK `incidentes_chofer_id_fkey` → `profiles(user_id)`
  - (Opcional) index `incidentes_chofer_id_idx`
- Frontend:
  - `src/pages/Incidents.tsx` (manejo de error + opciones de refetch)

---

## Resultado esperado
- La Bandeja de Incidencias vuelve a funcionar: lista las incidencias pendientes y permite “Resolver”.
- Si hay un problema futuro de consulta/RLS/relaciones, el módulo mostrará **error explícito** en lugar de “0 incidencias”.
