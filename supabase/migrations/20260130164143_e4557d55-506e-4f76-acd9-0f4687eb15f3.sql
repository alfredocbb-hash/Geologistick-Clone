-- Add created_by column to track who created each tarifa
ALTER TABLE tarifas ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);