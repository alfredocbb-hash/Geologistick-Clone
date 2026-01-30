
# Plan: Integrar Persistencia de Borradores en Todos los Módulos

## Análisis Realizado

He revisado todos los módulos del sistema y encontré que actualmente solo **2 formularios** tienen el hook `useFormDraft` implementado:

| ✅ Ya implementado | Archivo |
|-------------------|---------|
| Nuevo Envío | `src/pages/NewShipment.tsx` |
| Nuevo Cliente | `src/pages/Clients.tsx` |

---

## Módulos que Necesitan Implementación

### Prioridad Alta (Formularios Complejos)

| Módulo | Archivo | Campos Principales |
|--------|---------|-------------------|
| **Tarifas** | `src/pages/Rates.tsx` | nombre, precio_base, rangos, conceptos |
| **Sucursales** | `src/pages/Branches.tsx` | nombre, dirección, horarios, configuraciones |
| **Usuarios** | `src/pages/Users.tsx` | nombre, email, rol, sucursal, comisiones |
| **Vehículos** | `src/pages/Vehicles.tsx` | patente, marca, modelo, capacidad |
| **Empresas Terciarizadas** | `src/pages/ThirdPartyCompanies.tsx` | nombre, CUIT, dirección, cuenta corriente |
| **Planificador de Rutas** | `src/pages/RoutePlanner.tsx` | envíos seleccionados, chofer, vehículo, fecha |

### Prioridad Media (Diálogos con Datos Importantes)

| Módulo | Archivo | Tipo |
|--------|---------|------|
| **Crear Seller** | `src/components/ecommerce/CreateSellerDialog.tsx` | Dialog con react-hook-form |
| **Crear Tenant** | `src/components/tenants/CreateTenantDialog.tsx` | Dialog con react-hook-form |
| **Envíos Terciarizados** | `src/components/routes/ThirdPartyShipmentsTab.tsx` | Tab con formulario largo |
| **Importar Envíos (CSV)** | `src/components/import/ImportShipmentsDialog.tsx` | Dialog multi-step |

### Prioridad Baja (Formularios Simples o Solo Lectura)

| Módulo | Razón de Exclusión |
|--------|-------------------|
| `Drivers.tsx` | Solo vista, sin formulario de creación |
| `Routes.tsx` | Asignación rápida, no necesita persistencia |
| `SellerShipments.tsx` | Solo filtros y vista |

---

## Implementación por Módulo

### 1. Tarifas (`src/pages/Rates.tsx`)

```typescript
const {
  formData,
  setFormData,
  clearDraft,
  discardDraft,
  isDraftRecovered,
  setIsDraftRecovered,
  lastSaved,
  hasDraft,
} = useFormDraft('new-tarifa', {
  nombre: '',
  precio_base: 0,
  tipo_tarifa: 'base',
  multiplicar_flete_por_bultos: false,
  // ... resto de campos iniciales
});
```

### 2. Sucursales (`src/pages/Branches.tsx`)

```typescript
const {
  formData,
  setFormData,
  clearDraft,
  discardDraft,
  isDraftRecovered,
  setIsDraftRecovered,
} = useFormDraft('new-sucursal', {
  nombre: '',
  direccion: '',
  codigo: '',
  telefono: '',
  email: '',
  // ... resto de campos
});
```

### 3. Usuarios (`src/pages/Users.tsx`)

```typescript
const {
  formData,
  setFormData,
  clearDraft,
  discardDraft,
  isDraftRecovered,
  setIsDraftRecovered,
} = useFormDraft('new-user', {
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  role: 'operador',
  // ... comisiones
});
```

### 4. Vehículos (`src/pages/Vehicles.tsx`)

```typescript
const {
  formData: form,
  setFormData: setForm,
  clearDraft,
  discardDraft,
  isDraftRecovered,
  setIsDraftRecovered,
} = useFormDraft('new-vehicle', defaultForm);
```

### 5. Empresas Terciarizadas (`src/pages/ThirdPartyCompanies.tsx`)

```typescript
const {
  formData,
  setFormData,
  clearDraft,
  discardDraft,
  isDraftRecovered,
  setIsDraftRecovered,
} = useFormDraft('new-third-party', {
  codigo: '',
  nombre: '',
  razon_social: '',
  cuit: '',
  // ... resto
});
```

### 6. Planificador de Rutas (`src/pages/RoutePlanner.tsx`)

```typescript
// Persistir selección de envíos, chofer, vehículo y fecha
const {
  formData: routeConfig,
  setFormData: setRouteConfig,
  clearDraft,
  discardDraft,
  isDraftRecovered,
  setIsDraftRecovered,
} = useFormDraft('route-planner', {
  selectedEnvios: [],
  selectedChofer: '',
  selectedVehiculo: '',
  routeDate: format(new Date(), "yyyy-MM-dd"),
  routeStartTime: '09:00',
});
```

### 7. Crear Seller (`CreateSellerDialog.tsx`)

Este usa `react-hook-form`, necesita adaptación especial:

```typescript
// Crear un wrapper que sincroniza react-hook-form con localStorage
useEffect(() => {
  const subscription = form.watch((values) => {
    // Guardar en localStorage con debounce
  });
  return () => subscription.unsubscribe();
}, [form.watch]);
```

### 8. Envíos Terciarizados (`ThirdPartyShipmentsTab.tsx`)

```typescript
const {
  formData,
  setFormData,
  clearDraft,
  discardDraft,
  isDraftRecovered,
  setIsDraftRecovered,
} = useFormDraft('third-party-shipments', emptyForm);
```

---

## Cambios Visuales por Módulo

Agregar en cada formulario:

1. **Indicador de borrador recuperado** (DraftIndicator)
2. **Indicador de guardado automático** (DraftSavingIndicator)
3. **Limpiar borrador al cerrar diálogo en modo edición**

Ejemplo de integración visual:

```tsx
{/* En el header del diálogo o sección del formulario */}
{isDraftRecovered && (
  <DraftIndicator 
    lastSaved={lastSaved} 
    onDiscard={discardDraft}
    onDismiss={() => setIsDraftRecovered(false)}
    className="mb-4"
  />
)}

{/* En el footer o cerca del botón guardar */}
<DraftSavingIndicator hasDraft={hasDraft} lastSaved={lastSaved} />
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Rates.tsx` | Integrar useFormDraft + indicadores |
| `src/pages/Branches.tsx` | Integrar useFormDraft + indicadores |
| `src/pages/Users.tsx` | Integrar useFormDraft + indicadores |
| `src/pages/Vehicles.tsx` | Integrar useFormDraft + indicadores |
| `src/pages/ThirdPartyCompanies.tsx` | Integrar useFormDraft + indicadores |
| `src/pages/RoutePlanner.tsx` | Integrar useFormDraft + indicadores |
| `src/components/ecommerce/CreateSellerDialog.tsx` | Adaptar para react-hook-form |
| `src/components/tenants/CreateTenantDialog.tsx` | Adaptar para react-hook-form |
| `src/components/routes/ThirdPartyShipmentsTab.tsx` | Integrar useFormDraft |

---

## Consideraciones Especiales

### Para Diálogos de Edición

Cuando se edita un registro existente (no nuevo), el borrador debe:
- **No recuperarse** (se cargan los datos del registro)
- **No guardarse** (para no mezclar con datos de creación)

```typescript
// Lógica para detectar modo edición
useEffect(() => {
  if (editingItem) {
    discardDraft(); // Limpiar borrador anterior
    setFormData(editingItem); // Cargar datos del item
  }
}, [editingItem]);
```

### Para react-hook-form

Crear un hook auxiliar `useFormDraftWithRHF`:

```typescript
export function useFormDraftWithRHF<T>(
  formKey: string,
  form: UseFormReturn<T>,
  initialValues: T
) {
  // Sincronizar valores del form con localStorage
  // Restaurar al montar si hay borrador
}
```

---

## Resultado Esperado

- Al salir y volver a cualquier formulario, los datos se recuperan automáticamente
- Notificación clara de borrador recuperado con opción de descartar
- Guardado automático cada 2 segundos (con debounce)
- Los borradores expiran después de 7 días
- Cada usuario tiene sus propios borradores (por userId)
- Al guardar exitosamente, el borrador se elimina

```text
┌─────────────────────────────────────────────────────────────┐
│  MÓDULOS CON PERSISTENCIA DE BORRADORES                     │
├─────────────────────────────────────────────────────────────┤
│  ✅ Nuevo Envío                                             │
│  ✅ Nuevo Cliente                                           │
│  ⏳ Tarifas                                                 │
│  ⏳ Sucursales                                              │
│  ⏳ Usuarios                                                │
│  ⏳ Vehículos                                               │
│  ⏳ Empresas Terciarizadas                                  │
│  ⏳ Planificador de Rutas                                   │
│  ⏳ Crear Seller (E-commerce)                               │
│  ⏳ Crear Tenant (Super Admin)                              │
│  ⏳ Envíos Terciarizados                                    │
└─────────────────────────────────────────────────────────────┘
```
