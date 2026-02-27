
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' 
    AND policyname = 'Super admins can insert notifications'
  ) THEN
    CREATE POLICY "Super admins can insert notifications"
    ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (public.current_user_is_super_admin());
  END IF;
END $$;
