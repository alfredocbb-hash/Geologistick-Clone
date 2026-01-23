

# Plan: Gestión de Empresas Terciarizadas con Cuenta Corriente

## Objetivo

Crear un sistema completo para administrar empresas terciarizadas (Correo Argentino, OCA, Andreani, etc.) con funcionalidad de cuenta corriente, similar a la existente para clientes.

---

## Vista General del Sistema

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  MENÚ LATERAL                                                               │
│  ├── Operaciones                                                            │
│  │   ├── Envíos                                                             │
│  │   ├── Rutas                                                              │
│  │   └── ...                                                                │
│  ├── Administración                                                         │
│  │   ├── Clientes                                                           │
│  │   ├── Empresas Terciarizadas  ← NUEVA PÁGINA                             │
│  │   ├── Choferes                                                           │
│  │   └── ...                                                                │
│  ├── Finanzas                                                               │
│  │   ├── Liquidaciones Clientes                                             │
│  │   ├── Liquidaciones Terciarizados  ← NUEVA PÁGINA                        │
│  │   └── ...                                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Parte 1: Nueva Tabla - Empresas Terciarizadas

### Migración SQL

```sql
-- Tabla principal de empresas terciarizadas
CREATE TABLE public.empresas_terciarizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  codigo TEXT NOT NULL,              -- Código interno (ej: "CA", "OCA", "AND")
  nombre TEXT NOT NULL,              -- Nombre completo
  razon_social TEXT,                 -- Razón social para facturación
  cuit TEXT,                         -- CUIT de la empresa
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  ciudad TEXT,
  provincia TEXT,
  codigo_postal TEXT,
  notas TEXT,
  -- Campos de cuenta corriente
  tiene_cuenta_corriente BOOLEAN DEFAULT false,
  limite_credito NUMERIC DEFAULT 0,
  saldo_cuenta_corriente NUMERIC DEFAULT 0,
  -- Metadatos
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Historial de movimientos de cuenta corriente
CREATE TABLE public.terciarizado_cuenta_corriente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas_terciarizadas(id) ON DELETE CASCADE NOT NULL,
  envio_id UUID REFERENCES public.envios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('cargo', 'pago', 'ajuste')),
  monto NUMERIC NOT NULL,
  saldo_anterior NUMERIC NOT NULL DEFAULT 0,
  saldo_nuevo NUMERIC NOT NULL DEFAULT 0,
  descripcion TEXT,
  referencia TEXT,           -- Número de factura, remito, etc.
  metodo_pago TEXT,          -- Para pagos: efectivo, transferencia, etc.
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Modificar tabla envios para referenciar empresa terciarizada
ALTER TABLE public.envios
ADD COLUMN empresa_terciarizada_id UUID REFERENCES public.empresas_terciarizadas(id);

-- Índices
CREATE INDEX idx_empresas_terciarizadas_tenant ON public.empresas_terciarizadas(tenant_id);
CREATE INDEX idx_empresas_terciarizadas_codigo ON public.empresas_terciarizadas(codigo);
CREATE INDEX idx_terciarizado_cta_cte_empresa ON public.terciarizado_cuenta_corriente(empresa_id);

-- RLS Policies
ALTER TABLE public.empresas_terciarizadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terciarizado_cuenta_corriente ENABLE ROW LEVEL SECURITY;

-- Políticas para empresas_terciarizadas
CREATE POLICY "Ver empresas terciarizadas de su tenant"
  ON public.empresas_terciarizadas FOR SELECT
  USING (tenant_id = current_user_tenant() OR is_super_admin(auth.uid()));

CREATE POLICY "Gestionar empresas terciarizadas"
  ON public.empresas_terciarizadas FOR ALL
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'));

-- Políticas para cuenta corriente
CREATE POLICY "Ver cuenta corriente terciarizados"
  ON public.terciarizado_cuenta_corriente FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM empresas_terciarizadas e
    WHERE e.id = terciarizado_cuenta_corriente.empresa_id
    AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'))
  ));

CREATE POLICY "Gestionar cuenta corriente terciarizados"
  ON public.terciarizado_cuenta_corriente FOR INSERT
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'));
```

---

## Parte 2: Página de Gestión - Empresas Terciarizadas

### Vista de la Página

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  EMPRESAS TERCIARIZADAS                              [+ Nueva Empresa]      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┬─────────────┬──────────────┬─────────────┐                 │
│  │ Total       │ Con Cta.Cte │ Activas      │ Saldo Total │                 │
│  │ 6           │ 4           │ 5            │ -$125,000   │                 │
│  └─────────────┴─────────────┴──────────────┴─────────────┘                 │
│                                                                             │
│  [🔍 Buscar...________________________________]                             │
│                                                                             │
│  ┌──────┬──────────────────┬────────────┬─────────────┬─────────┬────────┐ │
│  │ Cód. │ Empresa          │ Teléfono   │ Saldo       │ Estado  │ Acc.   │ │
│  ├──────┼──────────────────┼────────────┼─────────────┼─────────┼────────┤ │
│  │ CA   │ Correo Argentino │ 0810-333   │ -$45,000    │ ✓ Activa│ ✏️ 🗑  │ │
│  │ OCA  │ OCA              │ 0800-555   │ -$32,000    │ ✓ Activa│ ✏️ 🗑  │ │
│  │ AND  │ Andreani         │ 011-4444   │ $0          │ ✓ Activa│ ✏️ 🗑  │ │
│  │ DHL  │ DHL Express      │ 011-5555   │ -$48,000    │ ✗ Inact.│ ✏️ 🗑  │ │
│  └──────┴──────────────────┴────────────┴─────────────┴─────────┴────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Diálogo de Crear/Editar Empresa

```text
┌─────────────────────────────────────────────────────────────────┐
│  Nueva Empresa Terciarizada                              [X]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INFORMACIÓN BÁSICA                                             │
│  Código *: [CA____]      Nombre *: [Correo Argentino_______]   │
│  Razón Social: [Correo Oficial de la Rep. Argentina S.A.]      │
│  CUIT: [30-12345678-9]                                          │
│                                                                 │
│  CONTACTO                                                       │
│  Teléfono: [0810-333-2273]    Email: [contacto@correo.com]     │
│                                                                 │
│  DIRECCIÓN                                                      │
│  Dirección: [Av. Corrientes 1234________________]              │
│  Ciudad: [Buenos Aires]    Provincia: [CABA▼]    CP: [1000]    │
│                                                                 │
│  CUENTA CORRIENTE                                               │
│  [✓] Habilitar Cuenta Corriente                                │
│  Límite de Crédito: [$500,000___]                              │
│                                                                 │
│  Notas: [_____________________________________________]         │
│                                                                 │
│                                   [Cancelar]  [Guardar]         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Parte 3: Página de Liquidaciones de Terciarizados

### Vista de la Página

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  LIQUIDACIONES TERCIARIZADOS                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Empresa: [Seleccionar empresa...▼]                                         │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  CORREO ARGENTINO                                                      │ │
│  │  CUIT: 30-12345678-9                                                  │ │
│  │                                                                        │ │
│  │  ┌─────────────────┬─────────────────┬─────────────────┐              │ │
│  │  │ Saldo Actual    │ Límite Crédito  │ Disponible      │              │ │
│  │  │ -$45,000        │ $500,000        │ $455,000        │              │ │
│  │  └─────────────────┴─────────────────┴─────────────────┘              │ │
│  │                                                                        │ │
│  │  [+ Registrar Pago]   [+ Ajuste Manual]                               │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  HISTORIAL DE MOVIMIENTOS                                                   │
│  ┌──────────┬──────────┬────────────────────────────┬──────────┬─────────┐ │
│  │ Fecha    │ Tipo     │ Descripción                │ Monto    │ Saldo   │ │
│  ├──────────┼──────────┼────────────────────────────┼──────────┼─────────┤ │
│  │ 23/01/26 │ 🔴 Cargo │ Envío EXT-001 - Juan Pérez │ -$1,500  │-$45,000 │ │
│  │ 22/01/26 │ 🟢 Pago  │ Transf. - Ref: 12345       │ +$50,000 │-$43,500 │ │
│  │ 20/01/26 │ 🔴 Cargo │ Envío EXT-002 - María G.   │ -$2,300  │-$93,500 │ │
│  └──────────┴──────────┴────────────────────────────┴──────────┴─────────┘ │
│                                                                             │
│  ENVÍOS PENDIENTES DE COBRO                                                 │
│  ┌────────────────┬──────────────────┬────────────┬───────────┐            │
│  │ Tracking Ext.  │ Destinatario     │ Fecha      │ Monto     │            │
│  ├────────────────┼──────────────────┼────────────┼───────────┤            │
│  │ AR123456789    │ Juan Pérez       │ 23/01/26   │ $1,500    │            │
│  │ AR987654321    │ Ana López        │ 22/01/26   │ $2,100    │            │
│  └────────────────┴──────────────────┴────────────┴───────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Parte 4: Integración con Pestaña Terciarizados

### Actualizar ThirdPartyShipmentsTab.tsx

Cambiar el Select de empresa de un listado fijo a consultar la tabla `empresas_terciarizadas`:

```typescript
// Antes (hardcoded)
const EMPRESAS_TERCIARIZADAS = [
  { value: "correo_argentino", label: "Correo Argentino" },
  // ...
];

// Después (desde base de datos)
const { data: empresas } = useQuery({
  queryKey: ['empresas-terciarizadas-activas'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('empresas_terciarizadas')
      .select('id, codigo, nombre')
      .eq('activa', true)
      .order('nombre');
    if (error) throw error;
    return data;
  },
});
```

Al crear un envío terciarizado, guardar la referencia a la empresa:

```typescript
const { data: envio, error } = await supabase
  .from('envios')
  .insert({
    // ... otros campos
    es_terciarizado: true,
    empresa_terciarizada_id: shipment.empresa_id,  // Referencia a la tabla
    tracking_externo: shipment.tracking_externo,
  });

// Si la empresa tiene cuenta corriente, registrar el cargo
if (empresa.tiene_cuenta_corriente) {
  await supabase.from('terciarizado_cuenta_corriente').insert({
    empresa_id: shipment.empresa_id,
    envio_id: envio.id,
    tipo: 'cargo',
    monto: shipment.monto_acordado || 0,
    saldo_anterior: empresa.saldo_cuenta_corriente,
    saldo_nuevo: empresa.saldo_cuenta_corriente + (shipment.monto_acordado || 0),
    descripcion: `Envío ${shipment.tracking_externo}`,
  });
}
```

---

## Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/pages/ThirdPartyCompanies.tsx` | **Nuevo** | Página de gestión de empresas |
| `src/pages/ThirdPartySettlements.tsx` | **Nuevo** | Página de liquidaciones |
| `src/components/layout/AppSidebar.tsx` | Modificar | Agregar enlaces al menú |
| `src/components/routes/ThirdPartyShipmentsTab.tsx` | Modificar | Usar empresas desde BD |
| `src/App.tsx` | Modificar | Agregar rutas nuevas |

---

## Flujo de Cuenta Corriente

```text
1. Admin crea empresa terciarizada con Cta. Cte. habilitada
           │
           ▼
2. Usuario crea envío terciarizado seleccionando esa empresa
           │
           ▼
3. Sistema registra CARGO automático en la cuenta corriente
           │
           ▼
4. Admin va a Liquidaciones Terciarizados
           │
           ▼
5. Registra PAGO cuando la empresa terciarizada cobra/paga
           │
           ▼
6. Saldo se actualiza automáticamente
```

---

## Resumen de Entregables

1. **Tabla `empresas_terciarizadas`** - Almacenar empresas con datos fiscales
2. **Tabla `terciarizado_cuenta_corriente`** - Historial de movimientos
3. **Página de gestión** - CRUD de empresas terciarizadas
4. **Página de liquidaciones** - Ver saldos, registrar pagos, historial
5. **Integración** - Actualizar pestaña Terciarizados para usar empresas de BD
6. **Navegación** - Agregar enlaces en el menú lateral

---

## Orden de Implementación

1. Migración de base de datos (tablas nuevas + relación)
2. Página ThirdPartyCompanies.tsx (gestión de empresas)
3. Página ThirdPartySettlements.tsx (liquidaciones)
4. Actualizar AppSidebar.tsx y App.tsx (navegación)
5. Actualizar ThirdPartyShipmentsTab.tsx (integración)
6. Actualizar visualización en Shipments.tsx (mostrar nombre empresa)

