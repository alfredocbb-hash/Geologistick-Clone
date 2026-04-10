

## Plan: Permitir lectura pública de planes en la landing

### Problema
La tabla `subscription_plans` tiene una política RLS que solo permite SELECT a usuarios `authenticated`. La landing page se carga sin autenticación (rol `anon`), por lo que la query devuelve `[]` y no se muestran los planes.

### Solución
Crear una migración que agregue una política RLS para el rol `anon` que permita leer solo los planes activos y visibles en la landing:

```sql
CREATE POLICY "Public can view landing plans"
ON public.subscription_plans
FOR SELECT
TO anon
USING (is_active = true AND visible_in_landing = true);
```

### Resultado
Los 3 planes (Básico $199, Profesional $499, Enterprise $699) aparecerán en la sección de precios de la landing sin necesidad de iniciar sesión.

