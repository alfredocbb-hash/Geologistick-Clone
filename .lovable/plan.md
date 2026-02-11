

# Modo Flex solo para choferes

## Problema

Cuando se activa `modo_flex` en un tenant, **todos los usuarios** ven la pantalla de Modo Flex al ir a la pestaña "Scan" en la app movil. El comportamiento correcto es que solo los usuarios con rol `chofer` usen Modo Flex; los demas roles (operador, bodega, sucursal) deben seguir viendo el escaneo estandar (`MobileScanTab`).

## Solucion

Un cambio simple en una sola linea del archivo `MobileAppLayout.tsx`.

### Archivo: `src/components/mobile/MobileAppLayout.tsx` (linea 121)

Cambiar la condicion de:

```
tenant?.modo_flex ? <FlexScanScreen /> : <MobileScanTab />
```

A:

```
tenant?.modo_flex && userRole === 'chofer' ? <FlexScanScreen /> : <MobileScanTab />
```

La variable `userRole` ya existe en el componente (linea 64) y se calcula a partir de `hasRole('chofer')`. Esto garantiza que:

- **Chofer** con modo flex activo -> ve `FlexScanScreen`
- **Operador/Bodega/Sucursal** con modo flex activo -> ve `MobileScanTab` (escaneo estandar)
- **Cualquier rol** sin modo flex -> ve `MobileScanTab`

## Sin cambios de base de datos
No se necesitan migraciones.

