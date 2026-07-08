import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

export function supabaseForUser(ctx: ToolContext) {
  const env = (globalThis as any).process?.env ?? {};
  const url = env.SUPABASE_URL as string;
  const key = env.SUPABASE_PUBLISHABLE_KEY as string;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
