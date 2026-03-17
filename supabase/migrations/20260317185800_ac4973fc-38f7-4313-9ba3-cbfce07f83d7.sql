
-- DELETE policies for super_admin on envios and related tables

CREATE POLICY "Super admins can delete envios"
ON public.envios
FOR DELETE
TO authenticated
USING (public.current_user_is_super_admin());

CREATE POLICY "Super admins can delete envio_historial"
ON public.envio_historial
FOR DELETE
TO authenticated
USING (public.current_user_is_super_admin());

CREATE POLICY "Super admins can delete pagos"
ON public.pagos
FOR DELETE
TO authenticated
USING (public.current_user_is_super_admin());

CREATE POLICY "Super admins can delete movimientos_caja"
ON public.movimientos_caja
FOR DELETE
TO authenticated
USING (public.current_user_is_super_admin());

CREATE POLICY "Super admins can delete ruta_paradas"
ON public.ruta_paradas
FOR DELETE
TO authenticated
USING (public.current_user_is_super_admin());

CREATE POLICY "Super admins can delete hoja_ruta_envios"
ON public.hoja_ruta_envios
FOR DELETE
TO authenticated
USING (public.current_user_is_super_admin());

CREATE POLICY "Super admins can delete envio_detalles"
ON public.envio_detalles
FOR DELETE
TO authenticated
USING (public.current_user_is_super_admin());

CREATE POLICY "Super admins can delete comisiones by envio"
ON public.comisiones
FOR DELETE
TO authenticated
USING (public.current_user_is_super_admin());
