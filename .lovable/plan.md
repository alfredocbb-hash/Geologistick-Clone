
# Auto-selección de Tarifa para BlackBox - Destino + Precio por Peso/M3

## Objetivo

Cuando el tenant tiene la feature flag `auto_seleccion_tarifa_por_zona` activa, el sistema:
1. Selecciona la tarifa automáticamente según la ciudad/CP del destinatario
2. Calcula el importe automáticamente en cuanto el usuario ingresa el peso y/o las dimensiones
3. El usuario NO ve el selector de tarifa ni puede cambiarlo

El precio ya se calcula automáticamente mediante la lógica existente (`fleteCalculado`) una vez que hay tarifa seleccionada, peso y dimensiones ingresados. Lo que falta es la **auto-selección** y el **panel de solo lectura**.

---

## Lógica de Selección Automática

La tarifa se elige por **destino** (prioridad 1). El precio por peso/m3 se aplica automáticamente desde la lógica de `fleteCalculado` que ya existe.

Si hay múltiples tarifas que coinciden con la misma zona destino, el sistema puede usar peso como criterio de desempate: selecciona la tarifa cuyo rango de kg (rangos_kg) incluye el peso ingresado.

### Algoritmo por prioridad:

```text
1. Filtrar tarifas con tipo_tarifa = 'zona' que coincidan con la ciudad/CP del destinatario
   -> Si hay exactamente 1 coincidencia: seleccionarla
   -> Si hay múltiples: usar el peso para desempatar via rangos_kg
   -> Si ninguna: buscar en tipo_tarifa = 'codigo_postal'
   -> Si aún ninguna: dejar vacío y mostrar aviso

2. Una vez seleccionada la tarifa, el precio se calcula automáticamente
   (la lógica existente ya maneja peso, rangos_kg, dimensiones/m3)
```

---

## Cambios en `src/pages/NewShipment.tsx`

### 1. Importar `useTenant`

```typescript
import { useTenant } from '@/hooks/useTenant';
```

### 2. Usar el hook y leer la feature flag

Dentro del componente `NewShipment`, agregar:

```typescript
const { tenant } = useTenant();
const autoSeleccionPorZona = !!(tenant?.configuracion as any)?.auto_seleccion_tarifa_por_zona;
```

### 3. Agregar estado de tracking

```typescript
const [tarifaFueAutoDetectada, setTarifaFueAutoDetectada] = useState(false);
```

### 4. Funciones auxiliares (fuera del componente)

```typescript
function normalizarTexto(str: string): string {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function encontrarTarifaPorDestino(
  ciudad: string | null,
  cp: string | null,
  peso: number,
  tarifas: any[]
): any | null {
  if (!ciudad && !cp) return null;
  const ciudadNorm = ciudad ? normalizarTexto(ciudad) : '';
  const cpTrim = cp?.trim() || '';

  // 1. Tarifas tipo 'zona'
  const coincidentesZona = tarifas.filter(t => {
    if (t.tipo_tarifa !== 'zona' || !t.zona_destino) return false;
    const destinos = t.zona_destino.split(',').map((d: string) => normalizarTexto(d.trim()));
    if (ciudadNorm && destinos.some((d: string) => d.includes(ciudadNorm) || ciudadNorm.includes(d))) return true;
    if (cpTrim && destinos.some((d: string) => d === cpTrim)) return true;
    return false;
  });

  if (coincidentesZona.length === 1) return coincidentesZona[0];

  // Desempate por peso si hay múltiples zonas coincidentes
  if (coincidentesZona.length > 1 && peso > 0) {
    const porPeso = coincidentesZona.find(t => {
      const rangos = Array.isArray(t.rangos_kg) ? t.rangos_kg : [];
      return rangos.some((r: any) => peso >= r.desde && peso <= r.hasta);
    });
    if (porPeso) return porPeso;
    return coincidentesZona[0]; // fallback al primero
  }

  if (coincidentesZona.length > 0) return coincidentesZona[0];

  // 2. Tarifas tipo 'codigo_postal'
  const coincidentesCP = tarifas.filter(t => {
    if (t.tipo_tarifa !== 'codigo_postal' || !t.zona_destino) return false;
    const destinos = t.zona_destino.split(',').map((d: string) => d.trim());
    return cpTrim && destinos.includes(cpTrim);
  });

  if (coincidentesCP.length > 0) return coincidentesCP[0];

  return null;
}
```

### 5. useEffect de auto-selección

El efecto se dispara cuando cambia **ciudad**, **CP** o **peso** del destinatario. De esta forma, si el usuario ingresa el peso después de la ciudad, el sistema puede refinar la selección de tarifa (desempate por peso):

```typescript
useEffect(() => {
  if (!autoSeleccionPorZona || !tarifasDisponibles.length) return;

  const peso = parseFloat(formData.peso_kg) || 0;
  const match = encontrarTarifaPorDestino(
    formData.destinatario_ciudad,
    formData.destinatario_codigo_postal,
    peso,
    tarifasDisponibles
  );

  if (match) {
    setFormData(prev => ({ ...prev, tarifa_id: match.id }));
    setTarifaFueAutoDetectada(true);
  } else {
    setTarifaFueAutoDetectada(false);
    // No limpiar tarifa_id si ya había una seleccionada manualmente
  }
}, [
  formData.destinatario_ciudad,
  formData.destinatario_codigo_postal,
  formData.peso_kg,
  tarifasDisponibles,
  autoSeleccionPorZona
]);
```

### 6. UI: Reemplazar el bloque del selector de tarifa

El bloque actual en líneas ~2070-2131 se reemplaza con lógica condicional:

**Cuando `autoSeleccionPorZona` está activo:**

- Si se detectó tarifa (`tarifaFueAutoDetectada`): mostrar panel informativo con:
  - Nombre de la tarifa
  - Método de cálculo aplicado (peso/m3/base)
  - Precio del flete calculado (si ya ingresó peso/dimensiones)
  - Sin botón de cambio manual

- Si NO se detectó tarifa (destino no coincide con ninguna zona): mostrar aviso para que complete la ciudad del destinatario

```
┌─────────────────────────────────────────────────────────┐
│  Tarifa                                                 │
│  ✓ Zona 2 - Quilmes y Florencio Varela                 │
│  Flete calculado por peso (5kg): $7,370                │
│  Las dimensiones se verifican al confirmar el envío    │
└─────────────────────────────────────────────────────────┘

O si no hay coincidencia:

┌─────────────────────────────────────────────────────────┐
│  ⚠ Ingrese la ciudad del destinatario                  │
│    para calcular el precio automáticamente             │
└─────────────────────────────────────────────────────────┘
```

**Cuando `autoSeleccionPorZona` está inactivo:** comportamiento actual sin cambios.

---

## Base de datos: Activar la feature flag para BlackBox

Ejecutar el siguiente SQL en la base de datos para activar la feature exclusivamente en el tenant BlackBox Cargas:

```sql
UPDATE tenants
SET configuracion = jsonb_set(
  COALESCE(configuracion, '{}'),
  '{auto_seleccion_tarifa_por_zona}',
  'true'
)
WHERE id = '81be07a7-73a0-4986-994e-5365478343eb';
```

---

## Archivos a modificar

- **`src/pages/NewShipment.tsx`**: agregar funciones auxiliares, import de `useTenant`, estado `tarifaFueAutoDetectada`, leer feature flag, `useEffect` de auto-selección (dispara con ciudad, CP y peso), y actualizar bloque UI del selector de tarifa.

---

## Nota importante sobre M3

El cálculo por m3/volumen ya funciona automáticamente en la lógica existente de `fleteCalculado`: cuando las dimensiones exceden el umbral configurado en la tarifa (`umbral_volumen_cm`), el sistema cobra por m3 en lugar de por kg. Esto se aplica automáticamente sobre la tarifa ya seleccionada. No requiere cambios adicionales.

---

## Flujo completo para BlackBox

```text
Operador ingresa:
  1. Tipo de servicio
  2. Remitente
  3. Destinatario + ciudad "Quilmes"
     → Sistema detecta: "Zona 2 - Quilmes y Florencio Varela" ✓
  4. Peso: 5 kg
     → Precio flete se calcula: $7,370 (por rango de kg)
  5. Dimensiones: 60x40x30 (excede umbral)
     → Precio cambia automáticamente a cálculo por m3
  6. Confirmación → Pago
```
