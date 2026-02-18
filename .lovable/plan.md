
# Agregar toggle "Auto-selección de Tarifa por Zona" en el panel de administración de tenants

## Situación actual

La feature flag `auto_seleccion_tarifa_por_zona` se activa manualmente con SQL, modificando el campo `configuracion` (JSONB) en la tabla `tenants`. Esto funciona pero requiere acceso directo a la base de datos cada vez que un nuevo tenant quiere activarlo.

El panel de edición de tenants (`EditTenantDialog`) ya tiene este patrón para otras features:
- "Módulo e-Commerce" → toggle → guarda en columna `ecommerce_enabled`
- "Modo Flex" → toggle → guarda en columna `modo_flex`

La diferencia es que `auto_seleccion_tarifa_por_zona` vive dentro del objeto `configuracion` (JSONB), no como columna directa.

---

## Cambios en `src/components/tenants/EditTenantDialog.tsx`

### 1. Leer el valor actual de la flag al abrir el dialog

```typescript
const [autoSeleccionTarifaEnabled, setAutoSeleccionTarifaEnabled] = useState(
  !!((tenant as any).configuracion?.auto_seleccion_tarifa_por_zona)
);
```

Y resetear en el `useEffect` cuando cambia el tenant:

```typescript
setAutoSeleccionTarifaEnabled(!!((tenant as any).configuracion?.auto_seleccion_tarifa_por_zona));
```

### 2. Guardar en `onSubmit` usando `jsonb_set` via Supabase

En el bloque `update`, se agrega el campo `configuracion` haciendo merge con el valor actual:

```typescript
configuracion: {
  ...((tenant as any).configuracion || {}),
  auto_seleccion_tarifa_por_zona: autoSeleccionTarifaEnabled
}
```

Esto preserva cualquier otra key que exista en `configuracion` y solo modifica la flag.

### 3. Agregar el toggle en el formulario

Debajo del toggle de "Modo Flex", se agrega:

```tsx
{/* Auto-selección de Tarifa Toggle */}
<div className="flex items-center justify-between rounded-lg border p-4">
  <div>
    <Label className="text-base font-medium">Auto-selección de Tarifa</Label>
    <p className="text-sm text-muted-foreground">
      Selecciona la tarifa automáticamente según el destino, peso y volumen del envío
    </p>
  </div>
  <Switch
    checked={autoSeleccionTarifaEnabled}
    onCheckedChange={setAutoSeleccionTarifaEnabled}
  />
</div>
```

---

## Resultado

Desde el panel de administración, en **Empresas → Editar empresa**, aparecerá el nuevo toggle:

```
┌──────────────────────────────────────────────────────┐
│  Auto-selección de Tarifa                  [●  ON]  │
│  Selecciona la tarifa automáticamente según         │
│  el destino, peso y volumen del envío               │
└──────────────────────────────────────────────────────┘
```

Al guardarlo, el campo `configuracion` del tenant se actualiza con `auto_seleccion_tarifa_por_zona: true/false`, activando o desactivando la feature para ese tenant sin necesidad de ejecutar SQL.

---

## Archivos a modificar

- **`src/components/tenants/EditTenantDialog.tsx`**: agregar estado `autoSeleccionTarifaEnabled`, resetearlo en el `useEffect`, incluirlo en el payload del `update`, y agregar el toggle en el formulario.
