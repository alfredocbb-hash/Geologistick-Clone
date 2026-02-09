

# Modulo de Reportes y Analisis

## Alcance de acceso
Solo visible para **Admin** y **Super Admin**. Se agrega el permiso `reports.view` al sidebar.

## Archivos a crear

### `src/pages/Reports.tsx`
Pagina principal con:
- **Filtros globales** en la parte superior: selector de rango de fechas con presets (Hoy, Ultima Semana, Ultimo Mes, Ultimo Trimestre) y filtro opcional por sucursal
- **4 tabs** usando el componente Tabs existente:

**Tab 1 - Envios por Sucursal:**
- Grafico de barras horizontal (recharts BarChart) con cantidad de envios por sucursal
- Tabla: Sucursal, Total, Entregados, Pendientes, Cancelados, % Efectividad
- Query agrupa por `sucursal_origen_id` cruzando con tabla `sucursales`

**Tab 2 - Destinos:**
- Grafico de barras con las ciudades mas frecuentes
- Tabla: Ciudad, Provincia, Cantidad, Ingresos Totales
- Query agrupa por `ciudad_entrega` y `provincia` de `envios`

**Tab 3 - Rendimiento de Choferes:**
- Tabla ranking: Chofer, Total Envios, Entregados, No Entregados, % Efectividad, Tiempo Promedio
- Grafico de barras comparativo
- Tiempo promedio calculado con `envio_historial` (diferencia entre "en_reparto" y "entregado")
- Cruza `envios.chofer_id` con `profiles`

**Tab 4 - Resumen General:**
- 4 KPI cards: Total envios, Tasa entrega, Tiempo promedio, Ingresos totales
- Grafico de lineas con evolucion diaria de envios
- Grafico circular de distribucion por estado

- Boton "Exportar PDF" en cada tab usando `jsPDF`

### `src/hooks/useReportsData.ts`
Hook que centraliza todas las queries con `@tanstack/react-query`:
- Recibe filtros (fechas, sucursal opcional) como parametros
- Retorna datos para cada tab: `enviosPorSucursal`, `destinos`, `rendimientoChoferes`, `resumenGeneral`
- Filtra siempre por `tenant_id` (patron existente con `useTenant`)

## Archivos a modificar

### `src/App.tsx`
- Importar `Reports` desde `./pages/Reports`
- Agregar ruta `<Route path="/reports" element={<DashboardLayout><Reports /></DashboardLayout>} />`

### `src/components/layout/AppSidebar.tsx`
- Agregar item en el grupo "Principal" (debajo de Dashboard):
  ```
  { title: 'Reportes', url: '/reports', icon: BarChart3, permissionKey: 'reports.view' }
  ```
- Agregar `'reports.view'` al array `permissionKeys` del grupo Principal
- Importar `BarChart3` de lucide-react

## Migracion SQL
- Insertar el permiso `reports.view` en `role_permissions` para los roles `admin` habilitado por defecto

## Sin dependencias nuevas
Se usa `recharts`, `jsPDF`, `@tanstack/react-query`, `date-fns` y componentes UI existentes (Card, Tabs, Table, Badge, Select, Skeleton).

