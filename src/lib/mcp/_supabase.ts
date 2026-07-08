import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

export function supabaseForUser(ctx: ToolContext) {
  const g = globalThis as any;
  const url = (g.Deno?.env?.get?.("SUPABASE_URL") ?? g.process?.env?.SUPABASE_URL) as string;
  const key = (g.Deno?.env?.get?.("SUPABASE_PUBLISHABLE_KEY") ?? g.process?.env?.SUPABASE_PUBLISHABLE_KEY) as string;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
