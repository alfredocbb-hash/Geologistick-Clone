## Problema

El cliente "ARDEBACO ABRAHAM" tiene 3 registros en la tabla `clientes` con el mismo teléfono (`+541150580780`) pero distintas variaciones de dirección:

- `AV 14 4724` / BERAZATEGUI
- `Avenida 14 4724` / Berazategui
- `Av. 14 3875, B1884 Berazategui...` / Berazategui

El autocomplete (`ContactAutocomplete`) y la función `findOrCreateClient` en `NewShipment.tsx` deduplican por **nombre + dirección exacta**. Como las direcciones llegan escritas distinto (mayúsculas, "Av.", "Avenida", con o sin código postal incluido por Google Places), nunca matchean y se crean nuevos registros. Además no se compara por teléfono normalizado, que es la señal más confiable (Argentina: +54, sin 0/15).

## Plan

### 1. Backend — Prevención de futuros duplicados

**a. Función `findOrCreateClient` (src/pages/NewShipment.tsx, líneas ~912‑1060):** agregar como paso previo a la búsqueda por nombre+dirección, una búsqueda por **teléfono normalizado** dentro del mismo tenant. Si se encuentra un cliente con el mismo teléfono normalizado, actualizar sus campos faltantes (dirección, email, dni, etc.) y devolver su id en lugar de crear uno nuevo.

Usar el normalizador AR ya existente en el proyecto (memoria `[Phone normalization]`): `+54`, quitar `0` de área y `15`, asegurar 9 dígitos.

**b. Mismo tratamiento en `src/pages/Clients.tsx` (línea 194)** al crear cliente manualmente: si el teléfono normalizado ya existe en el tenant, mostrar warning y ofrecer usar el cliente existente en vez de insertar.

**c. Índice único parcial (migración):** crear un índice único `(tenant_id, telefono_normalizado)` en `clientes` que actúe como red de seguridad a nivel DB. Como hoy hay duplicados, primero se ejecuta el merge (paso 2) y luego se crea el índice.

### 2. Limpieza de duplicados existentes

Migración SQL que, por cada `(tenant_id, telefono_normalizado)` con más de un registro:

- Elige como "canónico" el cliente más antiguo que tenga cuenta corriente activa (o saldo), o el más antiguo si ninguno la tiene.
- Reasigna FKs de los duplicados al canónico en: `envios.remitente_id`, `envios.destinatario_id`, `envios.cliente_id`, `cliente_cuenta_corriente.cliente_id`, `liquidaciones_cliente.cliente_id`, `facturas.cliente_id`, y cualquier otra tabla que referencie `clientes.id` (se valida con `information_schema`).
- Consolida en el canónico los campos no vacíos (dirección más completa, dni, email, razón social).
- Elimina los duplicados.

Para el caso puntual mostrado: dejar `266fb58f...` (el más antiguo y con cta cte activa) como canónico, migrar relaciones de los otros dos y borrarlos.

### 3. UI — Mejora del autocomplete (`ContactAutocomplete.tsx`)

- Cambiar la key de deduplicación visual de `nombre+apellido+direccion` a `telefono normalizado` (manteniendo nombre como tiebreak cuando no hay teléfono).
- Mostrar solo un resultado por teléfono, eligiendo el registro con cuenta corriente o el más completo.

### 4. QA

- Verificar en la base que después de la migración no quedan duplicados por teléfono normalizado dentro de un mismo tenant.
- Crear un envío nuevo con el cliente ARDEBACO escribiendo la dirección de tres maneras distintas y confirmar que siempre se reusa el mismo id.
- Confirmar que el autocomplete muestra una sola entrada por cliente.

## Detalles técnicos

- Se agrega columna generada `telefono_normalizado text` en `clientes` (o se usa función `public.normalizar_telefono_ar(text)` ya disponible si existe; si no, se crea) para poder indexar.
- Índice: `CREATE UNIQUE INDEX clientes_tenant_telefono_uniq ON public.clientes (tenant_id, telefono_normalizado) WHERE telefono_normalizado IS NOT NULL AND telefono_normalizado <> '';`
- El merge corre dentro de una transacción y loguea cuántos registros consolidó por tenant.
- No se toca lógica de e‑commerce sellers (tabla aparte).