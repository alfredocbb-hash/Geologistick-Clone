

## Plan: Duplicar Factura + Sincronización desde AFIP

### 1. Agregar pestaña de Facturas Emitidas con acción Duplicar

**Archivo**: `src/pages/Facturacion.tsx`

Agregar un sistema de tabs (Pendientes | Emitidas) a la página existente.

**Tab "Emitidas"**:
- Consulta `facturas` del tenant con estado `emitida`, ordenadas por fecha.
- Tabla con columnas: Nro Comprobante, Tipo, Receptor, CUIT, Fecha, Total, CAE, Acciones.
- Filtro por búsqueda (receptor, nro comprobante).
- Botón **"Duplicar"** en cada fila (DropdownMenu o botón directo).

**Lógica de Duplicar**:
- Al hacer clic, abre el dialog de facturación (mismo formulario del lote) pero precargado con los datos de la factura original: `receptor_nombre`, `receptor_cuit`, `receptor_condicion_iva`, `receptor_domicilio`, `tipo_comprobante`, `importe_total`.
- Todos los campos son editables antes de emitir.
- Al confirmar, invoca `arca-factura` como una factura nueva (sin `envio_id` asociado, o con uno nuevo si se selecciona).

---

### 2. Sincronización desde AFIP (Importación)

**Archivo**: `supabase/functions/arca-factura/index.ts`

Agregar nueva acción `sync_from_afip` al handler principal:

- Usa el token WSAA existente (con caché).
- Llama a `FECompConsultar` de WSFEv1 para consultar comprobantes por rango de número.
- Lógica: obtener `FECompUltimoAutorizado` para saber el último número, luego comparar con los `numero_comprobante` existentes en tabla `facturas`. Para cada número faltante, consultar `FECompConsultar` y crear el registro en `facturas` con estado `emitida` y flag `importada: true`.

Nueva función SOAP `consultarComprobante()`:
```
SOAPAction: FECompConsultar
Params: PtoVta, CbteTipo, CbteNro
Returns: DocTipo, DocNro, ImpTotal, ImpNeto, ImpIVA, CbteFch, CAE, CAEFchVto
```

**Frontend** (en `Facturacion.tsx`):
- Botón "Sincronizar desde AFIP" en la tab de Emitidas.
- Al hacer clic, invoca `arca-factura` con `action: 'sync_from_afip'`.
- Muestra progreso y resultado (X facturas importadas).

---

### 3. Columna `importada` en tabla `facturas`

**Migración SQL**:
```sql
ALTER TABLE public.facturas ADD COLUMN importada BOOLEAN DEFAULT false;
```

Permite distinguir facturas emitidas desde Geologistick vs importadas desde AFIP.

---

### Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| Migración SQL | Agregar columna `importada` a `facturas` |
| `supabase/functions/arca-factura/index.ts` | Agregar acción `sync_from_afip` + función `consultarComprobante` |
| `src/pages/Facturacion.tsx` | Tabs (Pendientes/Emitidas), tabla de emitidas, duplicar, botón sync |

