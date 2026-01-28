-- Tabla para contenido de landing page
CREATE TABLE IF NOT EXISTS landing_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL UNIQUE,
  content jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE landing_content ENABLE ROW LEVEL SECURITY;

-- Lectura pública (landing es pública)
CREATE POLICY "Anyone can view landing content"
  ON landing_content FOR SELECT
  USING (true);

-- Solo super_admin puede modificar
CREATE POLICY "Super admins can manage landing content"
  ON landing_content FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Insertar contenido inicial
INSERT INTO landing_content (section, content) VALUES
('hero', '{
  "badge_text": "Plataforma #1 de Logística en Argentina",
  "title_line1": "El futuro de la",
  "title_line2": "logística inteligente",
  "description": "Transforma tu operación con tecnología de punta. Optimización de rutas con IA, tracking en tiempo real y automatización total.",
  "cta_primary": "Comenzar gratis",
  "cta_secondary": "Explorar features",
  "stats": [
    { "value": "+50K", "label": "Envíos/mes", "icon": "Package" },
    { "value": "99.9%", "label": "Uptime", "icon": "Shield" },
    { "value": "< 2s", "label": "Tiempo respuesta", "icon": "Zap" }
  ]
}'::jsonb),
('features', '{
  "badge_text": "Potenciado por tecnología de punta",
  "title": "Todo lo que necesitas para escalar tu operación",
  "subtitle": "Herramientas profesionales diseñadas para empresas que quieren dominar la logística del futuro.",
  "contact_text": "¿Necesitas una integración especial?",
  "contact_cta": "Hablemos de tu caso"
}'::jsonb),
('general', '{
  "trial_days": 14,
  "trial_text": "14 días gratis en todos los planes",
  "pricing_title": "Precios transparentes",
  "pricing_subtitle": "Sin sorpresas ni costos ocultos. Escala cuando lo necesites.",
  "currency_label": "ARS",
  "contact_email": "soporte@tuapp.com"
}'::jsonb);