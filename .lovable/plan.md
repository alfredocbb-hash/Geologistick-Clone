

# Plan: Portal de Sellers e-Commerce

## Resumen

Crear una interfaz dedicada para que los usuarios con rol `seller` puedan gestionar su relación con la empresa logística de forma autónoma, sin acceso al panel administrativo completo.

## Arquitectura del Portal

```text
Usuario con rol 'seller'
         |
         v
    /seller/* (rutas dedicadas)
         |
    +----+----+----+----+
    |    |    |    |    |
  Home  Pedidos  Envios  Cuenta
         |
    +----+----+
    |         |
Historial  Solicitar
           Retiro
```

---

## Fase A: Crear Estructura Base del Portal

### 1. Layout Dedicado para Sellers
Crear `src/components/seller/SellerLayout.tsx`:
- Header simplificado con logo del tenant
- Navegacion lateral minimalista
- Solo 4 secciones: Inicio, Pedidos, Envios, Mi Cuenta
- Sin acceso a rutas administrativas

### 2. Redireccionar Sellers al Portal
Modificar la logica de redireccion en `src/pages/Login.tsx`:
- Si el usuario tiene SOLO el rol `seller` -> redirigir a `/seller`
- Si tiene otros roles (admin, operador, etc.) -> comportamiento normal `/dashboard`

---

## Fase B: Paginas del Portal

### 1. Dashboard del Seller (`/seller`)
Archivo: `src/pages/seller/SellerDashboard.tsx`

Contenido:
- Tarjetas resumen:
  - Pedidos pendientes (del mes)
  - Envios en transito
  - Saldo cuenta corriente
  - Ultimo movimiento
- Grafico de envios por estado (pie chart)
- Lista rapida de ultimos 5 pedidos

### 2. Mis Pedidos (`/seller/orders`)
Archivo: `src/pages/seller/SellerOrders.tsx`

Contenido:
- Tabla de pedidos de su tienda (`ecommerce_orders`)
- Filtros por estado y fecha
- Detalle de cada pedido
- Estado de fulfillment vinculado

### 3. Mis Envios (`/seller/shipments`)
Archivo: `src/pages/seller/SellerShipments.tsx`

Contenido:
- Tabla de envios creados para el seller
- Tracking en tiempo real
- Historial de estados
- Opcion de ver comprobante de entrega (EPOD)

### 4. Mi Cuenta (`/seller/account`)
Archivo: `src/pages/seller/SellerAccount.tsx`

Contenido:
- Datos de la tienda (solo lectura)
- Estado de cuenta corriente
- Historial de movimientos (`seller_cuenta_corriente`)
- Boton "Solicitar Retiro" (abre dialog)

---

## Fase C: Componentes del Portal

### 1. SellerHeader
- Logo del tenant
- Nombre de la tienda
- Boton de cerrar sesion
- Indicador de saldo

### 2. SellerSidebar
- Navegacion simple con iconos:
  - Home
  - ShoppingBag (Pedidos)
  - Package (Envios)
  - Wallet (Mi Cuenta)

### 3. RequestWithdrawalDialog
- Monto a retirar (validado contra saldo disponible)
- Metodo de pago preferido
- Datos bancarios (si aplica)
- Registra movimiento en `seller_cuenta_corriente` con tipo "solicitud_retiro"

---

## Fase D: Seguridad y Permisos

### 1. Vinculacion Seller-Usuario
Modificar `CreateSellerDialog.tsx` para:
- Agregar campo opcional `user_id` (selector de usuarios o input de email)
- Crear usuario con rol `seller` automaticamente (via edge function)

### 2. RLS para Portal Seller
Los RLS existentes ya permiten que sellers vean sus propios datos:

```sql
-- ecommerce_orders: seller puede ver sus pedidos
(EXISTS ( SELECT 1
   FROM ecommerce_sellers es
  WHERE ((es.id = ecommerce_orders.seller_id) AND (es.user_id = auth.uid()))))

-- ecommerce_sellers: seller puede ver su propia tienda
(user_id = auth.uid())
```

### 3. Nueva politica para seller_cuenta_corriente

```sql
CREATE POLICY "Seller ve sus movimientos" ON seller_cuenta_corriente
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM ecommerce_sellers es
    WHERE es.id = seller_cuenta_corriente.seller_id
    AND es.user_id = auth.uid()
  )
);
```

---

## Fase E: Rutas y Navegacion

### 1. Registrar Rutas en App.tsx

```typescript
// Imports
import SellerLayout from './components/seller/SellerLayout';
import SellerDashboard from './pages/seller/SellerDashboard';
import SellerOrders from './pages/seller/SellerOrders';
import SellerShipments from './pages/seller/SellerShipments';
import SellerAccount from './pages/seller/SellerAccount';

// Rutas del portal seller
<Route path="/seller" element={<SellerLayout />}>
  <Route index element={<SellerDashboard />} />
  <Route path="orders" element={<SellerOrders />} />
  <Route path="shipments" element={<SellerShipments />} />
  <Route path="account" element={<SellerAccount />} />
</Route>
```

### 2. Proteger Rutas
Crear `SellerRoute` wrapper que:
- Verifica que el usuario tenga rol `seller`
- Verifica que tenga un `ecommerce_seller` vinculado
- Redirige a login si no esta autenticado

---

## Archivos a Crear

| Archivo | Descripcion |
|---------|-------------|
| `src/components/seller/SellerLayout.tsx` | Layout principal del portal |
| `src/components/seller/SellerHeader.tsx` | Header con logo y saldo |
| `src/components/seller/SellerSidebar.tsx` | Navegacion lateral |
| `src/components/seller/RequestWithdrawalDialog.tsx` | Solicitud de retiro |
| `src/pages/seller/SellerDashboard.tsx` | Dashboard con metricas |
| `src/pages/seller/SellerOrders.tsx` | Lista de pedidos |
| `src/pages/seller/SellerShipments.tsx` | Lista de envios |
| `src/pages/seller/SellerAccount.tsx` | Estado de cuenta |
| `src/hooks/useSellerData.ts` | Hook para datos del seller actual |

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Agregar rutas /seller/* |
| `src/pages/Login.tsx` | Redirigir sellers a /seller |
| `src/components/ecommerce/CreateSellerDialog.tsx` | Agregar campo user_id |
| Migracion SQL | RLS para seller_cuenta_corriente |

---

## Flujo de Usuario

```text
1. Admin crea seller en /ecommerce/sellers
   -> Opcionalmente vincula user_id existente
   -> O crea nuevo usuario con rol 'seller'

2. Seller inicia sesion con su email
   -> Sistema detecta rol 'seller'
   -> Redirige a /seller (no /dashboard)

3. En el portal seller:
   -> Ve dashboard con metricas de su tienda
   -> Consulta pedidos importados
   -> Rastrea envios en transito
   -> Revisa estado de cuenta
   -> Solicita retiro de fondos
```

---

## Orden de Implementacion

1. **Migracion SQL** - RLS para seller_cuenta_corriente
2. **Hook useSellerData** - Obtener seller vinculado al usuario
3. **Layout y Componentes** - SellerLayout, Header, Sidebar
4. **Paginas** - Dashboard, Orders, Shipments, Account
5. **App.tsx** - Registrar rutas
6. **Login.tsx** - Logica de redireccion por rol
7. **CreateSellerDialog** - Campo para vincular usuario

---

## Detalles Tecnicos

- El rol `seller` ya existe en el enum `app_role`
- La tabla `ecommerce_sellers` ya tiene columna `user_id`
- Los RLS existentes ya soportan acceso por `user_id = auth.uid()`
- El hook `useAuth()` ya provee `hasRole('seller')`
- Usaremos el mismo sistema de branding del tenant

