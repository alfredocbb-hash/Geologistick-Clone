# Arquitectura y Flujos del Sistema

Documento técnico de alto nivel sobre cómo fluyen los procesos del sistema (Geologistick). Todos los diagramas son Mermaid y se renderizan directamente en el visor Markdown.

---

## 1. Panorama general

- **Frontend**: React + Vite + Tailwind + shadcn/ui. App móvil en Capacitor (Android APK) para choferes.
- **Backend**: Lovable Cloud (Supabase) — Postgres con RLS, Auth, Storage, Edge Functions (Deno).
- **Multi-tenant**: cada registro operativo lleva `tenant_id`. RLS y funciones `SECURITY DEFINER` (`current_user_tenant()`, `has_role()`) garantizan aislamiento.
- **Roles**: `super_admin`, `admin`, `chofer`, `sucursal`, `seller`. Los `super_admin` pueden operar entre tenants y revertir estados finales.
- **Integraciones**: Mercado Libre, Mercado Pago, Tiendanube, ARCA/AFIP, Google Maps/Directions, Partners federados, Public API + MCP.

### Diagrama de contexto

```mermaid
flowchart LR
  subgraph Clientes
    UI[Web App]
    APK[App Chofer APK]
    PUB[Tracking Público / Horizon]
    AGT[Agentes IA / MCP]
  end

  subgraph LovableCloud[Lovable Cloud]
    EF[Edge Functions]
    DB[(Postgres + RLS)]
    ST[Storage]
    AUTH[Auth]
  end

  subgraph Externos
    ML[Mercado Libre]
    MP[Mercado Pago]
    TN[Tiendanube]
    ARCA[ARCA / AFIP]
    GMAPS[Google Maps]
    PART[Partners]
  end

  UI --> EF
  UI --> DB
  APK --> EF
  APK --> DB
  PUB --> EF
  AGT --> EF
  EF --> DB
  EF --> ST
  EF <--> ML
  EF <--> MP
  EF <--> TN
  EF <--> ARCA
  EF <--> GMAPS
  EF <--> PART
  AUTH --- DB
```

---

## 2. Núcleo operativo

### 2.1 Ciclo de vida del envío

```mermaid
stateDiagram-v2
  [*] --> pendiente
  pendiente --> recogido: retiro en domicilio
  pendiente --> en_sucursal: ingreso manual/OCR
  recogido --> en_transito: hoja de ruta salida
  en_transito --> en_sucursal: arribo a centro logístico
  en_sucursal --> en_reparto: asignación a chofer última milla
  en_reparto --> entregado: entrega con evidencia
  en_reparto --> reprogramado: falla / visita
  reprogramado --> pendiente: nueva planificación
  en_reparto --> incidencia
  incidencia --> en_reparto: reintento
  incidencia --> devuelto
  en_sucursal --> entregado: retiro en sucursal
  pendiente --> cancelado
  entregado --> [*]
  devuelto --> [*]
  cancelado --> [*]
```

Los estados **entregado / cancelado / devuelto** son finales: bloquean escaneos y ediciones (solo `super_admin` puede revertir).

### 2.2 Orígenes de creación

| Origen | Canal |
|---|---|
| Manual | Formulario web / OCR de etiqueta |
| E-commerce | Mercado Libre (webhook + sync), Tiendanube (webhook) |
| API pública | `x-api-key` de tenant, endpoints REST |
| Partner | Federación entre tenants |

### 2.3 Planificación y ejecución

```mermaid
flowchart TD
  A[Envío creado] --> B{¿Necesita última milla?}
  B -- Sí --> C[Ruta planificada<br/>o hoja de ruta]
  B -- No --> Z[Retiro en sucursal]
  C --> D[Asignación a chofer]
  D --> E[Check-in diario chofer]
  E --> F[Inicio de ruta]
  F --> G[Navegación paradas<br/>entrega / retiro]
  G --> H{Resultado}
  H -- Entrega OK --> I[Evidencia + firma/foto]
  I --> J[entregado]
  H -- Falla --> K[Visita / reprogramación]
  H -- Incidencia --> L[incidencia]
  F --> M[Cierre de jornada]
  Z --> N[Entrega en sucursal<br/>+ pago + factura opcional]
  N --> J
```

Puntos clave:
- **Check-in diario obligatorio** para chofer (guarda coordenadas).
- **Reprogramación** desasigna chofer y vuelve a `pendiente` (salvo en ML, que usa `reprogramado`).
- **Trazabilidad física entre sucursales** vía hojas de ruta flex (`en_transito → en_sucursal` con `sucursal_entrega_id`).
- **GPS en vivo** con precisión máx. 50 m, polling dinámico 10/15 s; trayectorias ajustadas a calles con snap-to-roads.

---

## 3. Facturación y cobros

### 3.1 Flujo de facturación al entregar

```mermaid
flowchart LR
  E[Entrega confirmada] --> Q{¿Requiere factura?}
  Q -- No --> FIN[Fin]
  Q -- Sí --> D[InvoiceDataDialog<br/>prefill destinatario/cliente]
  D --> L[Lookup DNI/CUIT]
  L --> LC[Clientes / Terciarizadas]
  L --> LA[AFIP Padrón A13]
  LC --> F[Emitir factura]
  LA --> F
  F --> ARCA[Edge arca-factura]
  ARCA --> CAE[CAE + QR]
  CAE --> DB[(facturas)]
  CAE --> CC[Cuenta corriente<br/>cliente / seller / terciarizado]
```

- Tipo de comprobante A / B / C se deriva de la condición IVA del emisor vs receptor.
- Documento del receptor: 11 díg. → CUIT (80), 7–8 díg. → DNI (96), vacío → consumidor final (99/0).
- Los datos del destinatario del envío se precargan y son editables.

### 3.2 Secuencia ARCA/AFIP

```mermaid
sequenceDiagram
  participant App
  participant EF as Edge arca-factura
  participant Cache as Cache WSAA (DB)
  participant WSAA
  participant WSFE as WSFEv1 (CAE)

  App->>EF: emitir factura
  EF->>Cache: token+sign vigentes?
  alt Cache válido (12h)
    Cache-->>EF: token, sign
  else Sin cache
    EF->>WSAA: loginCms (CMS firmado)
    WSAA-->>EF: token, sign
    EF->>Cache: guardar (12h)
  end
  EF->>WSFE: FECAESolicitar
  WSFE-->>EF: CAE + vto
  EF->>App: factura emitida (CAE + QR)
```

### 3.3 Pagos, caja y rendiciones

```mermaid
flowchart TD
  P[Cobro] --> M{Método}
  M -- Contado --> CJ[Movimiento en caja]
  M -- Contra entrega --> CH[Cobrado por chofer]
  M -- MP / Tarjeta --> MPW[Webhook MP]
  CH --> R[Rendición al llegar a sucursal]
  R --> CJ
  MPW --> CJ
  CJ --> SC[Sesión de caja abierta]
  SC --> RC[Cierre + reconciliación<br/>saldo real MP]
```

- **Sesiones de caja** por sucursal; solo con sesión abierta se registran movimientos.
- **Rendición** valida montos y método, cruza pagos vs efectivo entregado.
- **Cuentas corrientes** (cliente, seller, terciarizado) actualizan saldo dinámicamente.

---

## 4. Liquidaciones

Diagrama común: todas siguen el patrón **inputs → cálculo → borrador → aprobación → pago → cuenta corriente**.

```mermaid
flowchart LR
  IN[Envíos + pagos<br/>del período] --> CALC[Motor de cálculo<br/>según rol]
  CALC --> DR[Borrador editable]
  DR --> AP[Aprobación]
  AP --> PG[Pago]
  PG --> CC[Cuenta corriente]
  PG --> CJ[Movimiento de caja]
```

### 4.1 Por rol

| Rol | Base de cálculo | Regla clave |
|---|---|---|
| **Chofer** | Comisión por zona / tarifa activa | Excluye entregas en sucursal. Pendientes recalculan; liquidados guardan histórico. Fallback: tarifa de zona activa que matchee `ciudad_entrega`. |
| **Sucursal** | Envíos por fecha de entrega | Emisión vs recepción según sucursal. Fallback por nombre de concepto (IDs legacy). Excluye envíos ya liquidados. |
| **Seller (e-commerce)** | `saldo dinámico = envíos − pagos` | Incluye cargos de `seller_cuenta_corriente`. Tarifa: exclusiva > default > general. Excluye envíos `pendiente`. |
| **Terciarizado** | Por operación | Retiro vs entrega según `requiere_retiro`. IVA discriminado. |
| **Partner** | Acuerdo comercial | Sincronización con partner destino, comisión por `partner_comisiones`. |

### 4.2 Automatismos

- Pagar liquidación seller → crea `pago` + egreso de caja + movimiento en cuenta corriente.
- Cancelar envío liquidado → nulifica pagos y compensa en caja para preservar integridad financiera.
- Envíos cancelados con visita cuentan valor de visita; sin visita, valor $0.

---

## 5. Integraciones externas

### 5.1 Contexto de integraciones

```mermaid
flowchart LR
  subgraph Sistema
    EF[Edge Functions]
    DB[(DB)]
  end
  ML[Mercado Libre] <-->|OAuth + sync 12h + webhook| EF
  MP[Mercado Pago] -->|webhook HMAC| EF
  TN[Tiendanube] <-->|OAuth + webhook + fulfill| EF
  PART[Partners / Tenants] <-->|API keys + partner_shipments| EF
  ARCA[AFIP] <-->|WSAA + WSFE| EF
  GMAPS[Google Maps] <-->|geocode + directions + snap| EF
  API[Public API / Horizon] -->|x-api-key| EF
  MCP[Agentes MCP] -->|OAuth interno| EF
  EF <--> DB
```

### 5.2 Puntos clave por integración

- **Mercado Libre**: OAuth por seller, sync 12 h con anti-downgrade (no revierte a estados anteriores), estados duales (interno + ML mapeado), webhook para actualizaciones push.
- **Mercado Pago**: webhook clona el request para verificar HMAC. Cobros contra entrega, suscripciones del propio SaaS.
- **Tiendanube**: OAuth, cálculo de tarifas en checkout, fulfillment automático al despachar.
- **Partners (federación de tenants)**: `partner_shipments` con `estado_sync`; trigger propaga entregas y devoluciones entre tenants.
- **Public API**: header `x-api-key` por tenant. Sin key devuelve datos ofuscados (sin PII). Endpoints: tracking, tarifas, sucursales, live map.
- **MCP (agentes IA)**: OAuth propio, respeta RLS del usuario. Tools expuestas: `whoami`, `list_shipments`, `get_shipment`, `shipment_stats`.

### 5.3 Sincronización ML (secuencia)

```mermaid
sequenceDiagram
  participant Seller
  participant App
  participant EF as Edge mercadolibre-sync
  participant MLAPI as ML API
  participant DB

  Seller->>App: conectar cuenta
  App->>EF: iniciar OAuth
  EF->>MLAPI: authorize
  MLAPI-->>EF: access + refresh token
  EF->>DB: guardar tokens
  loop cada 12h o webhook
    EF->>MLAPI: pedir shipments recientes
    MLAPI-->>EF: cambios
    EF->>DB: upsert (con anti-downgrade)
  end
```

---

## 6. Seguridad y multi-tenant

- **RLS activa** en todas las tablas del schema `public`, con GRANT explícito por rol (`authenticated`, `service_role`, `anon` solo donde aplica).
- **Aislamiento por tenant**: funciones `current_user_tenant()` y `user_belongs_to_tenant()` como filtro en policies.
- **Autorización**: `has_role(user, role)` sobre tabla `user_roles` (nunca en `profiles`).
- **Super_admin**: puede operar entre tenants y revertir estados finales vía diálogo controlado.
- **API keys**: hash HMAC con fallback a SHA-256 para keys legacy; validadas server-side.
- **Padrón AFIP**: certificados y claves privadas en `system_integrations` con cache de 12 h para el token WSAA.

### Modelo de acceso simplificado

```mermaid
flowchart TD
  U[Usuario] --> T{Rol}
  T -- super_admin --> ALL[Todos los tenants + bypass estados finales]
  T -- admin --> TN1[Su tenant: gestión completa]
  T -- sucursal --> S[Su sucursal + envíos que la involucran]
  T -- chofer --> C[Sus envíos asignados + su check-in]
  T -- seller --> SE[Sus órdenes + sus liquidaciones]
```

---

## Anexo: convenciones

- Estados finales: `entregado`, `cancelado`, `devuelto` — bloquean escaneo/edición.
- Tracking mostrado siempre como `tracking_externo || tracking_number`.
- Coordenadas: `entrega_lat/lng` prima sobre `destinatario_lat/lng`.
- Teléfonos AR normalizados: prefijo `+54`, `15 → 9`, sin `0` de área.
- Total exacto en queries: `{ count: 'exact', head: true }` para superar el límite de 1000 filas.
