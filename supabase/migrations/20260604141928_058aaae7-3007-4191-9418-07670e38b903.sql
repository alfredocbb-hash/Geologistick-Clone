
CREATE OR REPLACE FUNCTION public.normalizar_telefono_ar(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
BEGIN
  IF p_phone IS NULL THEN RETURN NULL; END IF;
  v := regexp_replace(p_phone, '\D', '', 'g');
  IF v = '' THEN RETURN NULL; END IF;
  v := regexp_replace(v, '^0+', '');
  IF v = '' THEN RETURN NULL; END IF;
  IF left(v, 2) <> '54' THEN
    v := '54' || v;
  END IF;
  v := '54' || regexp_replace(substr(v, 3), '^0+', '');
  v := regexp_replace(v, '^54(\d{2,4})15(\d{6,8})$', '54\1\2');
  RETURN v;
END;
$$;

DO $$
DECLARE
  r RECORD;
  canonical_id uuid;
  dup_ids uuid[];
  v_apellido text;
  v_email text;
  v_dni text;
  v_cp text;
  v_ciudad text;
  v_direccion text;
  v_can RECORD;
BEGIN
  FOR r IN
    SELECT tenant_id,
           array_agg(id ORDER BY (CASE WHEN COALESCE(tiene_cuenta_corriente, false) THEN 0 ELSE 1 END), created_at) AS ids
    FROM public.clientes
    WHERE telefono IS NOT NULL AND telefono <> ''
      AND public.normalizar_telefono_ar(telefono) IS NOT NULL
      AND tenant_id IS NOT NULL
    GROUP BY tenant_id, public.normalizar_telefono_ar(telefono)
    HAVING count(*) > 1
  LOOP
    canonical_id := r.ids[1];
    dup_ids := r.ids[2:array_length(r.ids,1)];

    UPDATE public.envios SET remitente_id = canonical_id WHERE remitente_id = ANY(dup_ids);
    UPDATE public.envios SET destinatario_id = canonical_id WHERE destinatario_id = ANY(dup_ids);
    UPDATE public.cliente_cuenta_corriente SET cliente_id = canonical_id WHERE cliente_id = ANY(dup_ids);
    UPDATE public.ecommerce_sellers SET cliente_id = canonical_id WHERE cliente_id = ANY(dup_ids);
    UPDATE public.liquidaciones_cliente SET cliente_id = canonical_id WHERE cliente_id = ANY(dup_ids);
    UPDATE public.pagos SET cliente_id = canonical_id WHERE cliente_id = ANY(dup_ids);
    UPDATE public.ruta_frecuente_paradas SET cliente_id = canonical_id WHERE cliente_id = ANY(dup_ids);

    SELECT * INTO v_can FROM public.clientes WHERE id = canonical_id;

    SELECT apellido INTO v_apellido FROM public.clientes WHERE id = ANY(dup_ids) AND apellido IS NOT NULL AND apellido <> '' LIMIT 1;
    SELECT email INTO v_email FROM public.clientes WHERE id = ANY(dup_ids) AND email IS NOT NULL AND email <> '' LIMIT 1;
    SELECT dni_cuit INTO v_dni FROM public.clientes WHERE id = ANY(dup_ids) AND dni_cuit IS NOT NULL AND dni_cuit <> '' LIMIT 1;
    SELECT codigo_postal INTO v_cp FROM public.clientes WHERE id = ANY(dup_ids) AND codigo_postal IS NOT NULL AND codigo_postal <> '' LIMIT 1;
    SELECT ciudad INTO v_ciudad FROM public.clientes WHERE id = ANY(dup_ids) AND ciudad IS NOT NULL AND ciudad <> '' LIMIT 1;
    SELECT direccion INTO v_direccion FROM public.clientes WHERE id = ANY(dup_ids) AND direccion IS NOT NULL AND direccion <> '' ORDER BY length(direccion) DESC LIMIT 1;

    UPDATE public.clientes SET
      apellido = COALESCE(NULLIF(apellido, ''), v_apellido),
      email = COALESCE(NULLIF(email, ''), v_email),
      codigo_postal = COALESCE(NULLIF(codigo_postal, ''), v_cp),
      ciudad = COALESCE(NULLIF(ciudad, ''), v_ciudad),
      direccion = CASE WHEN length(COALESCE(direccion, '')) >= 10 THEN direccion ELSE COALESCE(v_direccion, direccion) END,
      updated_at = now()
    WHERE id = canonical_id;

    IF (v_can.dni_cuit IS NULL OR v_can.dni_cuit = '') AND v_dni IS NOT NULL THEN
      BEGIN
        UPDATE public.clientes SET dni_cuit = v_dni, updated_at = now() WHERE id = canonical_id;
      EXCEPTION WHEN unique_violation THEN
        NULL;
      END;
    END IF;

    DELETE FROM public.clientes WHERE id = ANY(dup_ids);
  END LOOP;
END $$;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS telefono_normalizado text
  GENERATED ALWAYS AS (public.normalizar_telefono_ar(telefono)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_tenant_telefono_uniq
  ON public.clientes (tenant_id, telefono_normalizado)
  WHERE telefono_normalizado IS NOT NULL;
