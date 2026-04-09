
-- Table to track collection events
CREATE TABLE public.colectas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chofer_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  cantidad_envios integer NOT NULL DEFAULT 0,
  envio_ids uuid[] NOT NULL DEFAULT '{}',
  source text DEFAULT 'scan',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.colectas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can insert own colectas"
  ON public.colectas FOR INSERT TO authenticated
  WITH CHECK (chofer_id = auth.uid());

CREATE POLICY "Drivers can view own colectas"
  ON public.colectas FOR SELECT TO authenticated
  USING (
    chofer_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR tenant_id = public.current_user_tenant()
  );

CREATE INDEX idx_colectas_chofer_date ON public.colectas (chofer_id, created_at DESC);

-- Exchange columns on envios
ALTER TABLE public.envios
  ADD COLUMN IF NOT EXISTS es_cambio boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS envio_cambio_id uuid REFERENCES public.envios(id);
