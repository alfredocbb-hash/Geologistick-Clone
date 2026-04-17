
El botón de WhatsApp en el Hero de la landing apunta a un número incorrecto. Debe usar `+54 9 11 5176-7139` (el mismo que ya usa el Footer).

## Cambio
En `src/components/landing/Hero.tsx`, actualizar el `href` del enlace de WhatsApp para que apunte a `https://wa.me/5491151767139` (formato internacional sin `+`, espacios ni guiones, como ya lo usa `Footer.tsx`).

## Archivo
| Archivo | Cambio |
|---|---|
| `src/components/landing/Hero.tsx` | Reemplazar el número actual del enlace WhatsApp por `5491151767139` |

## Riesgo
Nulo. Cambio de una sola URL.
