

# Alertas de exceso de limites por tenant

## Problema

Cuando una empresa supera los limites de su plan (ej: BlackBox tiene 14/10 sucursales, 15/15 usuarios), no hay ninguna alerta visual ni para el super admin en la tabla de empresas, ni en el detalle. Las barras de progreso simplemente se llenan pero no cambian de color ni muestran advertencia.

## Cambios propuestos

### 1. Tabla de Empresas (`src/pages/Tenants.tsx`)

- Colorear en rojo los conteos que excedan el limite (ej: "14/10" en rojo)
- Colorear en amarillo/naranja los que esten al 100% (ej: "15/15")
- Agregar una nueva stats card "Excedidas" que cuente tenants con al menos un limite superado
- Agregar un icono de alerta (triangulo) junto a los valores excedidos

### 2. Detalle del Tenant (`src/components/tenants/TenantDetailsDialog.tsx`)

- Cambiar color de las barras de progreso: verde normal, amarillo al 80%+, rojo al 100%+
- Mostrar un banner/alerta en la parte superior cuando hay limites excedidos
- Agregar texto descriptivo "Excede el limite" cuando el uso supera el maximo

### 3. Agregar envios/mes a la tabla de Tenants

Actualmente la tabla solo muestra usuarios y sucursales. Agregar columna de envios del mes para tener visibilidad completa (requiere contar envios del mes actual por tenant en la query).

## Detalle tecnico

| Archivo | Cambio |
|---|---|
| `src/pages/Tenants.tsx` | Agregar logica de color en celdas de usuarios/sucursales, nueva stats card "Excedidas", contar envios del mes |
| `src/components/tenants/TenantDetailsDialog.tsx` | Barras de progreso con colores segun porcentaje, banner de alerta cuando hay exceso |

### Logica de colores

```text
 Uso < 80%   -->  texto normal, barra verde/primary
 80% <= Uso < 100%  -->  texto amarillo, barra amarillo
 Uso >= 100%  -->  texto rojo + icono alerta, barra roja
```

### Stats card nueva en Tenants.tsx

Se agrega una card "Excedidas" que cuenta tenants donde `usuarios_count > max_usuarios` OR `sucursales_count > max_sucursales`. Esto da visibilidad inmediata al super admin.

### Envios del mes en la tabla

Se agrega al fetch de cada tenant un conteo de `envios` del mes actual (`gte created_at` del primer dia del mes) para mostrarlo en la tabla y detectar excesos tambien en envios.
