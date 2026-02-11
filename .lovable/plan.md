

# Mostrar Store ID en el detalle del Seller

## Problema
Algunos sellers tienen varias cuentas de MercadoLibre. Al escanear un paquete Flex y ver "seller no registrado" con un `store_id` (ej. 352429845), el usuario necesita poder verificar en el detalle de los sellers existentes cual tiene ese ID para saber si debe crear uno nuevo o si ya existe con otro nombre.

## Solucion

### Archivo: `src/components/ecommerce/SellerDetailsDialog.tsx`

Agregar el campo `store_id` en la seccion de informacion de contacto del seller, visible cuando el seller tiene un `store_id` configurado.

Se mostrara como una fila adicional con el icono de Store y el label "Store ID:", junto al valor del ID. Esto permite al administrador:
- Verificar rapidamente que ID de plataforma tiene cada seller
- Comparar con el ID que aparece en el dialogo de escaneo ML
- Identificar si necesita crear un nuevo seller o vincular a uno existente

### Ubicacion en la UI
Dentro de la card "Informacion de Contacto", despues del store_url (si existe) o al final de la lista de contacto. Se mostrara con un `Badge` de estilo `outline` con fuente monoespaciada para facilitar la comparacion visual con el ID del escaneo.

