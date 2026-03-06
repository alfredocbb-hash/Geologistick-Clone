
-- Update both versions of generate_tracking_number() to shorter format ENV-XXXXXX

-- Version without parameters
CREATE OR REPLACE FUNCTION public.generate_tracking_number()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_tracking TEXT;
  exists_already BOOLEAN;
  i INTEGER;
  result TEXT;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    new_tracking := 'ENV-' || result;
    SELECT EXISTS(SELECT 1 FROM public.envios WHERE tracking_number = new_tracking) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_tracking;
END;
$function$;

-- Version with sucursal_id parameter (same short format, ignores sucursal code now)
CREATE OR REPLACE FUNCTION public.generate_tracking_number(p_sucursal_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_tracking TEXT;
  exists_already BOOLEAN;
  i INTEGER;
  result TEXT;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    new_tracking := 'ENV-' || result;
    SELECT EXISTS(SELECT 1 FROM public.envios WHERE tracking_number = new_tracking) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_tracking;
END;
$function$;
