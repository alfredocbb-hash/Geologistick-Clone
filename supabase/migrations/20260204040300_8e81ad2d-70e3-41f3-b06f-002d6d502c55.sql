-- Add foreign key constraint for chofer_id → profiles.user_id
ALTER TABLE public.incidentes 
ADD CONSTRAINT incidentes_chofer_id_fkey 
FOREIGN KEY (chofer_id) REFERENCES public.profiles(user_id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS incidentes_chofer_id_idx ON public.incidentes(chofer_id);