

# Plan: Agregar "mercadolibre" al Enum de Integraciones

## Problema Identificado

Cuando el administrador de Beraexpress intenta guardar las credenciales de MercadoLibre, aparece el error:

```
invalid input value for enum integration_type: "mercadolibre"
```

**Causa**: El código del frontend incluye `mercadolibre` como tipo de integración válido, pero el enum `integration_type` en la base de datos no tiene ese valor.

## Valores Actuales del Enum

| Valor en DB | Estado |
|-------------|--------|
| mercado_pago | Existe |
| google_maps | Existe |
| whatsapp | Existe |
| email_smtp | Existe |
| sms | Existe |
| arca | Existe |
| tiendanube | Existe |
| mercadolibre | **FALTA** |

## Solución

Ejecutar una migración SQL para agregar el valor `mercadolibre` al enum `integration_type`.

### Migración SQL

```sql
-- Agregar 'mercadolibre' al enum integration_type
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'mercadolibre';
```

---

## Detalles Técnicos

- El enum `integration_type` se usa en la tabla `system_integrations` para clasificar las diferentes integraciones por tenant
- Una vez agregado el valor, los administradores podrán guardar las credenciales de MercadoLibre sin errores
- No requiere cambios en el código frontend, ya que `mercadolibre` ya está definido en el tipo TypeScript

## Impacto

| Antes | Después |
|-------|---------|
| Error al guardar credenciales MercadoLibre | Guardado exitoso |
| Integración MercadoLibre no funcional | Integración completamente operativa |

## Archivo a Crear

| Archivo | Cambio |
|---------|--------|
| Migración SQL | `ALTER TYPE integration_type ADD VALUE 'mercadolibre'` |

