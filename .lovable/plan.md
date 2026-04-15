

## Plan: Ocultar selector de entorno ARCA para el usuario final

### Problema
El selector Sandbox/Producción se muestra al usuario cuando ambos entornos están configurados. Para el usuario final esto no tiene sentido — debe usar siempre Producción si está disponible, y solo Sandbox si no hay Producción.

### Lógica actual
`hasBothEnvironments` ya existe en `useARCAIntegration` y el selector solo aparece cuando es `true`. El hook ya prioriza el entorno preferido. El problema es que el toggle y el texto "(Producción)" / "(Sandbox)" se exponen al usuario.

### Cambios

**3 archivos** — eliminar el selector de entorno y simplificar el mensaje de estado:

**`src/components/invoicing/InvoiceDataDialog.tsx`**
- Eliminar el bloque `{hasBothEnvironments && ...}` con los botones Sandbox/Producción
- Simplificar el Alert a solo mostrar "ARCA configurado – {razon_social}" sin mencionar el entorno
- Eliminar el state `selectedEnvironment` (usar siempre `'production'` como preferido, el hook ya hace fallback a sandbox)

**`src/components/invoicing/EmitirFacturaDialog.tsx`**
- Mismos cambios: eliminar selector y simplificar mensaje

**`src/pages/Facturacion.tsx`**
- Mismos cambios en el componente `ARCAStatus()`
- Eliminar el state `selectedEnvironment`

### Resultado
- El usuario solo ve: ✅ "ARCA configurado – Beraexpress"
- El sistema usa producción si está configurado, sandbox como fallback automático
- Sin opciones técnicas expuestas al usuario final

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/invoicing/InvoiceDataDialog.tsx` | Quitar selector entorno + simplificar alert |
| `src/components/invoicing/EmitirFacturaDialog.tsx` | Quitar selector entorno + simplificar alert |
| `src/pages/Facturacion.tsx` | Quitar selector entorno + simplificar alert |

