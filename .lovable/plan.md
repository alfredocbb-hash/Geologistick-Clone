
## Diagnóstico confirmado (con evidencia)

Do I know what the issue is? **Sí**.

El problema del QR no es solo visual: hay un desfasaje real en los datos que se codifican.

1. La factura reportada (`ad4111c6-83c5-46b8-8c26-2ac546292d25`) está `emitida`, con CAE y monto correcto.
2. En DB, `fecha_emision` está guardada como `2026-03-02 00:00:00+00`.
3. En Argentina eso se interpreta como **2026-03-01** al convertir con `new Date(...)` en frontend.
4. `PrintInvoice` hoy usa esa conversión local para:
   - mostrar la fecha en pantalla
   - construir `fecha` dentro del JSON del QR
5. Resultado: el QR termina con fecha **01/03/2026**, pero el comprobante autorizado en ARCA corresponde al día **02/03/2026**.  
   Esto explica el “CAE no existe / datos no válidos” al constatar.
6. Además, el banner “DOCUMENTO NO FISCAL - SANDBOX” sigue saliendo porque `PrintInvoice` toma entorno desde `arca_config`, y en este proyecto esa tabla tiene solo `sandbox`, mientras la integración activa real se gestiona en `system_integrations`.

## Archivos implicados

- `src/pages/PrintInvoice.tsx`
- `supabase/functions/arca-factura/index.ts`

## Plan de corrección

### 1) Corregir fecha fiscal del QR y de la vista previa (sin desfase horario)
**Archivo:** `src/pages/PrintInvoice.tsx`

- Crear helper para fecha fiscal estable (sin timezone drift), usando el valor date-only:
  - tomar `factura.fecha_emision?.slice(0, 10)` como fuente principal.
- Usar esa fecha:
  - en el JSON del QR (`fecha`)
  - en la fecha mostrada en el encabezado de la factura.
- Evitar `format(new Date(factura.fecha_emision), ...)` directo sobre timestamp con zona cuando el campo representa fecha fiscal.

Impacto esperado: el QR de esa factura pasará de `2026-03-01` a `2026-03-02`.

---

### 2) Separar “entorno de emisión” de “datos de emisor” en impresión
**Archivo:** `src/pages/PrintInvoice.tsx`

- Dejar de decidir `isSandbox` con `arca_config.environment`.
- Leer estado de ARCA desde `system_integrations` (source of truth actual para sandbox/production).
- Regla:
  - si la factura trae entorno persistido (ver paso 3), usarlo;
  - si no lo trae:
    - si solo hay un entorno completo configurado, usar ese;
    - si hay ambos, marcar como “entorno no determinable” (no etiquetar automáticamente como sandbox).
- Mantener `arca_config` solo como fallback para datos de cabecera (razón social/condición IVA) mientras exista.

Impacto esperado: dejar de mostrar “NO FISCAL” por falsos positivos.

---

### 3) Persistir metadatos de emisión para trazabilidad futura
**Archivo:** `supabase/functions/arca-factura/index.ts`

- Al emitir, guardar en `facturas.arca_response`:
  - `environment` real usado (`sandbox`/`production`)
  - `fecha_comprobante` enviada a WSFE (`CbteFch`)
- Ajustar creación/actualización para que `fecha_emision` se derive explícitamente de la fecha fiscal usada en la emisión (misma fuente de verdad del QR).

Esto evita ambigüedad histórica y elimina adivinanzas al reimprimir.

---

### 4) Endurecimiento de QR (compatibilidad)
**Archivo:** `src/pages/PrintInvoice.tsx`

- Mantener formato RG 4291/2018 y codificación Base64 del JSON.
- Encapsular `p=` con `encodeURIComponent(...)` para evitar problemas de transporte URL en casos con caracteres Base64 especiales.
- Conservar estructura exacta de campos requerida por ARCA.

---

## Validación funcional (end-to-end)

1. Reabrir `/print-invoice?factura_id=ad4111c6-83c5-46b8-8c26-2ac546292d25`.
2. Verificar que la fecha visible del comprobante sea **02/03/2026**.
3. Escanear QR desde esa vista (y PDF) y constatar en ARCA.
4. Confirmar que ya no aparezca el error genérico de “CAE no existe / datos incompletos”.
5. Probar también una factura sandbox real para validar que el comportamiento de advertencia sigue siendo correcto.

## Riesgo y alcance

- No requiere migración estructural para resolver este caso.
- Cambio acotado a impresión + metadatos de emisión en función backend.
- Riesgo bajo: no modifica lógica de autorización del CAE, solo coherencia de datos mostrados/codificados.
