
# Plan: Modificar Campos en Agregar Envío Terciarizado

## Resumen

Modificar el formulario de Envío Terciarizado para reemplazar dos campos que no se utilizan por información más relevante para la operación:

| Campo Actual | Nuevo Campo |
|--------------|-------------|
| Código de Cliente | Teléfono del destinatario |
| Código de Orden | Método de pago (selector) |

---

## Cambios a Realizar

### Archivo: `src/components/routes/ThirdPartyShipmentsTab.tsx`

**1. Actualizar la interfaz `ThirdPartyFormData`**

Reemplazar los campos:
```typescript
// Antes:
codigo_cliente_externo: string;
codigo_orden_externo: string;

// Después:
whatsapp_destinatario: string;
tipo_pago: string;
```

**2. Actualizar el objeto `emptyForm`**

```typescript
// Antes:
codigo_cliente_externo: "",
codigo_orden_externo: "",

// Después:
whatsapp_destinatario: "",
tipo_pago: "destino", // Valor por defecto
```

**3. Modificar el formulario en la UI (líneas 428-446)**

Reemplazar los dos campos de Input por:

**Campo 1 - Teléfono del destinatario:**
- Label: "Teléfono del destinatario"
- Tipo: Input de texto
- Placeholder: "Ej: 1155557777"
- Almacena en: `whatsapp_destinatario`

**Campo 2 - Método de pago:**
- Label: "Método de pago"
- Tipo: Select (dropdown)
- Opciones:
  - `destino` → "Pago en Destino"
  - `contado` → "Contado"
  - `cuenta_corriente` → "Cuenta Corriente"
- Almacena en: `tipo_pago`

**4. Actualizar la mutación `createShipmentMutation`**

Cambiar los campos insertados en la base de datos:
```typescript
// Antes:
codigo_cliente_externo: shipment.codigo_cliente_externo || null,
codigo_orden_externo: shipment.codigo_orden_externo || null,

// Después:
whatsapp_destinatario: shipment.whatsapp_destinatario || null,
tipo_pago: shipment.tipo_pago || 'destino',
pago_contra_entrega: shipment.tipo_pago === 'destino',
```

La lógica `pago_contra_entrega = true` cuando `tipo_pago === 'destino'` es consistente con el comportamiento existente en `NewShipment.tsx`.

---

## Resultado Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│ 📦 Agregar Envío Terciarizado                                   │
├─────────────────────────────────────────────────────────────────┤
│ Empresa Terciarizada *          │ Tracking Externo *            │
│ [MD CARGAS (MD)            ▾]   │ [R-349-5686               ]   │
├─────────────────────────────────────────────────────────────────┤
│ Teléfono del destinatario       │ Método de pago                │
│ [1155557777                 ]   │ [Pago en Destino          ▾]  │
│                                 │  ├─ Pago en Destino           │
│                                 │  ├─ Contado                   │
│                                 │  └─ Cuenta Corriente          │
├─────────────────────────────────────────────────────────────────┤
│ Nombre Destinatario/Cliente *                                   │
│ [SANDRA CORBELLI                                            ]   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sección Técnica

### Constantes para Método de Pago

Se agregará una constante para las opciones de método de pago, similar a las existentes:

```typescript
const METODOS_PAGO = [
  { value: "destino", label: "Pago en Destino" },
  { value: "contado", label: "Contado" },
  { value: "cuenta_corriente", label: "Cuenta Corriente" },
];
```

### Impacto en Otros Componentes

Los campos `codigo_cliente_externo` y `codigo_orden_externo` seguirán existiendo en la base de datos y se pueden usar en otros contextos (importación CSV, etc.). Este cambio solo afecta al formulario de terciarizados.

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/routes/ThirdPartyShipmentsTab.tsx` | Reemplazar campos del formulario |
