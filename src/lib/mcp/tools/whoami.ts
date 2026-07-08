import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../_supabase";

export default defineTool({
  name: "whoami",
  title: "Quién soy",
  description: "Devuelve el usuario autenticado (id, email, tenant y roles).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const [{ data: profile }, { data: roles }] = await Promise.all([
      sb.from("profiles").select("user_id,email,nombre,apellido,tenant_id,sucursal_id,activo").eq("user_id", userId!).maybeSingle(),
      sb.from("user_roles").select("role").eq("user_id", userId!),
    ]);
    const payload = {
      user_id: userId,
      email: ctx.getUserEmail(),
      profile,
      roles: (roles ?? []).map((r: any) => r.role),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
