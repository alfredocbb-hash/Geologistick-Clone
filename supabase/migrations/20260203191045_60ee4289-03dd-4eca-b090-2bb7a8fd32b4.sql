-- Create trigger to sync ecommerce_orders status when envios estado changes
-- The function already exists from a previous migration, just need to create the trigger

CREATE TRIGGER trigger_sync_ecommerce_order_status
AFTER UPDATE OF estado ON envios
FOR EACH ROW
EXECUTE FUNCTION sync_ecommerce_order_status();