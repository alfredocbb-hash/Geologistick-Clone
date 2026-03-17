

# Plan: Forzar cámara trasera y preservar foto

## Problema raíz

Sin el atributo `capture="environment"`, Android abre la cámara frontal por defecto. Cuando el usuario cambia a la trasera y saca la foto, el WebView se recarga y el `onChange` nunca se dispara — la foto se pierde.

## Solución

**Usar dos inputs file separados:**

1. **Input principal con `capture="environment"`** — fuerza cámara trasera directamente. El botón principal "Tomar foto" usará este input.
2. **Input secundario sin `capture`** — botón "Elegir de galería" como alternativa si la cámara falla.

La persistencia en `sessionStorage` (que ya existe) se encarga del caso donde el WebView recarga: al volver, restaura el `