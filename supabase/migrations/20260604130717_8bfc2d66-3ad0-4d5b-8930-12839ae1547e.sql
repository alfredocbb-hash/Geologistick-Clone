UPDATE public.envios
SET foto_entrega = 'https://uhlgimnmfifmrxraorrl.supabase.co/storage/v1/object/public/delivery-photos/e70c5c96-fc42-4afa-b03d-6996c87468d2/epod-UFGVBF.jpg',
    entrega_lat = COALESCE(entrega_lat, destinatario_lat),
    entrega_lng = COALESCE(entrega_lng, destinatario_lng)
WHERE id = 'e70c5c96-fc42-4afa-b03d-6996c87468d2';