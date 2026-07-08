import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../_supabase";

export default defineTool({
  name: "list_shipments",
  title: "Listar envíos",
  description: "Lista los envíos del tenant del usuario, con filtros opcionales por estado, ciudad y rango de fechas.",
  inputSchema: {
    estado: z.string().optional().describe("Estado interno (ej: pendiente, en_reparto, entregado, cancelado)."),
    ciudad: z.string().optional().describe("Filtro por ciudad de entrega (coincidencia parcial)."),
    desde: z.string().optional().describe("Fecha ISO (creado desde)."),
    hasta: z.string().optional().describe("Fecha ISO (creado hasta)."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ estado, ciudad, desde, hasta, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("envios")
      .select("id,tracking_number,tracking_externo,estado,destinatario_nombre,ciudad_entrega,direccion_entrega,precio_total,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (estado) q = q.eq("estado", estado);
    if (ciudad) q = q.ilike("ciudad_entrega", `%${ciudad}%`);
    if (desde) q = q.gte("created_at", desde);
    if (hasta) q = q.lte("created_at", hasta);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { shipments: data ?? [] },
    };
  },
});
