

# Plan: Regenerar Logo Manteniendo el Estilo Original

## Objetivo
Regenerar el logo de Geologistick con fondo transparente, manteniendo fielmente el estilo original: un **pin de ubicación** combinado con un **paquete/caja 3D** en gradiente **azul a teal**.

---

## Problema Actual
La última generación de imagen creó un logo con un estilo diferente al original. El usuario quiere preservar la estética que tenía antes.

---

## Solución

### 1. Regenerar el Logo con Prompt Mejorado
Usar un prompt más específico que capture el estilo original:

**Prompt propuesto:**
```
"Professional logistics company logo icon. A 3D location pin marker with a cardboard shipping box/package integrated into the pin design. 
The pin has a blue to teal/cyan gradient color scheme. 
Modern, clean, minimalist style with subtle 3D depth and shadows.
MUST have completely transparent background (PNG with alpha channel).
No text, no circles around it, just the icon itself.
High quality, crisp edges, suitable for app icon use."
```

### 2. Mantener los Tamaños Ya Actualizados
Los tamaños que ya se ajustaron en el paso anterior se mantienen:

| Componente | Tamaño |
|------------|--------|
| Navbar | `h-12 w-12` |
| Footer | `h-12 w-12` |
| LoginForm | `w-20 h-20` |
| AppSidebar | `h-12 w-12` |
| MobileHeader | `w-10 h-10` |
| MobileLoginScreen | `w-32 h-32` |
| MobileAppLayout | `w-28 h-28` |

---

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/assets/geologistick-logo.png` | Regenerar con estilo original + fondo transparente |

---

## Seccion Tecnica

### Modelo de Generacion
Se usara el modelo `google/gemini-2.5-flash-image` para mejor calidad y fidelidad al prompt.

### Caracteristicas del Logo Original a Preservar
- Pin de ubicacion (location marker) como forma base
- Paquete/caja de envio integrado en el diseño
- Gradiente de azul a teal/cyan
- Estilo moderno y minimalista
- Apariencia 3D con profundidad sutil
- Sin texto en la imagen
- Sin circulos o fondos adicionales

### Consideraciones
- El fondo transparente permitira que el logo se vea bien tanto en fondos claros como oscuros
- Se mantendran los bordes redondeados (`rounded-xl`, `rounded-2xl`, `rounded-3xl`) en los contenedores para consistencia visual

