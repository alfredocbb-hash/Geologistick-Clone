import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import listShipments from "./tools/list-shipments";
import getShipment from "./tools/get-shipment";
import shipmentStats from "./tools/shipment-stats";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "geologistick-mcp",
  title: "Geologistick MCP",
  version: "0.1.0",
  instructions:
    "Herramientas de Geologistick para asistentes de IA. Cada llamada se ejecuta como el usuario autenticado (respeta tenant y RLS). Usá `whoami` para verificar la conexión, `list_shipments` y `get_shipment` para consultar envíos, y `shipment_stats` para conteos por estado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, listShipments, getShipment, shipmentStats],
});
