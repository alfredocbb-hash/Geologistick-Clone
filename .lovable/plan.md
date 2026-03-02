
# Rediseno del formulario de Tarifas: de formulario de BD a herramienta logistica

## Resumen

Reemplazar el Dialog actual de creacion/edicion de tarifas (formulario largo con scroll, ~130 lineas de JSX) por un nuevo componente con:
1. Selector simplificado de tipo de calculo (Precio Fijo vs Por Peso)
2. Campos dinamicos claros con tooltips
3. Toggle de multiplicador con explicacion
4. Conceptos integrados en el mismo flujo
5. Calculadora sandbox lateral en tiempo real
6. Soporte Express con surcharge visual

No hay cambios de base de datos. Toda la logica de guardado (`saveMutation`) permanece intacta en `Rates.tsx`.

## Archivos a crear

### 1. `src/components/rates/CreateTarifaWizard.tsx`

Componente principal que reemplaza el contenido del Dialog. Layout en 2 columnas (formulario + sandbox).

**Columna izquierda - Formulario:**

- **Seccion 1: Como quieres cobrar?**
  - Dos cards grandes clicables: "Precio Fijo" y "Por Peso"
  - Si elige "Precio Fijo": solo muestra precio_base + nombre
  - Si elige "Por Peso": despliega peso_base_hasta, adicional_por_kg (mapeados a `rangos_precios`)
  - Los demas tipos (distancia, zona, codigo_postal, volumen) se ofrecen como "Avanzado" colapsable debajo

- **Seccion 2: Nombre + Precio Base**
  - Input nombre con tooltip: "Nombre descriptivo, ej: Envio Local Buenos Aires"
  - Input precio_base con tooltip: "Monto minimo por envio. Siempre se cobra como piso"

- **Seccion 3: Toggle multiplicador**
  - Switch `multiplicar_flete_por_bultos`
  - Texto claro: "Si se activa, el precio base se cobra por cada unidad/bulto del envio"

- **Seccion 4: Cargos Adicionales (Conceptos)**
  - Lista de conceptos activos del tenant con inputs de monto inline
  - Toggle % / $ para seguro
  - Tooltip: "Estos cargos se suman al flete base. Los basicos se cobran siempre"

- **Seccion 5: Express (colapsable)**
  - Campo `express_surcharge` presentado como "+ recargo sobre tarifa base"
  - Tooltip: "Este monto se agrega al precio final cuando el envio es express"

- **Seccion 6: Comision Chofer + Switch Activa**
  - Mismos campos actuales con tooltips

**Columna derecha - Calculadora Sandbox:**

- Inputs: "Peso de ejemplo (kg)" y "Cantidad de bultos"
- Replica exacta de la funcion `calculateRate` del backend
- Muestra desglose en tiempo real:

```text
Flete base:         $5,000
  x 3 bultos:       $15,000
Excedente peso:     $1,500
  (12kg - 5kg base) x $300/kg
Concepto Seguro:    $250 (2.5%)
Concepto Embalaje:  $800
--------------------------
Total estimado:     $17,550
```

- Se actualiza reactivamente al cambiar cualquier campo del formulario

### 2. `src/components/rates/TarifaSandbox.tsx`

Componente de la calculadora sandbox (columna derecha).

Props: `formData`, `conceptos` (los activos con sus montos configurados)

Logica interna: replica exacta de `calculateRate`:
```typescript
function simulateRate(formData, pesoEjemplo, cantidadBultos) {
  let precio = parseFloat(formData.precio_base) || 0;
  
  if (formData.multiplicar_flete_por_bultos && cantidadBultos > 1) {
    precio *= cantidadBultos;
  }
  
  if (formData.tipo_tarifa === 'peso') {
    const pesoBase = parseFloat(formData.peso_base_hasta) || 0;
    const adicional = parseFloat(formData.adicional_por_kg) || 0;
    if (pesoEjemplo > pesoBase) {
      precio += (pesoEjemplo - pesoBase) * adicional;
    }
  }
  
  // Sumar conceptos basicos
  // ...
  return { total, desglose };
}
```

### 3. `src/components/rates/FormTooltip.tsx`

Componente reutilizable: Label + icono HelpCircle + Tooltip de Shadcn.

```tsx
<FormTooltip 
  label="Precio Base" 
  tooltip="Monto minimo por envio. Se aplica siempre como piso del calculo"
  required 
/>
```

## Cambios en archivos existentes

### `src/pages/Rates.tsx`

- Lineas 1073-1216 (Dialog de creacion): reemplazar contenido con `<CreateTarifaWizard />`
- Ampliar Dialog a `max-w-4xl` para acomodar 2 columnas
- Pasar como props: `formData`, `setFormData`, `onSubmit`, `editingTarifa`, `conceptos`, `isPending`
- Eliminar funciones `renderRateTypeFields()` y `renderConceptPrices()` (se mueven al wizard)
- Smart defaults al abrir "Nueva Tarifa" (no edicion):
  - `precio_base`: "5000"
  - `tipo_tarifa`: "peso"
  - `peso_base_hasta`: "5"
  - `comision_chofer_porcentaje`: "10"

### `src/components/rates/index.ts`

- Agregar exports: `CreateTarifaWizard`, `TarifaSandbox`, `FormTooltip`

## Mapa de tooltips

| Campo | Tooltip |
|-------|---------|
| Nombre | Nombre descriptivo para identificar esta tarifa |
| Precio Base | Monto minimo por envio. Se aplica siempre como piso |
| Multiplicar x bultos | Si activo, el precio base se cobra por cada unidad del envio |
| Peso incluido en base | Kilogramos cubiertos por el precio base sin cargo adicional |
| Precio por Kg adicional | Cargo extra por cada kg que exceda el peso base |
| Precio por Km | Cargo por cada km de distancia entre origen y destino |
| Zona Origen/Destino | Ciudad o zona que define la ruta de esta tarifa |
| Comision chofer % | Porcentaje del total que se asigna al chofer |
| Comision chofer fija | Monto fijo por envio para el chofer |
| Recargo Express | Monto adicional que se suma al precio final en envios express |

## Consideraciones tecnicas

- No hay cambios de base de datos
- La logica de `saveMutation` no cambia, solo se reorganiza la UI
- Se reutilizan componentes existentes: `WeightRangesEditor`, `RateTypeSelector` (como fallback avanzado), Shadcn Switch/Input/Tooltip
- Responsive: en mobile las 2 columnas se apilan (sandbox debajo)
- El `RateTypeSelector` original se mantiene disponible dentro de una seccion "Modo avanzado" colapsable (Collapsible) para tipos distancia/zona/volumen/CP
