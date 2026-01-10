-- Add coordinates columns to sucursales
ALTER TABLE public.sucursales ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8);
ALTER TABLE public.sucursales ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8);

-- Add coordinates and distance columns to envios
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS remitente_lat DECIMAL(10, 8);
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS remitente_lng DECIMAL(11, 8);
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS destinatario_lat DECIMAL(10, 8);
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS destinatario_lng DECIMAL(11, 8);
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS distancia_km DECIMAL(10, 2);

-- Add coordinates columns to clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8);