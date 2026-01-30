

# Plan: Mejoras en Tarifas de Envio y Conceptos

## Resumen de Problemas Identificados

| # | Problema | Archivo Principal |
|---|----------|-------------------|
| 1 | Super admin no puede eliminar tarifas | `src/pages/Rates.tsx` |
| 2 | Cálculo de precio no usa rangos de peso escalonados | `src/pages/NewShipment.tsx` |
| 3 | Seguro mínimo no tiene valor por defecto en el formulario | `src/pages/NewShipment.tsx` |
| 4 | Falta asociar tarifas a sucursales | Nueva tabla + dialogo |
| 5 | Tarifa debe auto-seleccionarse | `src/pages/NewShipment.tsx` |

---

## Cambios Técnicos Detallados

### 1. Agregar Botón de Eliminar Tarifa (Super Admin)

**Archivo:** `src/pages/Rates.tsx`

**Cambios:**
- Agregar mutation `deleteTarifaMutation` para eliminar tarifas
- Agregar botón de eliminar (Trash2) en cada tarjeta de tarifa
- Solo visible para `super_admin`
- Confirmar antes de eliminar

```typescript
// Nueva mutation
const deleteTarifaMutation = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase.from('tarifas').delete().eq('id', id);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['tarifas'] });
    toast.success('Tarifa eliminada');
  },
});

// En el render, agregar botón junto a Edit (solo super_admin)
{isSuperAdmin() && (
  <Button
    variant="ghost"
    size="icon"
    onClick={() => {
      if (confirm('¿Eliminar esta tarifa?')) {
        deleteTarifaMutation.mutate(tarifa.id);
      }
    }}
  >
    <Trash2 className="h-4 w-4 text-destructive" />
  </Button>
)}
```

---

### 2. Corregir Cálculo de Precio con Rangos de Peso

**Archivo:** `src/pages/NewShipment.tsx`

**Problema actual:** El cálculo en `precioCalculado` solo usa `rangos_precios` (método simple), ignorando `rangos_kg` (rangos escalonados).

**Cambios en `precioCalculado` useMemo:**

```typescript
const precioCalculado = useMemo(() => {
  if (!selectedTarifa) return 0;
  
  const peso = parseFloat(formData.peso_kg) || 0;
  const precioBase = Number(selectedTarifa.precio_base) || 0;
  const rangosKg = (selectedTarifa as any).rangos_kg || [];
  const rangos = (selectedTarifa as any).rangos_precios || {};
  
  let flete = precioBase;
  
  if (selectedTarifa.tipo_tarifa === 'peso') {
    // PRIORIDAD 1: Usar rangos_kg escalonados si existen
    if (rangosKg.length > 0 && peso > 0) {
      const rangoAplicable = rangosKg.find(
        (r: { desde: number; hasta: number; precio: number }) => 
          peso >= r.desde && peso <= r.hasta
      );
      if (rangoAplicable) {
        flete = rangoAplicable.precio;
      } else if (peso > rangosKg[rangosKg.length - 1]?.hasta) {
        // Si excede todos los rangos, usar el último precio
        flete = rangosKg[rangosKg.length - 1]?.precio || precioBase;
      }
    } 
    // PRIORIDAD 2: Usar método simple si no hay rangos_kg
    else {
      const pesoBaseHasta = rangos.peso_base_hasta || 0;
      const adicionalPorKg = rangos.adicional_por_kg || 0;
      if (peso > pesoBaseHasta) {
        flete += (peso - pesoBaseHasta) * adicionalPorKg;
      }
    }
    
    // Verificar umbral de volumen para cobrar por m3
    const dimensiones = formData.dimensiones;
    if (dimensiones) {
      const dims = dimensiones.split('x').map(d => parseFloat(d.trim()));
      const umbral = (selectedTarifa as any).umbral_volumen_cm || 50;
      const precioM3 = Number(selectedTarifa.precio_por_m3) || 0;
      
      if (dims.some(d => d > umbral) && precioM3 > 0) {
        // Calcular volumen en m3
        const volumen = dims.reduce((a, b) => a * b, 1) / 1000000;
        flete = precioBase + (volumen * precioM3);
      }
    }
  }
  // ... resto del código para distancia/volumen
}, [selectedTarifa, formData, ...]);
```

**También actualizar el Resumen de Precio** para mostrar los rangos correctamente.

---

### 3. Valor Mínimo de Seguro por Defecto

**Archivo:** `src/pages/NewShipment.tsx`

**Cambios:**
- Agregar query para obtener `configuracion_seguro`
- Cuando el usuario deja vacío "Valor Declarado", usar el valor mínimo para el cálculo del seguro

```typescript
// Nueva query
const { data: configSeguro } = useQuery({
  queryKey: ['configuracion_seguro', profile?.tenant_id],
  queryFn: async () => {
    const { data } = await supabase
      .from('configuracion_seguro')
      .select('*')
      .eq('tenant_id', profile?.tenant_id)
      .maybeSingle();
    return data;
  },
  enabled: !!profile?.tenant_id,
});

// En el cálculo de conceptos, para el concepto "seguro":
const valorDeclaradoEfectivo = parseFloat(formData.valor_declarado) || 
  configSeguro?.valor_minimo_declarado || 0;
```

**Agregar placeholder en el input:**
```tsx
<Input
  id="valor_declarado"
  type="number"
  min="0"
  value={formData.valor_declarado}
  onChange={(e) => handleChange('valor_declarado', e.target.value)}
  placeholder={configSeguro ? `Mínimo: ${configSeguro.valor_minimo_declarado}` : ''}
/>
```

---

### 4. Asociar Tarifas a Sucursales

**Paso 4.1: Crear nueva tabla `sucursal_tarifas`**

```sql
CREATE TABLE public.sucursal_tarifas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  tarifa_id UUID NOT NULL REFERENCES tarifas(id) ON DELETE CASCADE,
  habilitada BOOLEAN DEFAULT true,
  tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sucursal_id, tarifa_id)
);

-- RLS
ALTER TABLE public.sucursal_tarifas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON sucursal_tarifas
  FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant() OR current_user_is_super_admin());

-- Trigger para updated_at
CREATE TRIGGER update_sucursal_tarifas_updated_at
  BEFORE UPDATE ON sucursal_tarifas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Paso 4.2: Crear componente `TarifaBranchesDialog.tsx`**

Similar a `ConceptBranchesDialog.tsx`, pero para tarifas:

```typescript
// src/components/rates/TarifaBranchesDialog.tsx
export function TarifaBranchesDialog({
  open,
  onOpenChange,
  tarifaId,
  tarifaNombre,
}: Props) {
  // Fetch sucursales
  // Fetch sucursal_tarifas para esta tarifa
  // Toggle habilitación por sucursal
  // Guardar cambios
}
```

**Paso 4.3: Agregar botón en Rates.tsx**

Agregar icono `Building2` junto a cada tarifa para gestionar sucursales:

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => handleOpenTarifaBranches(tarifa)}
  title="Gestionar sucursales"
>
  <Building2 className="h-4 w-4" />
</Button>
```

---

### 5. Auto-seleccionar Tarifa en Nuevo Envío

**Archivo:** `src/pages/NewShipment.tsx`

**Cambios:**

**Paso 5.1: Filtrar tarifas por sucursal del usuario**

```typescript
// Query modificada
const { data: tarifasHabilitadas = [] } = useQuery({
  queryKey: ['sucursal-tarifas', sucursalOrigenId],
  queryFn: async () => {
    if (!sucursalOrigenId) return [];
    const { data, error } = await supabase
      .from('sucursal_tarifas')
      .select('tarifa_id, tarifas(*)')
      .eq('sucursal_id', sucursalOrigenId)
      .eq('habilitada', true);
    if (error) throw error;
    return data.map(st => st.tarifas).filter(Boolean);
  },
  enabled: !!sucursalOrigenId,
});

// Fallback: si no hay asignaciones, mostrar todas las tarifas activas
const tarifasDisponibles = tarifasHabilitadas.length > 0 
  ? tarifasHabilitadas 
  : tarifas;
```

**Paso 5.2: Auto-seleccionar si solo hay 1**

```typescript
useEffect(() => {
  if (tarifasDisponibles.length === 1 && !formData.tarifa_id) {
    handleChange('tarifa_id', tarifasDisponibles[0].id);
  }
}, [tarifasDisponibles, formData.tarifa_id]);
```

**Paso 5.3: Ocultar selector si solo hay 1 tarifa**

```tsx
{tarifasDisponibles.length > 1 && (
  <div className="space-y-2">
    <Label htmlFor="tarifa_id">Tarifa</Label>
    <Select ...>
      {/* ... */}
    </Select>
  </div>
)}
{tarifasDisponibles.length === 1 && (
  <div className="p-3 bg-muted/50 rounded-lg">
    <p className="text-sm">
      <strong>Tarifa:</strong> {tarifasDisponibles[0].nombre} - 
      {formatCurrency(tarifasDisponibles[0].precio_base)}
    </p>
  </div>
)}
```

---

## Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `src/pages/Rates.tsx` | Agregar delete mutation + botón eliminar + botón sucursales |
| `src/pages/NewShipment.tsx` | Corregir cálculo peso + auto-select tarifa + seguro mínimo |
| `src/components/rates/TarifaBranchesDialog.tsx` | **CREAR** - Gestionar sucursales por tarifa |
| `src/components/rates/index.ts` | Agregar export de TarifaBranchesDialog |
| Migración SQL | Crear tabla `sucursal_tarifas` + RLS |

---

## Flujo de Usuario Esperado

1. **Admin crea tarifa** en /rates
2. **Admin asigna sucursales** que pueden usar esa tarifa (nuevo botón Building2)
3. **Super admin puede eliminar** tarifas (nuevo botón Trash2)
4. **Operador crea envío**:
   - Sistema filtra tarifas habilitadas para su sucursal
   - Si solo hay 1, se auto-selecciona y no muestra selector
   - Si hay 2+, muestra selector
   - El valor declarado muestra el mínimo como placeholder
   - El precio se calcula correctamente usando rangos escalonados

