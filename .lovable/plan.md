

## Plan: Comisiones por concepto en Partnerships + PDF de Acuerdo Comercial entre Partners

### Objetivo
Al crear una asociación, el solicitante puede configurar porcentajes de comisión por concepto de tarifa (como en las liquidaciones de sucursales). Además, al crearse la asociación, se genera un PDF de acuerdo comercial entre ambas empresas.

---

### 1. Migración: Tabla `partner_comisiones`

Nueva tabla para almacenar los porcentajes de comisión acordados entre partners, similar a `sucursal_comisiones`:

```sql
CREATE TABLE public.partner_comisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES public.tenant_partners(id) ON DELETE CASCADE,
  concepto_id UUID NOT NULL REFERENCES public.tarifa_conceptos(id) ON DELETE CASCADE,
  porcentaje_contado NUMERIC DEFAULT 0 CHECK (porcentaje_contado >= 0 AND porcentaje_contado <= 100),
  porcentaje_destino NUMERIC DEFAULT 0 CHECK (porcentaje_destino >= 0 AND porcentaje_destino <= 100),
  porcentaje_cta_cte NUMERIC DEFAULT 0 CHECK (porcentaje_cta_cte >= 0 AND porcentaje_cta_cte <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partnership_id, concepto_id)
);

ALTER TABLE public.partner_comisiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver comisiones de partnership"
ON public.partner_comisiones FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_partners tp
    WHERE tp.id = partnership_id
    AND public.current_user_tenant() IN (tp.tenant_a_id, tp.tenant_b_id)
  )
);

CREATE POLICY "Admin gestiona comisiones de partnership"
ON public.partner_comisiones FOR ALL TO authenticated
USING (public.current_user_is_admin());

CREATE TRIGGER update_partner_comisiones_updated_at
  BEFORE UPDATE ON public.partner_comisiones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

### 2. UI: Diálogo "Nueva Asociación" ampliado (`src/pages/Partners.tsx`)

Agregar al diálogo de creación de partnership, después de seleccionar la empresa:
- Fetch de los `tarifa_conceptos` activos del tenant solicitante
- Tabla editable con columnas: Concepto | % Contado | % Destino | % Cta Cte
- Cada fila permite ingresar los porcentajes (default 0)

Al enviar la solicitud, los porcentajes se guardan en `partner_comisiones` junto con la solicitud.

---

### 3. Edge Function `partner-sync` actualizada

En la acción `request_partnership`:
- Recibir `comisiones: Array<{ concepto_id, porcentaje_contado, porcentaje_destino, porcentaje_cta_cte }>` en el body
- Después de insertar el partnership, insertar los registros en `partner_comisiones`

---

### 4. Tabla de partnerships: ver/editar comisiones

En la tabla de asociaciones existente:
- Agregar botón "Comisiones" (ícono Percent) para partnerships activas
- Abre un diálogo que muestra/edita las comisiones configuradas
- Permite guardar cambios vía upsert directo a `partner_comisiones`

---

### 5. PDF de Acuerdo Comercial entre Partners

Nuevo generador `src/lib/generatePartnerAgreementPDF.ts`:
- Reutiliza los helpers de `pdfHelpers.ts` (cover, header, footer)
- Contenido:
  - Portada: "Acuerdo de Alianza Comercial"
  - Partes: Empresa A y Empresa B
  - Tabla de comisiones acordadas por concepto (% contado, destino, cta cte)
  - Cláusula de derivación de envíos
  - Condiciones generales y vigencia
  - Espacios de firma

Botón "Descargar Acuerdo" en la tabla de partnerships (solo para activas), que genera el PDF con los datos de ambas empresas y las comisiones.

---

### 6. Hook `usePartners` actualizado

- Agregar query para obtener `partner_comisiones` por partnership
- Agregar mutation para guardar comisiones (upsert)
- Agregar función para generar el PDF pasando los datos del partnership + comisiones

