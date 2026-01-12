-- First drop the existing can_access_sucursal function to allow recreation with correct signature
DROP FUNCTION IF EXISTS public.can_access_sucursal(uuid, uuid);

-- Secure SECURITY DEFINER functions by restricting cross-user queries to admins only
-- This prevents authenticated users from enumerating other users' roles and branch assignments

-- 1. Secure is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _user_id = auth.uid() THEN EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'super_admin'
    )
    -- Only super_admins can check other users' super_admin status
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin') THEN EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'super_admin'
    )
    ELSE false
  END;
$$;

-- 2. Secure has_role function - users can only check their own roles, admins can check any user
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _user_id = auth.uid() THEN EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role
    )
    -- Admins and super_admins can check other users' roles
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')) THEN EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role
    )
    ELSE false
  END;
$$;

-- 3. Secure is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _user_id = auth.uid() THEN EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
    )
    -- Only admins can check other users' admin status
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')) THEN EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
    )
    ELSE false
  END;
$$;

-- 4. Secure get_user_sucursal function
CREATE OR REPLACE FUNCTION public.get_user_sucursal(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _user_id = auth.uid() THEN (
      SELECT sucursal_id FROM profiles WHERE user_id = _user_id
    )
    -- Only admins can get other users' branch assignments
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')) THEN (
      SELECT sucursal_id FROM profiles WHERE user_id = _user_id
    )
    ELSE NULL
  END;
$$;

-- 5. Secure can_access_sucursal function (recreated with correct signature)
CREATE FUNCTION public.can_access_sucursal(_sucursal_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _user_id = auth.uid() THEN (
      -- User can access their own branch or is admin
      EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND sucursal_id = _sucursal_id)
      OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role IN ('admin', 'super_admin'))
    )
    -- Only admins can check other users' branch access
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')) THEN (
      EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND sucursal_id = _sucursal_id)
      OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role IN ('admin', 'super_admin'))
    )
    ELSE false
  END;
$$;

-- 6. Create convenience functions for current user (no user_id parameter)
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_sucursal()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sucursal_id FROM profiles WHERE user_id = auth.uid();
$$;