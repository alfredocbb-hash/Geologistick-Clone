import { supabase } from '@/integrations/supabase/client';

export const logError = async (
  error: Error | string,
  component?: string,
  metadata?: Record<string, any>
) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;

    // Get tenant_id from profile if logged in
    let tenantId: string | null = null;
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', userId)
        .maybeSingle();
      tenantId = profile?.tenant_id ?? null;
    }

    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;

    await supabase.from('system_error_logs').insert({
      user_id: userId,
      tenant_id: tenantId,
      error_message: errorMessage,
      error_stack: errorStack ?? null,
      component: component ?? null,
      url: window.location.href,
      user_agent: navigator.userAgent,
      metadata: metadata ?? {},
    });
  } catch (e) {
    // Silently fail - don't create infinite error loops
    console.error('[ErrorLogger] Failed to log error:', e);
  }
};
