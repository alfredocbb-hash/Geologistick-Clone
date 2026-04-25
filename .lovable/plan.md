Detecté el origen: en la personalización de Empresa Demo, el campo del menú en modo claro está guardado como `#1E40AF` (azul oscuro). Por eso, aunque el tema sea claro, el tenant sigue viendo el menú azul.

Plan de corrección:

1. Corregir los datos actuales del tenant demo
   - Actualizar el branding de Empresa Demo para que `Sidebar (Claro)` use un color claro, por ejemplo `#F8FAFC`.
   - Mantener `Sidebar (Oscuro)` con un color oscuro, por ejemplo `#1A1A2E`, para que el modo oscuro siga funcionando correctamente.
   - Corregir también `Texto sobre Primario`, que aparece guardado como azul (`#1E40AF`) y debería ser blanco (`#FFFFFF`) para buen contraste.

2. Ajustar la lógica de aplicación del sidebar
   - En `TenantProvider`, usar `color_sidebar` cuando el tema activo sea claro.
   - Usar `color_sidebar_dark` cuando el tema activo sea oscuro.
   - Evitar que un color oscuro configurado para un modo se aplique accidentalmente al otro.

3. Mejorar la pantalla de personalización del super usuario
   - En la configuración de empresas, dejar claro que:
     - `Sidebar (Claro)` controla el menú cuando el usuario está en tema claro.
     - `Sidebar (Oscuro)` controla el menú cuando el usuario está en tema oscuro.
   - Mejorar la vista previa para mostrar el menú claro y oscuro, evitando confusión al guardar.

4. Actualizar la creación/reset de Empresa Demo
   - Modificar el generador de demo para crear el branding inicial con colores coherentes:
     - Menú claro: claro/neutro.
     - Menú oscuro: oscuro.
     - Primario: azul de marca.
     - Texto sobre primario: blanco.
   - Así, si se vuelve a resetear Empresa Demo, no reaparece el menú azul incorrecto en tema claro.

Resultado esperado:
- Si el tenant elige tema claro, el menú se verá claro y combinado con la marca.
- Si el tenant elige tema oscuro, el menú usará el color oscuro configurado.
- La personalización del super usuario quedará sincronizada con lo que realmente ve el tenant.