## Diagnóstico

Hoy el sistema de **branding por tenant** aplica color_primario, color_acento y color_sidebar como variables CSS. El problema:

- Solo se actualiza `--sidebar-background`, pero el sidebar usa además `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border` y `--sidebar-ring`. Estas quedan con los valores por defecto del tema base (azul) y **no combinan** con el color elegido por el cliente.
- El item activo del menú usa `--sidebar-primary` que sigue siendo el azul original aunque el tenant haya elegido naranja, verde, etc.
- En modo oscuro sucede lo mismo: el sidebar mantiene su paleta original sin armonizarse con el primario del tenant.

Resultado: sidebar visualmente desconectado del tema elegido.

## Objetivo

Que **todo el menú lateral (fondo, texto, item activo, hover, borde)** se derive automáticamente del color primario del tenant y del modo claro/oscuro activo, manteniendo buen contraste para legibilidad.

## Cambios

**Archivo único:** `src/components/providers/TenantProvider.tsx`

1. **Detectar modo claro/oscuro** leyendo `document.documentElement.classList.contains('dark')` y suscribirse a cambios mediante un `MutationObserver` sobre la clase de `<html>` para reaccionar al toggle del tema.

2. **Derivar paleta completa del sidebar** a partir del `color_primario` del tenant usando manipulación HSL (función helper local):
   - `--sidebar-background`: light → `H 20% 97%` (muy tenue del primario); dark → `H 30% 7%`
   - `--sidebar-foreground`: light → `H 47% 11%`; dark → `H 40% 95%`
   - `--sidebar-primary`: usa el color primario tal cual (item activo)
   - `--sidebar-primary-foreground`: blanco/casi blanco para contraste
   - `--sidebar-accent`: light → `H 40% 92%`; dark → `H 30% 14%` (hover)
   - `--sidebar-accent-foreground`: hereda del foreground
   - `--sidebar-border`: light → `H 32% 88%`; dark → `H 30% 18%`
   - `--sidebar-ring`: igual al primario

   Todo se calcula extrayendo el **Hue** del color primario y aplicando saturación/luminosidad fijas que garantizan buen contraste en cada modo.

3. **Si `branding.color_sidebar` está explícitamente seteado** (override manual del cliente), respetarlo y solo derivar las variables que faltan (foreground/border/accent compatibles con ese fondo).

4. **Actualizar el cleanup** para remover las nuevas propiedades cuando el branding cambia.

5. **Re-aplicar la paleta** cuando cambia el modo (dark/light) o el branding.

## Lo que NO cambia

- `AppSidebar.tsx` no se toca (ya consume las variables `--sidebar-*` correctamente).
- `index.css` no se toca; los valores por defecto siguen siendo el fallback cuando no hay tenant logueado.
- Los demás colores de la app (cards, botones, etc.) siguen igual.

## Verificación

1. Cambiar `color_primario` del tenant a naranja → el sidebar adopta tonos naranjas tenues coherentes y el item activo se ve naranja.
2. Toggle modo oscuro → sidebar mantiene la armonía del primario pero adaptada a oscuro.
3. Sin tenant (login screen) → sidebar usa los valores default del index.css.
4. Hover sobre items y item activo deben tener contraste legible (texto siempre legible sobre el fondo).

## Riesgo

Bajo. Cambio aislado a un único archivo (provider). Si algo se ve mal, cleanup remueve los overrides y vuelve al default.
