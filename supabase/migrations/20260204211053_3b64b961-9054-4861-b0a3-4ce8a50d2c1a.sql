-- Create table for caching processed route segments
CREATE TABLE public.driver_route_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ruta_id UUID REFERENCES public.rutas_planificadas(id) ON DELETE CASCADE,
  chofer_id UUID NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  raw_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapped_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  points_hash TEXT NOT NULL,
  total_distance NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index for cache lookup
CREATE UNIQUE INDEX idx_driver_route_segments_lookup 
ON public.driver_route_segments(ruta_id, chofer_id, points_hash);

-- Create index for tenant queries
CREATE INDEX idx_driver_route_segments_tenant 
ON public.driver_route_segments(tenant_id);

-- Enable RLS
ALTER TABLE public.driver_route_segments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant isolation
CREATE POLICY "Users can view route segments for their tenant"
ON public.driver_route_segments
FOR SELECT
USING (
  tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert route segments for their tenant"
ON public.driver_route_segments
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update route segments for their tenant"
ON public.driver_route_segments
FOR UPDATE
USING (
  tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete route segments for their tenant"
ON public.driver_route_segments
FOR DELETE
USING (
  tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_driver_route_segments_updated_at
BEFORE UPDATE ON public.driver_route_segments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();