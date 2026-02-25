

# Restringir Cards Flex a ecommerce habilitado + rol admin

## Resumen

Mostrar las cards "Guia Envios Flex" y "Terminos Flex" en la pagina de Configuracion del Sistema unicamente cuando:
1. El tenant tiene `ecommerce_enabled = true`
2. El usuario tiene rol `admin` o `super_admin`

## Cambio tecnico

| Archivo | Accion | Descripcion |
|---|---|---|
| `src/pages/SystemSettings.tsx` | Modificar | Importar `useAuth` de `@/lib/auth`. Usar `isAdmin()` y `tenant?.ecommerce_enabled` para envolver condicionalmente las dos Cards de Flex (Guia y Terminos) |

### Detalle

1. Agregar `import { useAuth } from '@/lib/auth'`
2. Dentro del componente, obtener `const { isAdmin } = useAuth()`
3. Crear una variable `const showFlexCards = isAdmin() && tenant?.ecommerce_enabled === true`
4. Envolver las dos Cards (Guia Envios Flex y Terminos Flex) con `{showFlexCards && (...)}`

No se requieren cambios en la base de datos ni en otros archivos.
