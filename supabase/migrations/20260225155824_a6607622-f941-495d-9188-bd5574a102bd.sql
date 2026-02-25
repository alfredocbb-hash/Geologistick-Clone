
ALTER TABLE ruta_paradas ALTER COLUMN envio_id DROP NOT NULL;
ALTER TABLE ruta_paradas ADD COLUMN sucursal_id UUID REFERENCES sucursales(id);
ALTER TABLE ruta_paradas ADD COLUMN nombre_parada TEXT;
ALTER TABLE ruta_paradas ADD CONSTRAINT chk_envio_or_sucursal CHECK (envio_id IS NOT NULL OR sucursal_id IS NOT NULL);
