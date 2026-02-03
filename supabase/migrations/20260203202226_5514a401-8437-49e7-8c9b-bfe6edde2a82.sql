-- Parte 1.1: Agregar campos de configuracion fiscal a sucursales
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS incluye_iva boolean DEFAULT false;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS porcentaje_iva numeric DEFAULT 21;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS tipo_liquidacion text DEFAULT 'diferida';

-- Agregar constraint para tipo_liquidacion (solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sucursales_tipo_liquidacion_check'
  ) THEN
    ALTER TABLE sucursales ADD CONSTRAINT sucursales_tipo_liquidacion_check 
      CHECK (tipo_liquidacion IN ('inmediata', 'diferida'));
  END IF;
END $$;

-- Parte 1.2: Agregar campo base_comision a sucursal_comisiones
ALTER TABLE sucursal_comisiones ADD COLUMN IF NOT EXISTS base_comision text DEFAULT 'total';

-- Agregar constraint para base_comision (solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sucursal_comisiones_base_comision_check'
  ) THEN
    ALTER TABLE sucursal_comisiones ADD CONSTRAINT sucursal_comisiones_base_comision_check 
      CHECK (base_comision IN ('flete', 'neto', 'total'));
  END IF;
END $$;

-- Parte 1.3: Insertar concepto "Recepcion" si no existe
INSERT INTO tarifa_conceptos (nombre, codigo, activo, es_basico, orden, descripcion)
SELECT 'Recepción', 'recepcion', true, true, 12, 'Servicio de recepción de envíos en sucursal'
WHERE NOT EXISTS (SELECT 1 FROM tarifa_conceptos WHERE codigo = 'recepcion');

-- Insertar concepto "Cobros/Cobranzas" si no existe
INSERT INTO tarifa_conceptos (nombre, codigo, activo, es_basico, orden, descripcion)
SELECT 'Cobros', 'cobros', true, true, 13, 'Comisión por gestión de cobros'
WHERE NOT EXISTS (SELECT 1 FROM tarifa_conceptos WHERE codigo = 'cobros');