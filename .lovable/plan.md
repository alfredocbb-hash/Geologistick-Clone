
# Plan: Validar Caja Abierta para Crear Envíos

## Problema Identificado

Actualmente los usuarios pueden crear envíos aunque no haya una sesión de caja abierta en su sucursal. Esto impide el correcto control de efectivo, ya que los pagos en efectivo deben registrarse en una caja activa.

## Solución

Agregar una validación en el formulario de nuevo envío que verifique si existe una caja abierta para la sucursal del usuario antes de permitir la creación del envío.

---

## Cambios a Realizar

| Archivo | Cambio |
|---------|--------|
| `src/pages/NewShipment.tsx` | Agregar query para verificar caja abierta + validación en handleSubmit + alerta visual |

---

## Detalles Técnicos

### 1. Query para verificar caja abierta

Agregar una nueva query que busque una sesión de caja con estado "abierta" para la sucursal del usuario:

```typescript
const { data: cajaAbierta, isLoading: loadingCaja } = useQuery({
  queryKey: ['caja-abierta', sucursalOrigenId],
  queryFn: async () => {
    if (!sucursalOrigenId) return null;
    
    const { data, error } = await supabase
      .from('sesiones_caja')
      .select('id, sucursal_id')
      .eq('sucursal_id', sucursalOrigenId)
      .eq('estado', 'abierta')
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  enabled: !!sucursalOrigenId,
});
```

### 2. Validación en handleSubmit

Agregar validación al inicio de `handleSubmit`:

```typescript
// Validar que haya caja abierta
if (!cajaAbierta) {
  toast({
    title: 'No hay caja abierta',
    description: 'Debes abrir una sesión de caja antes de crear envíos.',
    variant: 'destructive',
  });
  return;
}
```

### 3. Alerta visual cuando no hay caja

Mostrar un banner de alerta en la parte superior del formulario cuando no hay caja abierta:

```typescript
{!cajaAbierta && !loadingCaja && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>
      No hay caja abierta en tu sucursal. 
      <Button variant="link" onClick={() => navigate('/cash')}>
        Ir a Control de Caja
      </Button>
    </AlertDescription>
  </Alert>
)}
```

---

## Flujo de Usuario

```text
Usuario intenta crear envío
        │
        ▼
┌───────────────────────┐
│  ¿Hay caja abierta?   │
└───────────────────────┘
        │
   No   │   Sí
   ─────┼──────
        │          │
        ▼          ▼
   Mostrar      Permitir
   alerta y     crear
   bloquear     envío
```

---

## Resultado Esperado

| Situación | Antes | Después |
|-----------|-------|---------|
| Sin caja abierta | Permite crear envío (sin control) | Bloquea con mensaje claro y link a Control de Caja |
| Con caja abierta | Permite crear envío | Permite crear envío (sin cambios) |

---

## Consideraciones

- La validación aplica a la sucursal específica del usuario (`sucursalOrigenId`)
- El botón "Crear Envío" podría deshabilitarse visualmente cuando no hay caja
- Se proporciona un acceso directo para abrir la caja desde el mismo formulario
