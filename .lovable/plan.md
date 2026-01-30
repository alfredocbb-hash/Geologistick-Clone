
# Plan: Persistencia Automática de Formularios

## Problema
Cuando estás cargando datos en cualquier formulario (Nuevo Envío, Nuevo Cliente, etc.) y sales del sistema (cierras pestaña/navegador), al volver toda la información se pierde y debes comenzar de nuevo.

## Solución
Crear un sistema de **auto-guardado en borradores** que persista automáticamente los datos de formularios en el almacenamiento local del navegador. Los datos se recuperan al volver y se eliminan al guardar exitosamente.

---

## Implementación

### 1. Crear Hook Reutilizable `useFormDraft`

Crear un hook personalizado que:
- Guarda automáticamente los cambios del formulario en `localStorage`
- Recupera el borrador al cargar el componente
- Limpia el borrador cuando se guarda exitosamente
- Muestra indicador de "borrador recuperado"

```text
┌─────────────────────────────────────────────────────────────┐
│                    useFormDraft                              │
├─────────────────────────────────────────────────────────────┤
│  • formData: estado actual del formulario                   │
│  • setFormData: función para actualizar                     │
│  • hasDraft: boolean - hay borrador guardado                │
│  • clearDraft: limpiar borrador (al guardar exitoso)        │
│  • discardDraft: descartar y empezar de nuevo               │
│  • lastSaved: timestamp del último auto-guardado            │
└─────────────────────────────────────────────────────────────┘
```

### 2. Archivos a Crear/Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useFormDraft.ts` | **Nuevo** - Hook de persistencia |
| `src/pages/NewShipment.tsx` | Integrar hook para formulario de envíos |
| `src/pages/Clients.tsx` | Integrar hook para formulario de clientes |
| `src/components/ui/draft-indicator.tsx` | **Nuevo** - Indicador visual de borrador |

### 3. Formularios a Cubrir (Prioridad)

1. **Nuevo Envío** (`/shipments/new`) - Formulario más complejo
2. **Nuevo Cliente** (diálogo en `/clients`)
3. **Nueva Ruta** (planificador)
4. **Otras ventanas/diálogos** principales

---

## Comportamiento del Usuario

```text
┌─────────────────────────────────────────────────────────────┐
│               FLUJO DE AUTO-GUARDADO                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Usuario comienza a llenar formulario                    │
│     ↓                                                       │
│  2. Cada 2 segundos o al cambiar campo → guarda borrador    │
│     ↓                                                       │
│  3. Usuario cierra el navegador/sale                        │
│     ↓                                                       │
│  4. Usuario vuelve al formulario                            │
│     ↓                                                       │
│  5. Sistema detecta borrador guardado                       │
│     ↓                                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔄 Borrador recuperado                               │   │
│  │ Tienes datos sin guardar del 30/01 15:45            │   │
│  │                                                      │   │
│  │ [Continuar editando]  [Descartar y empezar nuevo]   │   │
│  └─────────────────────────────────────────────────────┘   │
│     ↓                                                       │
│  6. Usuario continúa o descarta                             │
│     ↓                                                       │
│  7. Al guardar exitosamente → borrador se elimina           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Detalles Técnicos

### Hook `useFormDraft`

```typescript
// Uso en NewShipment.tsx
const {
  formData,
  setFormData,
  hasDraft,
  clearDraft,
  discardDraft,
  lastSaved
} = useFormDraft('new-shipment', {
  // Valores iniciales
  remitente_nombre: '',
  destinatario_nombre: '',
  // ... resto de campos
});

// Al guardar exitosamente
onSuccess: () => {
  clearDraft(); // Elimina el borrador
  navigate('/shipments');
}
```

### Almacenamiento

- **Clave**: `draft_{formKey}_{userId}` (ej: `draft_new-shipment_abc123`)
- **Datos**: JSON con formData + timestamp
- **Duración**: 7 días (configurable)
- **Limpieza**: Automática al guardar o manualmente

### Indicador Visual

Pequeño badge que aparece cuando hay un borrador activo:
- Muestra "Borrador guardado" con timestamp
- Opción para descartar
- Se oculta al no haber cambios

---

## Consideraciones

- **Seguridad**: Los datos solo se guardan localmente, no en el servidor
- **Privacidad**: Se limpia automáticamente después de 7 días
- **Rendimiento**: Debounce de 2 segundos para no guardar en cada tecla
- **Multi-usuario**: Cada usuario tiene sus propios borradores (por userId)
- **Limpieza**: Opción manual para descartar borrador

---

## Resultado Esperado

- Al salir sin guardar y volver, el formulario muestra los datos que estabas cargando
- Notificación clara de que hay un borrador recuperado
- Opción de continuar o empezar de nuevo
- Sin pérdida de datos accidental
