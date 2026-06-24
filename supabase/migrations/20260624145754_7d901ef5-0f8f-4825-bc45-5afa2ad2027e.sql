
DROP TABLE IF EXISTS public.notificaciones CASCADE;
DROP TABLE IF EXISTS public.perfiles CASCADE;
DROP TABLE IF EXISTS public.conductores CASCADE;
DROP TABLE IF EXISTS public.configuracion_sistema CASCADE;
DROP TABLE IF EXISTS public.costos_envio CASCADE;
DROP TABLE IF EXISTS public.estados_envio CASCADE;
DROP TABLE IF EXISTS public.historial_envio CASCADE;
DROP TABLE IF EXISTS public.reportes CASCADE;
DROP TABLE IF EXISTS public.turnos CASCADE;
DROP TABLE IF EXISTS public.zonas CASCADE;

DROP FUNCTION IF EXISTS public.check_trial_request_rate_limit();

ALTER FUNCTION public.normalizar_telefono_ar(text) SET search_path = public;

-- subscription_plans: column-level restrictions hiding stripe ids from client roles
REVOKE SELECT ON public.subscription_plans FROM anon, authenticated;
GRANT SELECT (id, name, description, max_users, max_branches, max_shipments_month,
              price_monthly, features, is_active, visible_in_landing, display_order,
              created_at, updated_at)
  ON public.subscription_plans TO anon, authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

-- ecommerce_sellers: hide access_token, refresh_token, webhook_secret from client roles
REVOKE SELECT ON public.ecommerce_sellers FROM anon, authenticated;
GRANT SELECT (
  id, tenant_id, nombre, razon_social, cuit, email, telefono, direccion,
  ciudad, provincia, codigo_postal, plataforma, store_id, store_url,
  token_expires_at, sucursal_pickup_id, tarifa_id, dias_retiro, horario_retiro,
  tiene_cuenta_corriente, limite_credito, saldo_cuenta_corriente, activo,
  ultimo_sync, user_id, created_at, updated_at, created_by,
  shipping_carrier_id, min_delivery_days, max_delivery_days, tarifa_express_id,
  express_delivery_days, express_surcharge, permite_pickup, pickup_surcharge,
  cliente_id, es_cuenta_logistica
) ON public.ecommerce_sellers TO authenticated;
GRANT ALL ON public.ecommerce_sellers TO service_role;
