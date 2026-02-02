

# Plan: Agregar Campos de Importe y Bultos a Envío Terciarizado

## Resumen

Agregaré dos campos faltantes al formulario de Envío Terciarizado:
1. **Importe ($)** - Precio total del envío
2. **Cantidad de Bultos** - Número de paquetes/bultos

---

## Cambios a Realizar

### Archivo: `src/components/routes/ThirdPartyShipmentsTab.tsx`

**1. Actualizar la interfaz `ThirdPartyFormData`**

Agregar los campos faltantes:
```typescript
interface ThirdPartyFormData {
  // ... campos existentes
  precio_total: number;   // NUEVO
  cantidad_bultos: number; // NUEVO
}
```

**2. Actualizar el objeto `emptyForm`**

```typescript
const emptyForm: ThirdPartyFormData = {
  // ... campos existentes
  precio_total: 0,
  cantidad_bultos: 1,  // Por defecto 1 bulto
};
```

**3. Reorganizar el formulario**

Cambiaré la fila de Teléfono + Método de pago de 2 columnas a 4 columnas para incluir Importe y Bultos:

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│ Teléfono destino    │ Método de pago     │ Importe ($)    │ Bultos           │
│ [1155557777      ]  │ [Pago en Dest. ▾]  │ [$ 2500.00  ]  │ [1           ]   │
└────────────────────────────────────────────────────────────────────────────────┘
```

**4. Actualizar la mutación `createShipmentMutation`**

```typescript
// Cambiar de:
precio_total: 0,

// A:
precio_total: shipment.precio_total || 0,
cantidad_bultos: shipment.cantidad_bultos || 1,
```

**5. Agregar ícono de importación**

```typescript
import { DollarSign, Package } from "lucide-react";
```

---

## Resultado Visual del Formulario

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 📦 Agregar Envío Terciarizado                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Empresa Terciarizada *              │ Tracking Externo *                        │
│ [MD CARGAS (MD)                 ▾]  │ [R-349-5686                           ]   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Teléfono destino  │ Método de pago      │ Importe ($)     │ Bultos            │
│ [1155557777    ]  │ [Pago en Destino ▾] │ [$ 2500.00   ]  │ [1            ]   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Nombre Destinatario/Cliente *                                                   │
│ [SANDRA CORBELLI                                                            ]   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ ... resto del formulario ...                                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Sección Tecnica

### Componentes de los Nuevos Campos

**Campo de Importe:**
```typescript
<div className="space-y-2">
  <Label>Importe ($)</Label>
  <div className="relative">
    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      type="number"
      min="0"
      step="0.01"
      placeholder="0.00"
      className="pl-9"
      value={formData.precio_total || ""}
      onChange={(e) => handleInputChange("precio_total", parseFloat(e.target.value) || 0)}
    />
  </div>
</div>
```

**Campo de Bultos:**
```typescript
<div className="space-y-2">
  <Label>Bultos</Label>
  <div className="relative">
    <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      type="number"
      min="1"
      placeholder="1"
      className="pl-9"
      value={formData.cantidad_bultos || 1}
      onChange={(e) => handleInputChange("cantidad_bultos", parseInt(e.target.value) || 1)}
    />
  </div>
</div>
```

### Impacto en Cuenta Corriente

El campo `precio_total` ya está siendo usado en la lógica de cuenta corriente (linea ~296-303), por lo que al capturar el importe real, los cargos se registrarán correctamente.

### Grid Responsive

El grid usara `grid-cols-2 md:grid-cols-4` para que en movil se vea en 2 columnas y en desktop en 4.

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/routes/ThirdPartyShipmentsTab.tsx` | Agregar campos de importe y bultos |

