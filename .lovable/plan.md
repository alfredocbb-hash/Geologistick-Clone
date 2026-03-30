

## Plan: Panel de Actividad de Usuarios y Logs de Errores para Super Admin

### Objetivo
Crear una nueva página exclusiva para super_admin que muestre:
1. Usuarios conectados / actividad reciente de sesiones
2. Logs de errores del sistema con detalle

### Nuevas tablas (2 migraciones)

**Tabla `user_activity_logs`** — registra cada login/logout y actividad
```sql
CREATE TABLE public.user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  action TEXT NOT NULL, -- 'login', 'logout', 'session_refresh'
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can view all activity logs"
  ON public.user_activity_logs FOR SELECT TO authenticated
  USING (public.current_user_is_super_admin());
CREATE POLICY "Users can insert own activity"
  ON public.user_activity_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

**Tabla `system_error_logs`** — captura errores del frontend
```sql
CREATE TABLE public.system_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  error_message TEXT NOT NULL,
  error_stack TEXT,
  component TEXT,
  url TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can view all error logs"
  ON public.system_error_logs FOR SELECT TO authenticated
  USING (public.current_user_is_super_admin());
CREATE POLICY "Authenticated users can insert error logs"
  ON public.system_error_logs FOR INSERT TO authenticated
  WITH CHECK (true);
```

### Cambios en código

**1. `src/lib/auth.tsx`** — Registrar login en `user_activity_logs`
- Después de un `SIGNED_IN` exitoso, insertar un registro con action `'login'` y `navigator.userAgent`

**2. `src/lib/errorLogger.ts`** (nuevo) — Servicio de captura de errores
- Función `logError(error, component?, metadata?)` que inserta en `system_error_logs`
- Se usará desde el error boundary global y se puede llamar manualmente

**3. `src/App.tsx`** — Conectar el error boundary global
- En `GlobalErrorBoundary`, al capturar `unhandledrejection`, llamar a `logError()`
- Agregar listener de `window.onerror` para errores síncronos no capturados

**4. `src/pages/UserActivityAdmin.tsx`** (nuevo) — Página del panel
- Dos tabs: **Actividad de Usuarios** y **Logs de Errores**
- Tab Actividad:
  - Tabla con usuario, tenant, acción, fecha, user_agent
  - Filtros por tenant, rango de fechas, búsqueda por nombre/email
  - Indicador de "usuarios activos hoy"
- Tab Errores:
  - Tabla con usuario, error, componente, URL, fecha
  - Expandir fila para ver stack trace completo y metadata
  - Filtros por tenant, rango de fechas, búsqueda por mensaje
  - Stats: errores hoy, errores esta semana

**5. `src/App.tsx`** — Agregar ruta `/admin/activity`

**6. `src/components/layout/AppSidebar.tsx`** — Agregar item en sección Super Admin
- Título: "Actividad y Logs", icono: `Activity`, url: `/admin/activity`

### Archivos a crear/modificar
- Crear: `src/pages/UserActivityAdmin.tsx`, `src/lib/errorLogger.ts`
- Modificar: `src/lib/auth.tsx`, `src/App.tsx`, `src/components/layout/AppSidebar.tsx`
- Migraciones: 2 tablas nuevas con RLS

