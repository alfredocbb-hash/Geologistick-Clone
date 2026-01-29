

# Plan: Sistema Avanzado de Tarifas con Rangos, Seguro y Aumento Masivo

## Resumen Ejecutivo

Implementar un sistema completo de tarifas que incluya:
1. **Rangos de precio por kilaje** (tabla escalonada)
2. **Cálculo automático peso vs volumen** (umbral 50cm)
3. **Sistema de seguro configurable** (mínimo, máximo, porcentaje)
4. **Actualización masiva por porcentaje** (inflación/ajustes)
5. **Integración con liquidaciones**

---

## Nueva Funcionalidad: Aumento Masivo por Porcentaje

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                    ACTUALIZACIÓN MASIVA DE TARIFAS                        │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  📈 Ajuste de Precios por Inflación                                 │  │
│  │                                                                     │  │
│  │  Porcentaje de aumento: [15] %                                      │  │
│  │                                                                     │  │
│  │  Aplicar a:                                                         │  │
│  │  ☑ Precio base de tarifas                                           │  │
│  │  ☑ Rangos de peso (tabla de kg)                                     │  │
│  │  ☑ Precio por m³                                                    │  │
│  │  ☑ Conceptos (Entrega, Seguro base, etc.)                           │  │
│  │  ☐ Seguro (valor mínimo declarado)                                  │  │
│  │                                                                     │  │
│  │  Tarifas seleccionadas:                                             │  │
│  │  ☑ Todas las activas                                                │  │
│  │  ☐ Solo seleccionadas: [dropdown multi-select]                      │  │
│  │                                                                     │  │
│  │  ⚠️ Vista previa:                                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │  │ Tarifa         │ Precio Actual │ Precio Nuevo │ Diferencia  │    │  │
│  │  │ Estándar       │ $11,100       │ $12,765      │ +$1,665     │    │  │
│  │  │ Express        │ $14,600       │ $16,790      │ +$2,190     │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  │                                                                     │  │
│  │  [Cancelar]                              [Aplicar Aumento] 🚀       │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Cambios de Base de Datos

### 1. Modificar tabla `tarifas`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `rangos_kg` | jsonb | Array: `[{desde: 0, hasta: 5, precio: 11100}, ...]` |
| `umbral_volumen_cm` | integer | Lado mínimo para volumen (default: 50) |
| `precio_minimo_flete` | numeric | Flete mínimo a cobrar |

### 2. Modificar tabla `envios`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `alto_cm` | numeric | Alto en centímetros |
| `ancho_cm` | numeric | Ancho en centímetros |
| `largo_cm` | numeric | Largo en centímetros |
| `volumen_m3` | numeric | Volumen calculado (computed) |
| `tarifa_aplicada` | text | 'peso' o 'volumen' |

### 3. Nueva tabla `configuracion_seguro`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `valor_minimo_declarado` | numeric | $40,000 |
| `seguro_base` | numeric | $2,400 |
| `porcentaje_excedente` | numeric | 6% |
| `valor_maximo_asegurado` | numeric | $500,000 |
| `activo` | boolean | Si es obligatorio |

### 4. Nueva tabla `historial_ajustes_tarifas`

Para mantener registro de los aumentos aplicados:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `porcentaje_aplicado` | numeric | 15% |
| `tarifas_afectadas` | jsonb | IDs y montos anteriores |
| `conceptos_afectados` | jsonb | IDs y montos anteriores |
| `aplicado_por` | uuid | Usuario que aplicó |
| `created_at` | timestamptz | Fecha del ajuste |
| `notas` | text | Motivo del ajuste |

---

## Flujo de Cálculo de Precio

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                    FLUJO COMPLETO DE CÁLCULO                              │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ENTRADA                                                                  │
│  ├── Peso: 8 kg                                                           │
│  ├── Dimensiones: 60 × 40 × 30 cm                                         │
│  └── Valor declarado: $80,000                                             │
│                                                                           │
│  PASO 1: DETERMINAR MÉTODO                                                │
│  └── Si max(alto, ancho, largo) > 50cm → VOLUMEN                          │
│      └── 60 > 50 → Cobrar por volumen                                     │
│                                                                           │
│  PASO 2: CALCULAR FLETE                                                   │
│  ├── Si PESO: buscar rango en rangos_kg                                   │
│  │   └── 8 kg → rango 5.1-10 → $14,600                                    │
│  └── Si VOLUMEN: precio_base + (m³ × precio_por_m3)                       │
│      └── 0.072 m³ × $X = $Y                                               │
│                                                                           │
│  PASO 3: CALCULAR SEGURO                                                  │
│  ├── Valor declarado: $80,000                                             │
│  ├── Mínimo: $40,000 → Base: $2,400                                       │
│  ├── Excedente: ($80,000 - $40,000) × 6% = $2,400                         │
│  └── Total seguro: $4,800                                                 │
│                                                                           │
│  PASO 4: SUMAR CONCEPTOS                                                  │
│  ├── Flete: $14,600                                                       │
│  ├── Entrega: $5,600                                                      │
│  ├── Seguro: $4,800                                                       │
│  └── TOTAL: $25,000                                                       │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes a Crear

### 1. `WeightRangesEditor.tsx`

Editor de tabla para rangos de peso:

```text
┌─────────────────────────────────────────────────────────┐
│  RANGOS DE PRECIO POR KILAJE                            │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┬─────────┬────────────┬─────────┐           │
│  │ Desde   │ Hasta   │ Precio     │ Acción  │           │
│  ├─────────┼─────────┼────────────┼─────────┤           │
│  │ 0       │ 5       │ $11,100    │ [🗑️]    │           │
│  │ 5.1     │ 10      │ $14,600    │ [🗑️]    │           │
│  │ 10.1    │ 15      │ $16,700    │ [🗑️]    │           │
│  └─────────┴─────────┴────────────┴─────────┘           │
│  [+ Agregar Rango]                                      │
│                                                         │
│  Umbral para volumen: [50] cm                           │
└─────────────────────────────────────────────────────────┘
```

### 2. `InsuranceConfigDialog.tsx`

Configuración de seguro por tenant:

```text
┌─────────────────────────────────────────────────────────┐
│  CONFIGURACIÓN DE SEGURO                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Valor mínimo declarado:  [$40,000]                     │
│  Costo base del seguro:   [$2,400]                      │
│  Porcentaje excedente:    [6] %                         │
│  Valor máximo asegurado:  [$500,000]                    │
│                                                         │
│  ☑ Seguro obligatorio                                   │
│                                                         │
│  Ejemplo de cálculo:                                    │
│  Valor declarado $100,000:                              │
│  = $2,400 + ($60,000 × 6%) = $6,000                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3. `BulkRateUpdateDialog.tsx` (NUEVO)

Diálogo para aumento masivo:

```text
┌─────────────────────────────────────────────────────────┐
│  AJUSTE MASIVO DE TARIFAS                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Porcentaje de ajuste: [+15] %                          │
│                                                         │
│  Aplicar a:                                             │
│  ☑ Precio base de tarifas                               │
│  ☑ Rangos de peso (todos los rangos)                    │
│  ☑ Precio por m³                                        │
│  ☑ Precio por km                                        │
│  ☑ Conceptos de tarifa                                  │
│  ☐ Configuración de seguro                              │
│                                                         │
│  Tarifas a actualizar:                                  │
│  ◉ Todas las activas (5 tarifas)                        │
│  ○ Seleccionar manualmente                              │
│                                                         │
│  Motivo del ajuste:                                     │
│  [Ajuste por inflación Enero 2026_____________]         │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│  VISTA PREVIA                                           │
│  ─────────────────────────────────────────────────────  │
│  Tarifa      │ Campo        │ Actual   │ Nuevo          │
│  Estándar    │ Precio base  │ $11,100  │ $12,765        │
│  Estándar    │ 0-5 kg       │ $11,100  │ $12,765        │
│  Estándar    │ 5.1-10 kg    │ $14,600  │ $16,790        │
│  Express     │ Precio base  │ $15,000  │ $17,250        │
│  ...         │ ...          │ ...      │ ...            │
│                                                         │
│  [Cancelar]               [Aplicar Ajuste +15%]         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Archivos a Crear/Modificar

### Migración SQL (1)

| Archivo | Descripción |
|---------|-------------|
| Migración | Agregar campos a tarifas/envios, crear tablas seguro e historial |

### Componentes Nuevos (3)

| Archivo | Descripción |
|---------|-------------|
| `src/components/rates/WeightRangesEditor.tsx` | Editor de rangos kg |
| `src/components/rates/InsuranceConfigDialog.tsx` | Config de seguro |
| `src/components/rates/BulkRateUpdateDialog.tsx` | Aumento masivo |

### Archivos a Modificar (5)

| Archivo | Cambios |
|---------|---------|
| `src/pages/Rates.tsx` | Agregar botón "Ajustar Tarifas", editor de rangos |
| `src/pages/NewShipment.tsx` | Dimensiones separadas, cálculo automático |
| `src/components/rates/index.ts` | Exportar nuevos componentes |
| `supabase/functions/tiendanube-shipping-rates/index.ts` | Nueva lógica rangos |
| `src/pages/SystemSettings.tsx` | Link a config de seguro |

---

## Lógica del Aumento Masivo

```typescript
async function aplicarAumentoMasivo(
  porcentaje: number,
  opciones: {
    precioBase: boolean;
    rangosKg: boolean;
    precioM3: boolean;
    precioKm: boolean;
    conceptos: boolean;
    seguro: boolean;
  },
  tarifaIds: string[] | 'todas',
  motivo: string
) {
  const factor = 1 + (porcentaje / 100);
  
  // 1. Obtener tarifas a actualizar
  const tarifas = await obtenerTarifas(tarifaIds);
  
  // 2. Guardar historial (antes de modificar)
  await guardarHistorial(tarifas, porcentaje, motivo);
  
  // 3. Actualizar precio_base
  if (opciones.precioBase) {
    for (const tarifa of tarifas) {
      await supabase.from('tarifas').update({
        precio_base: tarifa.precio_base * factor
      }).eq('id', tarifa.id);
    }
  }
  
  // 4. Actualizar rangos_kg (JSONB)
  if (opciones.rangosKg) {
    for (const tarifa of tarifas) {
      const nuevosRangos = tarifa.rangos_kg.map(r => ({
        ...r,
        precio: Math.round(r.precio * factor)
      }));
      await supabase.from('tarifas').update({
        rangos_kg: nuevosRangos
      }).eq('id', tarifa.id);
    }
  }
  
  // 5. Actualizar conceptos
  if (opciones.conceptos) {
    await supabase.rpc('actualizar_conceptos_porcentaje', {
      p_factor: factor,
      p_tarifa_ids: tarifaIds
    });
  }
  
  // 6. Actualizar seguro (opcional)
  if (opciones.seguro) {
    await supabase.from('configuracion_seguro').update({
      seguro_base: seguroActual.seguro_base * factor,
      valor_minimo_declarado: seguroActual.valor_minimo * factor
    }).eq('tenant_id', tenantId);
  }
}
```

---

## Fórmulas de Cálculo

### Flete por Peso (Rangos)

```typescript
function calcularFletePorPeso(peso: number, rangos: RangoKg[]): number {
  const rango = rangos.find(r => peso >= r.desde && peso <= r.hasta);
  return rango?.precio ?? rangos[rangos.length - 1].precio;
}
```

### Flete por Volumen

```typescript
function calcularFletePorVolumen(
  alto: number, ancho: number, largo: number,
  precioBase: number, precioPorM3: number
): number {
  const volumenM3 = (alto / 100) * (ancho / 100) * (largo / 100);
  return precioBase + (volumenM3 * precioPorM3);
}
```

### Seguro

```typescript
function calcularSeguro(valorDeclarado: number, config: ConfigSeguro): number {
  const valorFinal = Math.min(
    Math.max(valorDeclarado, config.valor_minimo_declarado),
    config.valor_maximo_asegurado
  );
  
  if (valorFinal <= config.valor_minimo_declarado) {
    return config.seguro_base;
  }
  
  const excedente = valorFinal - config.valor_minimo_declarado;
  return config.seguro_base + (excedente * config.porcentaje_excedente / 100);
}
```

---

## Beneficios

| Característica | Beneficio |
|----------------|-----------|
| Rangos de peso | Precios escalonados precisos como en la imagen |
| Auto peso/volumen | Decide automáticamente el método más rentable |
| Seguro configurable | Mínimo, máximo y porcentaje ajustables |
| Aumento masivo | Actualizar todas las tarifas con un clic |
| Historial de ajustes | Trazabilidad de cambios de precios |

---

## Estimación de Tiempo

| Componente | Tiempo |
|------------|--------|
| Migración SQL | 20 min |
| WeightRangesEditor | 35 min |
| InsuranceConfigDialog | 25 min |
| BulkRateUpdateDialog | 40 min |
| Actualizar Rates.tsx | 30 min |
| Actualizar NewShipment.tsx | 40 min |
| Edge function TiendaNube | 20 min |
| **Total** | ~3.5 horas |

