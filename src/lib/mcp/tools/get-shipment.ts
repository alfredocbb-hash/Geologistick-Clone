import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../_supabase";

export default defineTool({
  name: "get_shipment",
  title: "Detalle de envío",
  description: "Busca un envío por tracking (interno o externo) y devuelve su detalle completo.",
  inputSchema: {
    tracking: z.string().min(1).describe("tracking_number o tracking_externo."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tracking }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("envios")
      .select("*")
      .or(`tracking_number.eq.${tracking},tracking_externo.eq.${tracking}`)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "No se encontró el envío" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { shipment: data },
    };
  },
});
