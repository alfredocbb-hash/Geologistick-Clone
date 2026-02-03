
# Plan: Configuracion Avanzada de Comisiones para Sucursales/Agencias

## ✅ IMPLEMENTADO

### Comparativa Video vs Estado Actual

| Funcionalidad | Video | Estado Actual |
|---------------|-------|---------------|
| IVA Incluido (toggle) | Si | No existe |
| Porcentaje IVA | Si (ej: 21%) | No existe |
| Base de Calculo | Flete / Neto / Total | No existe |
| Tipo de Liquidacion | Inmediata / Diferida | No existe |
| Concepto "Recepcion" | Si | No existe en tarifa_conceptos |
| Concepto "Cobros/Cobranzas" | Si | No existe en tarifa_conceptos |
| Comisiones por concepto | Si | Si (funciona) |
| Porcentaje por tipo pago | Si | Si (contado/destino/cta_cte) |

---

## Parte 1: Migracion de Base de Datos

### 1.1 Agregar campos a tabla `sucursales`

```sql
-- Campos de configuracion fiscal y liquidacion a nivel sucursal
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS incluye_iva boolean DEFAULT false;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS porcentaje_iva numeric DEFAULT 21;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS tipo_liquidacion text DEFAULT 'diferida' 
  CHECK (tipo_liquidacion IN ('inmediata', 'diferida'));
```

### 1.2 Agregar campo a tabla `sucursal_comisiones`

```sql
-- Base de calculo para cada concepto-comision
ALTER TABLE sucursal_comisiones ADD COLUMN IF NOT EXISTS base_comision text DEFAULT 'total'
  CHECK (base_comision IN ('flete', 'neto', 'total'));
```

### 1.3 Insertar conceptos faltantes

```sql
-- Agregar concepto "Recepcion" si no existe
INSERT INTO tarifa_conceptos (nombre, codigo, activo, es_basico, orden, descripcion)
SELECT 'Recepcion', 'recepcion', true, true, 12, 'Servicio de recepcion de envios en sucursal'
WHERE NOT EXISTS (SELECT 1 FROM tarifa_conceptos WHERE codigo = 'recepcion');

-- Agregar concepto "Cobros/Cobranzas" si no existe
INSERT INTO tarifa_conceptos (nombre, codigo, activo, es_basico, orden, descripcion)
SELECT 'Cobros', 'cobros', true, true, 13, 'Comision por gestion de cobros'
WHERE NOT EXISTS (SELECT 1 FROM tarifa_conceptos WHERE codigo = 'cobros');
```

---

## Parte 2: Modificar Formulario de Sucursales

### Archivo: `src/pages/Branches.tsx`

### 2.1 Actualizar interface Sucursal

```typescript
interface Sucursal {
  // ... campos existentes
  incluye_iva: boolean | null;
  porcentaje_iva: number | null;
  tipo_liquidacion: string | null;
}
```

### 2.2 Actualizar defaultFormData

```typescript
const defaultFormData = {
  // ... campos existentes
  incluye_iva: false,
  porcentaje_iva: 21,
  tipo_liquidacion: 'diferida',
};
```

### 2.3 Agregar seccion "Configuracion Fiscal" al formulario

Nueva seccion despues de "Capacidades Operativas":

```
+-----------------------------------+
| Configuracion Fiscal y Comisiones |
+-----------------------------------+
| [x] Incluye IVA en comisiones     |
|     Porcentaje IVA: [21] %        |
|                                   |
| Tipo de Liquidacion:              |
| ( ) Inmediata - Al entregar       |
| (x) Diferida  - Fin de periodo    |
+-----------------------------------+
```

---

## Parte 3: Modificar Dialog de Comisiones

### Archivo: `src/pages/Branches.tsx` (lineas 1067-1176)

### 3.1 Actualizar interface SucursalComision

```typescript
interface SucursalComision {
  id: string;
  sucursal_id: string;
  concepto_id: string;
  porcentaje_contado: number;
  porcentaje_destino: number;
  porcentaje_cta_cte: number;
  base_comision: string; // NUEVO
}
```

### 3.2 Agregar columna "Base" a la tabla de comisiones

```
+----------+----------+----------+----------+----------+
| Concepto | % Contado| % Destino| % CtaCte | Base     |
+----------+----------+----------+----------+----------+
| Flete    | [5]      | [3]      | [4]      | [Total v]|
| Seguro   | [10]     | [8]      | [10]     | [Neto  v]|
| Entrega  | [15]     | [12]     | [15]     | [Flete v]|
| Recepcion| [5]      | [3]      | [5]      | [Total v]|
| Cobros   | [2]      | [1]      | [2]      | [Total v]|
+----------+----------+----------+----------+----------+
```

### 3.3 Selector de Base de Calculo

Opciones del dropdown:
- **Flete**: Solo sobre el costo de transporte
- **Neto**: Sobre el valor neto (sin IVA)
- **Total**: Sobre el valor total del envio

---

## Parte 4: Actualizar Calculo de Liquidaciones

### Archivo: `src/pages/BranchSettlements.tsx`

Modificar la funcion de calculo para:

1. Obtener configuracion de la sucursal (incluye_iva, porcentaje_iva)
2. Obtener base_comision de cada concepto
3. Calcular segun la base seleccionada:

```typescript
// Pseudocodigo del calculo mejorado
for (const envio of envios) {
  for (const concepto of conceptos) {
    const comisionConfig = comisiones.find(c => c.concepto_id === concepto.id);
    if (!comisionConfig) continue;

    let baseCalculo = 0;
    switch (comisionConfig.base_comision) {
      case 'flete':
        baseCalculo = envio.valor_flete || 0;
        break;
      case 'neto':
        baseCalculo = envio.precio_total / (1 + sucursal.porcentaje_iva / 100);
        break;
      case 'total':
      default:
        baseCalculo = envio.precio_total;
    }

    const porcentaje = getPorcentajePorTipoPago(comisionConfig, envio.tipo_pago);
    const comision = baseCalculo * (porcentaje / 100);
    
    // Si incluye IVA, agregar
    if (sucursal.incluye_iva) {
      comision *= (1 + sucursal.porcentaje_iva / 100);
    }
    
    totalComisiones += comision;
  }
}
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| **Nueva migracion SQL** | Agregar campos a sucursales y sucursal_comisiones, insertar conceptos |
| `src/pages/Branches.tsx` | Actualizar interfaces, formulario, y dialog de comisiones |
| `src/pages/BranchSettlements.tsx` | Actualizar logica de calculo de liquidaciones |
| `src/integrations/supabase/types.ts` | Se actualizara automaticamente |

---

## Flujo de Configuracion (Nuevo)

```
Administrador abre Sucursales
        |
        v
Click en una sucursal -> Editar
        |
        v
Seccion "Configuracion Fiscal":
  - Toggle "Incluye IVA"
  - Input "% IVA" (solo si incluye)
  - Radio "Tipo Liquidacion"
        |
        v
Guardar sucursal
        |
        v
Click icono "%" -> Dialog Comisiones
        |
        v
Por cada concepto:
  - % Contado
  - % Destino
  - % Cta Cte
  - Base (Flete/Neto/Total)
        |
        v
Guardar comisiones
        |
        v
Liquidar Sucursal:
  - Sistema calcula usando base_comision
  - Aplica IVA si corresponde
  - Genera liquidacion inmediata o diferida
```

---

## Definiciones de Campos

| Campo | Descripcion | Ejemplo |
|-------|-------------|---------|
| `incluye_iva` | Si las comisiones incluyen IVA | `true` |
| `porcentaje_iva` | Porcentaje de IVA a aplicar | `21` |
| `tipo_liquidacion` | Cuando se genera la comision | `inmediata` = al entregar, `diferida` = fin de periodo |
| `base_comision` | Sobre que valor se calcula el % | `flete`, `neto`, `total` |

---

## Notas Tecnicas

1. **Retrocompatibilidad**: Los campos nuevos tienen valores por defecto que mantienen el comportamiento actual (sin IVA, liquidacion diferida, base total)
2. **Conceptos nuevos**: Se insertan solo si no existen (idempotente)
3. **Validacion**: Los campos tipo_liquidacion y base_comision usan CHECK constraints para valores validos
4. **UI**: El campo "% IVA" solo se muestra si "Incluye IVA" esta activo
