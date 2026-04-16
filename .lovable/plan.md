

## Plan: Eliminar remontaje del DashboardLayout al navegar

### Problema raíz
Cada ruta está definida así:
```
<Route path="/shipments" element={<DashboardLayout><Shipments /></DashboardLayout>} />
<Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
```

Esto crea una **nueva instancia** de `DashboardLayout` por ruta. Al cambiar de módulo, React desmonta todo el layout (sidebar, header, auth, subscription check, SidebarProvider) y lo vuelve a montar desde cero. Esa es la causa del delay.

### Solución
Usar **layout routes** de React Router: un `<Route>` padre con `<DashboardLayout>` que renderiza un `<Outlet />`, y las rutas hijas solo cambian el contenido interno.

```text
Antes:
  /shipments → <DashboardLayout><Shipments /></DashboardLayout>  (instancia A)
  /dashboard → <DashboardLayout><Dashboard /></DashboardLayout>  (instancia B) ← remonta todo

Después:
  <Route element={<DashboardLayout />}>     ← se monta UNA vez
    /shipments → <Shipments />               ← solo cambia el contenido
    /dashboard → <Dashboard />
  </Route>
```

### Cambios

**1. `src/components/layout/DashboardLayout.tsx`**
- Cambiar de `children: ReactNode` a usar `<Outlet />` de React Router
- El componente deja de recibir children y renderiza `<Outlet />` en el `<main>`

**2. `src/App.tsx`**
- Agrupar todas las rutas protegidas bajo un `<Route element={<DashboardLayout />}>` padre
- Las rutas que necesitan `GoogleMapsProvider` lo envuelven individualmente en su page element
- Eliminar `<DashboardLayout>...</DashboardLayout>` de cada ruta individual (~40 rutas)

### Ejemplo del resultado en App.tsx
```tsx
{/* Protected Routes with shared layout */}
<Route element={<DashboardLayout />}>
  <Route path="/dashboard" element={<GoogleMapsProvider><Dashboard /></GoogleMapsProvider>} />
  <Route path="/shipments" element={<Shipments />} />
  <Route path="/reports" element={<Reports />} />
  <Route path="/clients" element={<Clients />} />
  {/* ... todas las demás rutas protegidas */}
</Route>
```

### Impacto
- La sidebar, header, trial banner y auth checks se ejecutan **una sola vez**
- Al navegar entre módulos, solo cambia el contenido del `<main>`
- La transición se siente instantánea
- Cero cambio en UI o lógica de negocio

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/DashboardLayout.tsx` | Reemplazar `children` por `<Outlet />` |
| `src/App.tsx` | Agrupar rutas protegidas bajo layout route padre |

