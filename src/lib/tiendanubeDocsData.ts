import { type DiagramStep } from './generateDiagramaSecuenciaPDF';

export interface DiagramFlow {
  title: string;
  steps: DiagramStep[];
  note?: string;
}

export const DIAGRAM_ACTORS = [
  { name: 'Merchant', desc: 'Comerciante con tienda en Tiendanube que instala la aplicacion de envios.' },
  { name: 'Tiendanube', desc: 'Plataforma de e-commerce que gestiona la autorizacion OAuth 2.0 y eventos.' },
  { name: 'Geologistick Backend', desc: 'Edge Functions que procesan OAuth, webhooks, cotizaciones y fulfillment.' },
  { name: 'Base de Datos', desc: 'Almacenamiento seguro de tokens, credenciales y datos de pedidos/envios.' },
];

export const DIAGRAM_FLOWS: DiagramFlow[] = [
  {
    title: '1. Flujo de Instalacion y Autorizacion OAuth',
    steps: [
      { from: 'Merchant', to: 'Tiendanube', description: 'Instala Geologistick desde el panel de apps' },
      { from: 'Tiendanube', to: 'Merchant', description: 'Muestra permisos solicitados (pedidos, fulfillment, webhooks, shipping)' },
      { from: 'Merchant', to: 'Tiendanube', description: 'Acepta permisos de la aplicacion' },
      { from: 'Tiendanube', to: 'Geologistick', description: 'Redirige a /callback con authorization code' },
      { from: 'Geologistick', to: 'Tiendanube', description: 'POST /apps/authorize/token (code + client_id + client_secret)' },
      { from: 'Tiendanube', to: 'Geologistick', description: 'Retorna access_token + refresh_token + token_expires_at' },
      { from: 'Geologistick', to: 'Base de Datos', description: 'Almacena tokens de forma segura + token_expires_at' },
      { from: 'Geologistick', to: 'Tiendanube', description: 'Registra webhooks (order/created, order/paid, order/fulfilled, order/cancelled, app/uninstalled)' },
      { from: 'Geologistick', to: 'Tiendanube', description: 'Registra shipping carrier con URL de cotizacion en tiempo real' },
      { from: 'Geologistick', to: 'Merchant', description: 'Redirige a pagina de conexion exitosa en Geologistick' },
    ],
  },
  {
    title: '2. Recepcion de Pedidos via Webhook',
    steps: [
      { from: 'Tiendanube', to: 'Geologistick', description: 'Envia webhook con evento (ej: order/created) firmado HMAC-SHA256' },
      { from: 'Geologistick', to: 'Geologistick', description: 'Valida firma HMAC-SHA256 con webhook_secret del seller' },
      { from: 'Geologistick', to: 'Tiendanube', description: 'GET /orders/{id} para obtener datos completos del pedido' },
      { from: 'Geologistick', to: 'Base de Datos', description: 'Almacena pedido en ecommerce_orders con datos del comprador y envio' },
      { from: 'Geologistick', to: 'Tiendanube', description: 'Responde HTTP 200 OK confirmando recepcion' },
    ],
  },
  {
    title: '3. Cotizacion de Envios en Checkout',
    steps: [
      { from: 'Tiendanube', to: 'Geologistick', description: 'POST /tiendanube-shipping-rates con destino y dimensiones del paquete' },
      { from: 'Geologistick', to: 'Base de Datos', description: 'Consulta tarifa asignada al seller (tarifa_id y tarifa_express_id)' },
      { from: 'Geologistick', to: 'Geologistick', description: 'Calcula opciones: Estandar, Express y Retiro en sucursal' },
      { from: 'Geologistick', to: 'Tiendanube', description: 'Retorna array de rates con precio, plazo y nombre del servicio' },
    ],
  },
  {
    title: '4. Actualizacion de Fulfillment con Tracking',
    steps: [
      { from: 'Geologistick', to: 'Base de Datos', description: 'Detecta envio entregado (estado = entregado) vinculado a pedido Tiendanube' },
      { from: 'Geologistick', to: 'Tiendanube', description: 'POST /orders/{id}/fulfill con tracking_number y shipping_company' },
      { from: 'Tiendanube', to: 'Geologistick', description: 'Confirma fulfillment exitoso (HTTP 200)' },
      { from: 'Tiendanube', to: 'Merchant', description: 'Notifica al comerciante que el pedido fue despachado' },
    ],
  },
  {
    title: '5. Renovacion Automatica de Tokens',
    steps: [
      { from: 'Geologistick', to: 'Base de Datos', description: 'Detecta token_expires_at proximo a expirar' },
      { from: 'Geologistick', to: 'Tiendanube', description: 'POST /apps/authorize/token con refresh_token + client_id + client_secret' },
      { from: 'Tiendanube', to: 'Geologistick', description: 'Retorna nuevo access_token + refresh_token + token_expires_at' },
      { from: 'Geologistick', to: 'Base de Datos', description: 'Actualiza tokens con los nuevos valores de forma segura' },
    ],
  },
  {
    title: '6. Flujo de Desinstalacion',
    steps: [
      { from: 'Merchant', to: 'Tiendanube', description: 'Desinstala la aplicacion Geologistick desde el panel de apps' },
      { from: 'Tiendanube', to: 'Geologistick', description: 'Envia webhook app/uninstalled firmado con HMAC-SHA256' },
      { from: 'Geologistick', to: 'Geologistick', description: 'Valida firma HMAC-SHA256 del webhook recibido' },
      { from: 'Geologistick', to: 'Base de Datos', description: 'Elimina access_token del seller' },
      { from: 'Geologistick', to: 'Base de Datos', description: 'Elimina refresh_token del seller' },
      { from: 'Geologistick', to: 'Base de Datos', description: 'Elimina token_expires_at del seller' },
      { from: 'Geologistick', to: 'Base de Datos', description: 'Elimina webhook_secret del seller' },
      { from: 'Geologistick', to: 'Base de Datos', description: 'Elimina shipping_carrier_id del seller' },
    ],
    note: 'Los datos historicos (pedidos, envios, liquidaciones) se PRESERVAN intactos.',
  },
  {
    title: '7. Flujo de Reinstalacion',
    steps: [
      { from: 'Merchant', to: 'Tiendanube', description: 'Reinstala la aplicacion Geologistick desde el panel de apps' },
      { from: 'Tiendanube', to: 'Merchant', description: 'Muestra permisos solicitados nuevamente' },
      { from: 'Merchant', to: 'Tiendanube', description: 'Acepta permisos de la aplicacion' },
      { from: 'Tiendanube', to: 'Geologistick', description: 'Redirige a /callback con nuevo authorization code' },
      { from: 'Geologistick', to: 'Tiendanube', description: 'POST /apps/authorize/token (intercambio de code por tokens)' },
      { from: 'Tiendanube', to: 'Geologistick', description: 'Retorna nuevos access_token + refresh_token' },
      { from: 'Geologistick', to: 'Base de Datos', description: 'Detecta seller existente por store_id' },
      { from: 'Geologistick', to: 'Base de Datos', description: 'Actualiza tokens con nuevos valores (no crea registro duplicado)' },
      { from: 'Geologistick', to: 'Tiendanube', description: 'Re-registra webhooks y shipping carrier' },
      { from: 'Geologistick', to: 'Merchant', description: 'Redirige a pagina de conexion exitosa' },
    ],
    note: 'Resultado: Tienda operativa con todo el historial intacto y nuevas credenciales.',
  },
];
