## Objetivo

Evitar crear clientes duplicados al cargar un nuevo envío, validando tanto por DNI/CUIT como por nombre, en remitente y destinatario.

## Estado actual

`src/pages/NewShipment.tsx` ya tiene `checkExistingClient` que se dispara en el **blur del DNI**, pero solo busca si ya hay nombre cargado y exige coincidencia exacta de DNI+nombre. No hay validación si el usuario empieza tipeando el nombre sin DNI, ni alerta cuando el DNI ingresado pertenece a otro cliente con nombre distinto.

## Estrategia propuesta (mejor opción)

Validación en dos niveles, no bloqueante, con un diálogo de confirmación tipo "¿Es este cliente?":

### 1. Búsqueda por DNI/CUIT (identificador único)

- Disparador: `onBlur` del campo DNI, si tiene ≥7 dígitos.
- Query: `clientes` filtrando por `tenant_id` + `dni_cuit = valor`.
- Resultado:
  - **1 match** → mostrar diálogo "Encontramos un cliente con este DNI: *Juan Pérez, Av. Corrientes 123*. ¿Querés usar sus datos?" con acciones **Sí, usar** / **No, es otro**.
  - **0 matches** → seguir cargando normalmente.

### 2. Búsqueda por nombre (sin DNI todavía)

- Disparador: `onBlur` del campo Apellido (o Nombre si no hay apellido), con ≥3 caracteres.
- Query: `clientes` filtrando por `tenant_id` + `ilike nombre %valor%` y/o `ilike apellido %valor%`, con `limit 5`.
- Resultado:
  - **1-5 matches** → diálogo "Encontramos clientes con nombre similar" con lista (nombre, dirección, DNI, teléfono) y acciones por fila: **Usar este** / botón global **Ninguno, es nuevo**.
  - **0 matches** → seguir cargando.

### 3. Reglas comunes

- Solo se dispara si el cliente NO fue cargado manualmente desde el autocomplete (`clientLoadedManually[target]` ya existe).
- Se aplica idéntico a remitente y destinatario, parametrizado por `target`.
- Si el usuario elige "usar", se autocompletan todos los campos (nombre, apellido, teléfono, email, dirección, ciudad, CP, DNI) — ya está implementado en `applyClientMatch`.
- Si elige "es otro/nuevo", se marca un flag local para no volver a preguntar lo mismo en esta sesión del form.
- Al guardar el envío, el upsert de cliente sigue funcionando por DNI como hoy (no se duplica a nivel DB).

## Cambios técnicos

Archivo único: `src/pages/NewShipment.tsx`

1. Extender `checkExistingClient` para soportar dos modos: `'dni'` y `'nombre'`, devolviendo array de matches.
2. Cambiar `pendingClientMatch` de `{ client, target }` a `{ matches: Client[], target, reason: 'dni' | 'nombre' }`.
3. Reemplazar el diálogo actual (single-match) por uno con lista seleccionable cuando `matches.length > 1`.
4. Agregar `onBlur` en inputs de `*_apellido` (y fallback `*_nombre`) que llame al check por nombre.
5. Mantener el `onBlur` actual de DNI pero quitar la pre-condición de que ya exista nombre cargado (buscar por DNI solo).
6. Agregar `dismissedSuggestions` (Set por target) para no re-preguntar tras un "No".

## Notas

- Sin cambios de DB ni de backend.
- Sin cambios visuales fuera del diálogo de confirmación.
- Performance: queries puntuales con `limit 5` y trigger en blur (no en cada tecla).
