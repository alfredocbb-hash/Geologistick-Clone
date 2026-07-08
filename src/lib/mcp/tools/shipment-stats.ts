import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../_supabase";

export default defineTool({
  name: "shipment_stats",
  title: "Estadísticas de envíos",
  description: "Conteos de envíos por estado en un rango de fechas (por defecto últimos 30 días).",
  inputSchema: {
    desde: z.string().optional().describe("ISO date inicio"),
    hasta: z.string().optional().describe("ISO date fin"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ desde, hasta }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const from = desde ?? new Date(Date.now() - 30 * 864e5).toISOString();
    const to = hasta ?? new Date().toISOString();
    const estados = ["pendiente", "en_reparto", "entregado", "cancelado", "reprogramado", "en_sucursal"];
    const counts: Record<string, number> = {};
    await Promise.all(
      estados.map(async (e) => {
        const { count } = await sb
          .from("envios")
          .select("id", { count: "exact", head: true })
          .eq("estado", e)
          .gte("created_at", from)
          .lte("created_at", to);
        counts[e] = count ?? 0;
      }),
    );
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const payload = { desde: from, hasta: to, total, counts };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
