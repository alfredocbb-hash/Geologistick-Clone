
-- =====================================================
-- FASE 1: Módulo e-Commerce para Clientes (Estilo Paqar)
-- =====================================================

-- 1. Agregar rol 'seller' al enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'seller';

-- 2. Agregar columnas a tabla tenants para módulo e-commerce
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS ecommerce_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ecommerce_config JSONB DEFAULT '{}';

-- 3. Crear tabla ecommerce_sellers (Tiendas online conectadas)
CREATE TABLE public.ecommerce_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  
  -- Datos del seller
  nombre TEXT NOT NULL,
  razon_social TEXT,
  cuit TEXT,
  email TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT,
  ciudad TEXT,
  provincia TEXT,
  codigo_postal TEXT,
  
  -- Configuración de plataforma
  plataforma TEXT NOT NULL DEFAULT 'manual', -- 'tiendanube', 'mercadolibre', 'shopify', 'woocommerce', 'manual'
  store_id TEXT,
  store_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Configuración operativa
  sucursal_pickup_id UUID REFERENCES sucursales(id),
  tarifa_id UUID REFERENCES tarifas(id),
  dias_retiro TEXT[],
  horario_retiro TEXT,
  
  -- Cuenta corriente
  tiene_cuenta_corriente BOOLEAN DEFAULT false,
  limite_credito NUMERIC DEFAULT 0,
  saldo_cuenta_corriente NUMERIC DEFAULT 0,
  
  -- Estado
  activo BOOLEAN DEFAULT true,
  webhook_secret TEXT,
  ultimo_sync TIMESTAMPTZ,
  
  -- Usuario vinculado (para portal seller)
  user_id UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 4. Crear tabla ecommerce_orders (Pedidos importados)
CREATE TABLE public.ecommerce_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES ecommerce_sellers(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID NOT NULL,
  
  -- Datos del pedido original
  external_order_id TEXT NOT NULL,
  external_order_number TEXT,
  plataforma TEXT NOT NULL,
  
  -- Estado del pedido e-commerce
  order_status TEXT DEFAULT 'pending',
  payment_status TEXT,
  fulfillment_status TEXT DEFAULT 'pending',
  
  -- Datos del comprador
  buyer_name TEXT NOT NULL,
  buyer_email TEXT,
  buyer_phone TEXT,
  buyer_dni TEXT,
  
  -- Dirección de entrega
  shipping_address TEXT NOT NULL,
  shipping_city TEXT,
  shipping_province TEXT,
  shipping_postal_code TEXT,
  shipping_lat NUMERIC,
  shipping_lng NUMERIC,
  shipping_notes TEXT,
  
  -- Productos (JSON)
  items JSONB DEFAULT '[]',
  
  -- Valores
  subtotal NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  
  -- Vinculación con sistema logístico
  envio_id UUID REFERENCES envios(id),
  
  -- Metadata
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(seller_id, external_order_id)
);

-- 5. Crear tabla seller_cuenta_corriente (Movimientos financieros)
CREATE TABLE public.seller_cuenta_corriente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES ecommerce_sellers(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL, -- 'cargo', 'pago', 'ajuste'
  monto NUMERIC NOT NULL,
  saldo_anterior NUMERIC DEFAULT 0,
  saldo_nuevo NUMERIC NOT NULL,
  descripcion TEXT,
  envio_id UUID REFERENCES envios(id),
  order_id UUID REFERENCES ecommerce_orders(id),
  referencia TEXT,
  metodo_pago TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Crear índices para mejor performance
CREATE INDEX idx_ecommerce_sellers_tenant ON ecommerce_sellers(tenant_id);
CREATE INDEX idx_ecommerce_sellers_plataforma ON ecommerce_sellers(plataforma);
CREATE INDEX idx_ecommerce_sellers_activo ON ecommerce_sellers(activo);
CREATE INDEX idx_ecommerce_sellers_user ON ecommerce_sellers(user_id);

CREATE INDEX idx_ecommerce_orders_seller ON ecommerce_orders(seller_id);
CREATE INDEX idx_ecommerce_orders_tenant ON ecommerce_orders(tenant_id);
CREATE INDEX idx_ecommerce_orders_status ON ecommerce_orders(order_status);
CREATE INDEX idx_ecommerce_orders_fulfillment ON ecommerce_orders(fulfillment_status);
CREATE INDEX idx_ecommerce_orders_external ON ecommerce_orders(external_order_id);
CREATE INDEX idx_ecommerce_orders_envio ON ecommerce_orders(envio_id);

CREATE INDEX idx_seller_cta_cte_seller ON seller_cuenta_corriente(seller_id);

-- 7. Habilitar RLS
ALTER TABLE ecommerce_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_cuenta_corriente ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies para ecommerce_sellers

-- Ver sellers de su tenant
CREATE POLICY "Ver sellers de su tenant"
ON ecommerce_sellers FOR SELECT
USING (
  (tenant_id = current_user_tenant() AND (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
  ))
  OR user_id = auth.uid() -- Seller puede ver su propia tienda
  OR is_super_admin(auth.uid())
);

-- Crear sellers
CREATE POLICY "Crear sellers en su tenant"
ON ecommerce_sellers FOR INSERT
WITH CHECK (
  tenant_id = current_user_tenant() 
  AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role))
);

-- Actualizar sellers
CREATE POLICY "Actualizar sellers de su tenant"
ON ecommerce_sellers FOR UPDATE
USING (
  (tenant_id = current_user_tenant() AND (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'supervisor'::app_role)
  ))
  OR is_super_admin(auth.uid())
);

-- Eliminar sellers
CREATE POLICY "Eliminar sellers de su tenant"
ON ecommerce_sellers FOR DELETE
USING (
  (tenant_id = current_user_tenant() AND is_admin(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- 9. RLS Policies para ecommerce_orders

-- Ver pedidos
CREATE POLICY "Ver pedidos de su tenant"
ON ecommerce_orders FOR SELECT
USING (
  (tenant_id = current_user_tenant() AND (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'despachador'::app_role)
  ))
  OR EXISTS ( -- Seller puede ver sus propios pedidos
    SELECT 1 FROM ecommerce_sellers es 
    WHERE es.id = ecommerce_orders.seller_id 
    AND es.user_id = auth.uid()
  )
  OR is_super_admin(auth.uid())
);

-- Crear pedidos (via webhook o sync)
CREATE POLICY "Crear pedidos en su tenant"
ON ecommerce_orders FOR INSERT
WITH CHECK (
  tenant_id = current_user_tenant()
  AND (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
  )
);

-- Actualizar pedidos
CREATE POLICY "Actualizar pedidos de su tenant"
ON ecommerce_orders FOR UPDATE
USING (
  (tenant_id = current_user_tenant() AND (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
  ))
  OR is_super_admin(auth.uid())
);

-- 10. RLS Policies para seller_cuenta_corriente

-- Ver cuenta corriente
CREATE POLICY "Ver cuenta corriente seller"
ON seller_cuenta_corriente FOR SELECT
USING (
  is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR EXISTS ( -- Seller puede ver su propia cuenta
    SELECT 1 FROM ecommerce_sellers es 
    WHERE es.id = seller_cuenta_corriente.seller_id 
    AND es.user_id = auth.uid()
  )
);

-- Crear movimientos
CREATE POLICY "Crear movimiento cuenta corriente seller"
ON seller_cuenta_corriente FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'operador'::app_role)
);

-- 11. Trigger para actualizar updated_at
CREATE TRIGGER update_ecommerce_sellers_updated_at
BEFORE UPDATE ON ecommerce_sellers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ecommerce_orders_updated_at
BEFORE UPDATE ON ecommerce_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 12. Función para actualizar saldo del seller
CREATE OR REPLACE FUNCTION update_seller_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ecommerce_sellers
  SET saldo_cuenta_corriente = NEW.saldo_nuevo,
      updated_at = now()
  WHERE id = NEW.seller_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_seller_balance
AFTER INSERT ON seller_cuenta_corriente
FOR EACH ROW
EXECUTE FUNCTION update_seller_balance();
