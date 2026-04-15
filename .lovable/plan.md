

## Plan: Auto-completado de datos fiscales por CUIT

### Objetivo
Cuando el usuario ingresa un CUIT válido en el formulario de facturación, el sistema debe:
1. Buscar en `clientes` (campo `dni_cuit`) y `empresas_terciarizadas` (campo `cuit`) del mismo tenant
2. Si encuentra coincidencia, auto-completar nombre/razón social, domicilio y condición IVA
3. Si el registro existente tiene datos faltantes (ej: `condicion_iva`, `razon_social`, `direccion`), actualizarlos al emitir la factura
4. Si no existe en ninguna tabla, guardar los datos del receptor para futuras facturas

### Cambios

**`src/components/invoicing/InvoiceDataDialog.tsx`**
- Agregar efecto que, al detectar un CUIT válido (11 dígitos), consulte `clientes` y `empresas_terciarizadas` por ese CUIT dentro del tenant del usuario
- Si encuentra match: auto-completar `nombre`, `domicilio`, `condicionIva` con los datos existentes. Mostrar badge indicando origen ("Cliente" o "Empresa Terciarizada")
- Al emitir/guardar la factura exitosamente: si el registro origen tiene campos vacíos (`razon_social`, `condicion_iva`, `direccion`), actualizarlos con los datos ingresados en el formulario
- Si no existe en ninguna tabla: no crear registro nuevo automáticamente (solo se usan los datos para la factura)

**`src/pages/Facturacion.tsx`**
- Aplicar la misma lógica de auto-completado en el `InvoiceFormFields` del formulario de facturación manual y batch

### Detalle técnico
- La búsqueda se hace con `formatCUIT(cuit)` normalizado para matchear ambos formatos (con y sin guiones)
- Se busca primero en `clientes.dni_cuit`, luego en `empresas_terciarizadas.cuit`
- El update de datos faltantes usa `.update()` condicional: solo campos que estén `null` o vacíos en el registro original
- Se necesita `useAuth()` para obtener `profile.tenant_id` y filtrar por tenant

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/invoicing/InvoiceDataDialog.tsx` | Lookup por CUIT + auto-fill + update datos faltantes al emitir |
| `src/pages/Facturacion.tsx` | Misma lógica en InvoiceFormFields |

