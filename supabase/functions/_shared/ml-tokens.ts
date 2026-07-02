// Shared helper for reading/refreshing Mercado Libre OAuth tokens.
// Tokens live in the protected table `ecommerce_seller_tokens` (service_role only).

export interface MLTokenRow {
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
}

export async function getSellerTokens(supabase: any, sellerId: string): Promise<MLTokenRow> {
  const { data } = await supabase
    .from('ecommerce_seller_tokens')
    .select('access_token, refresh_token, token_expires_at')
    .eq('seller_id', sellerId)
    .maybeSingle();
  return {
    access_token: data?.access_token ?? null,
    refresh_token: data?.refresh_token ?? null,
    token_expires_at: data?.token_expires_at ?? null,
  };
}

export async function saveSellerTokens(
  supabase: any,
  sellerId: string,
  tenantId: string,
  tokens: { access_token: string; refresh_token: string; expires_in: number },
): Promise<string> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabase
    .from('ecommerce_seller_tokens')
    .upsert({
      seller_id: sellerId,
      tenant_id: tenantId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'seller_id' });

  await supabase
    .from('ecommerce_sellers')
    .update({ has_valid_token: true, updated_at: new Date().toISOString() })
    .eq('id', sellerId);

  return expiresAt;
}

/**
 * Returns a valid access token for the seller, refreshing it via ML OAuth if needed.
 * Reads client_id/client_secret from `system_integrations` (key-value schema).
 */
export async function getValidMLAccessToken(
  supabase: any,
  seller: { id: string; tenant_id: string },
): Promise<string | null> {
  const tokens = await getSellerTokens(supabase, seller.id);
  const now = new Date();
  const expiresAt = tokens.token_expires_at ? new Date(tokens.token_expires_at) : null;

  // Valid for at least 5 more minutes
  if (tokens.access_token && expiresAt && expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    console.error('[ML Tokens] No refresh token available for seller', seller.id);
    return null;
  }

  // Load ML client credentials
  const { data: credentials, error: credError } = await supabase
    .from('system_integrations')
    .select('config_key, config_value')
    .eq('tenant_id', seller.tenant_id)
    .eq('integration_type', 'mercadolibre')
    .in('config_key', ['client_id', 'client_secret']);

  if (credError || !credentials?.length) {
    console.error('[ML Tokens] Missing ML credentials:', credError);
    return null;
  }

  const config: Record<string, string> = {};
  for (const row of credentials) config[row.config_key] = row.config_value;

  if (!config.client_id || !config.client_secret) {
    console.error('[ML Tokens] client_id/client_secret not set');
    return null;
  }

  const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: tokens.refresh_token,
    }),
  });

  if (!tokenResponse.ok) {
    const errBody = await tokenResponse.text();
    console.error('[ML Tokens] Refresh failed:', tokenResponse.status, errBody);

    // Concurrent-refresh race handling — ML refresh tokens are single-use.
    await new Promise((r) => setTimeout(r, 500));
    const fresh = await getSellerTokens(supabase, seller.id);
    const freshExp = fresh.token_expires_at ? new Date(fresh.token_expires_at) : null;
    if (fresh.access_token && freshExp && freshExp.getTime() - Date.now() > 5 * 60 * 1000) {
      console.log('[ML Tokens] Recovered fresh token from concurrent refresh');
      return fresh.access_token;
    }

    if (fresh.refresh_token && fresh.refresh_token !== tokens.refresh_token) {
      console.log('[ML Tokens] Retrying refresh with updated refresh_token');
      const retry = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.client_id,
          client_secret: config.client_secret,
          refresh_token: fresh.refresh_token,
        }),
      });
      if (retry.ok) {
        const td = await retry.json();
        await saveSellerTokens(supabase, seller.id, seller.tenant_id, td);
        return td.access_token as string;
      }
      console.error('[ML Tokens] Retry refresh also failed:', retry.status, await retry.text());
    }
    return null;
  }

  const tokenData = await tokenResponse.json();
  await saveSellerTokens(supabase, seller.id, seller.tenant_id, tokenData);
  return tokenData.access_token as string;
}
