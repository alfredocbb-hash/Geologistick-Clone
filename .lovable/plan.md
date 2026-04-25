## Objetivo
Crear una empresa de prueba (tenant) **"Empresa Demo"** completa con usuarios de distintos roles, clientes, envíos en varios estados, una hoja de ruta y una ruta planificada para usar como entorno de capacitación y demostraciones.

## Qué se va a crear

### 1. Tenant
- **Nombre:** Empresa Demo
- **Slug:** `empresa-demo`
- **Plan:** trial (sin vencimiento práctico — 365 días)
- Branding por defecto

### 2. Sucursal única
- **Sucursal Central** (centro logístico, puede despachar/recibir/entregar/retirar)
- Dirección de Buenos Aires con coordenadas reales

### 3. Usuarios (todos con password **`Demo1234!`**)
| Email | Rol | Nombre |
|---|---|---|
| `admin@demo.com` | admin | Ana Administradora |
| `chofer1@demo.com` | chofer | Carlos Chofer |
| `chofer2@demo.com` | chofer | Carla Chofer |
| `operador@demo.com` | operator | Oscar Operador |
| `seller@demo.com` | seller | Sofía Seller |

Todos vinculados al tenant y a la Sucursal Central (excepto seller).

### 4. Datos operativos (volumen mediano)
- **30 clientes** con direcciones reales en CABA y GBA, teléfonos AR, algunos con cuenta corriente.
- **1 vehículo** asignado a cada chofer (2 vehículos en total).
- **1 tarifa** básica activa con conceptos típicos (flete, seguro).
- **1 seller e-commerce** vinculado al usuario seller.
- **~100 envíos** distribuidos en estados realistas:
  - 15 `pendiente` (recién creados)
  - 10 `recogido`
  - 10 `en_transito`
  - 15 `en_sucursal`
  - 15 `en_reparto` (asignados a chofer1)
  - 25 `entregado` (con fecha_entrega)
  - 5 `incidencia`
  - 5 `devuelto`
- Mix de pago contado / contra-entrega, varias ciudades destino.
- **1 Hoja de Ruta** activa con 8 envíos asignada a chofer2.
- **1 Ruta Planificada** en curso con 6 paradas asignada a chofer1.
- **Pagos COD** registrados para los entregados con contra-entrega.
- Historial básico generado por triggers existentes.

## Cómo se va a implementar

Un único script Node/TS (`scripts/seed-demo-tenant.ts`) ejecutado vía `bun` que usa la **service role key** para:

1. Crear tenant + branding + sucursal vía SQL directo (`psql`/insert tool no alcanza por límites de update).
2. Crear los 5 usuarios via `supabase.auth.admin.createUser` con `email_confirm: true` y `tenant_id` en metadata para que el trigger `handle_new_user` los asocie al tenant existente.
3. Asignar roles correctos en `user_roles`.
4. Insertar clientes, vehículos, tarifa, seller, envíos, pagos, hoja de ruta y ruta planificada.
5. Imprimir al final un resumen con credenciales y IDs.

Como la creación de usuarios requiere la service role key (no disponible en el sandbox normal), se va a usar una **edge function temporal `seed-demo-tenant`** invocada una sola vez desde el frontend por un super_admin, similar al patrón de `create-tenant-with-admin`.

### Detalles técnicos
- La edge function valida que quien la invoca sea `super_admin`.
- Es **idempotente**: si ya existe el tenant `empresa-demo`, lo borra primero (CASCADE) y lo recrea — para poder re-ejecutar y resetear los datos demo.
- Tracking numbers se generan con la función `generate_tracking_number()` existente.
- `created_at` de los envíos se distribuye en los últimos 30 días para que se vea en reportes.
- Coordenadas reales para que el mapa en vivo y planificador funcionen sin geocodificar.
- Botón **"Crear/Resetear Empresa Demo"** agregado en `src/pages/Tenants.tsx` (solo visible a super_admin) que invoca la función.

## Entregable
- Edge function `supabase/functions/seed-demo-tenant/index.ts`
- Botón en la página de Empresas (super admin) con confirmación
- Toast con resumen de credenciales al terminar

## Credenciales finales
Todas las cuentas: password **`Demo1234!`**
- `admin@demo.com` — Administrador
- `operador@demo.com` — Operador de sucursal
- `chofer1@demo.com` / `chofer2@demo.com` — Choferes
- `seller@demo.com` — Vendedor e-commerce

## Verificación
1. Login como super_admin → ir a Empresas → click "Crear/Resetear Empresa Demo".
2. Esperar confirmación con resumen.
3. Logout y login como `admin@demo.com` / `Demo1234!`.
4. Verificar Dashboard con métricas, Envíos con ~100 registros mixtos, Hojas de Ruta con 1 activa, Rutas Planificadas con 1 en curso, Clientes con 30, Choferes con 2.
5. Login como `chofer1@demo.com` → ver su ruta planificada activa.
6. Login como `seller@demo.com` → ver portal de seller.

## Riesgo
Bajo. Toda la creación es aislada en un tenant nuevo. La función borra y recrea solo el tenant `empresa-demo` — no toca ningún otro dato.
