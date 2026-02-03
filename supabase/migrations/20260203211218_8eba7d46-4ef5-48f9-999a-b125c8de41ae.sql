-- Agregar campo tipo_rol a sucursal_comisiones para distinguir emisión vs recepción
ALTER TABLE sucursal_comisiones 
ADD COLUMN IF NOT EXISTS tipo_rol text DEFAULT 'emision';

-- Agregar check constraint
ALTER TABLE sucursal_comisiones
DROP CONSTRAINT IF EXISTS sucursal_comisiones_tipo_rol_check;

ALTER TABLE sucursal_comisiones
ADD CONSTRAINT sucursal_comisiones_tipo_rol_check 
CHECK (tipo_rol IN ('emision', 'recepcion'));

-- Eliminar constraint único existente (es constraint, no index)
ALTER TABLE sucursal_comisiones 
DROP CONSTRAINT IF EXISTS sucursal_comisiones_sucursal_id_concepto_id_key;

-- Crear nuevo índice único que incluya tipo_rol
CREATE UNIQUE INDEX IF NOT EXISTS sucursal_comisiones_unique_rol 
ON sucursal_comisiones (sucursal_id, concepto_id, tipo_rol);