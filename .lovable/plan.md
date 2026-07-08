## Objetivo
Crear un documento técnico de alto nivel en `docs/ARQUITECTURA.md` que explique cómo fluyen todos los procesos del sistema, con diagramas Mermaid embebidos.

## Contenido del documento

### 1. Panorama general
- Stack: React/Vite + Lovable Cloud (Supabase) + Edge Functions.
- Multi-tenant: `tenant_id` en todas las tablas + RLS por `current_user_tenant()`.
- Roles: `super_admin`, `admin`, `chofer`, `sucursal`, `seller`.
- Diagrama de contexto: frontend / edge functions / DB / integraciones externas / apps móviles.

### 2. Núcleo operativo
- **Ciclo de vida del envío**: `pendiente → recogido → en_transito → en_sucursal → en_reparto → entregado` (+ reprogramación, incidencia, devuelto, cancelado). Diagrama de estados.
- **Creación**: manual, OCR, ML/Tiendanube, API pública.
- **Rutas planificadas y hojas de ruta**: planificador → asignación a chofer → inicio → paradas (entrega/retiro) → cierre.
- **Chofer / última milla**: check-in diario, navegación de paradas, entrega con firma/foto, reprogramación, cierre de jornada.
- **Trazabilidad física entre sucursales** (`hoja_ruta` flex).
- Diagrama de flujo: creación → planificación → ejecución → entrega.

### 3. Facturación y cobros
- **ARCA/AFIP**: autenticación WSAA (cache 12 h) → padrón A13 → emisión de comprobante (CAE) → QR.
- **Facturación del envío**: al entregar → diálogo `InvoiceDataDialog` → prefill destinatario/cliente → lookup DNI/CUIT → edge `arca-factura`.
- **Pagos**: contado, contra entrega, MP webhook, tarjeta.
- **Caja y rendiciones**: sesiones de caja abiertas, movimientos, rendición de choferes, reconciliación.
- **Cuentas corrientes**: cliente, seller, terciarizado.
- Diagrama de flujo facturación + secuencia ARCA.

### 4. Liquidaciones
- **Chofer**: por comisión de zona / tarifa activa, excluye entregas en sucursal, comisiones históricas vs pendientes.
- **Sucursal**: emisión vs recepción, agrupa por fecha de entrega, fallback por concepto.
- **Seller (e-commerce)**: saldo dinámico = envíos − pagos, incluye cargos de `seller_cuenta_corriente`, jerarquía de tarifas (exclusiva > default > general).
- **Terciarizado**: por operación (retiro/entrega), IVA.
- **Partner**: acuerdos comerciales, sincronización.
- Diagrama por rol con inputs/outputs.

### 5. Integraciones externas
- **Mercado Libre**: OAuth, sync 12 h, estados duales (interno vs ML), anti-downgrade, webhook.
- **Mercado Pago**: webhook con HMAC clonado, suscripciones, cobros contra entrega.
- **Tiendanube**: OAuth, tarifas, fulfillment, sync de órdenes.
- **Partners (federación de tenants)**: `partner_shipments`, `estado_sync`, propagación de estados.
- **Public API**: `x-api-key`, endpoints públicos (tracking, tarifas, sucursales).
- **MCP (agentes)**: OAuth interno, tools `whoami / list_shipments / get_shipment / shipment_stats`.
- Diagrama de contexto de integraciones.

### 6. Seguridad y multi-tenant
- Resumen corto: RLS + `has_role` + `current_user_tenant` + GRANTs.
- Bypass de super_admin (estados finales, tenants).

## Formato
- Un solo archivo `docs/ARQUITECTURA.md`.
- Diagramas Mermaid embebidos como bloques ```mermaid.
- Español (AR), tono técnico pero de alto nivel: sin nombres de columnas ni edge functions salvo cuando aporten claridad.

## Validación
- El archivo abre en el visor Markdown del repo con los diagramas renderizados.
- Cubre los 4 dominios pedidos con al menos 1 diagrama por dominio.
