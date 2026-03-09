
Objetivo: corregir el “se sale y parpadea” al volver de otra pestaña del navegador, manteniendo la subpestaña seleccionada y evitando resets visuales en páginas con Tabs.

Diagnóstico confirmado
- Tu respuesta confirma dos cosas:  
  1) se resetea la subpestaña,  
  2) pasa en otras páginas.
- En el código, varias pantallas con `<Tabs>` guardan la pestaña activa solo en `useState` (estado volátil).
- Si el navegador descarta/rehidrata la pestaña (o hay remount por navegación interna), ese estado vuelve al default (`"sellers"`, `"historial"`, etc.), que coincide con lo que mostrás en imágenes.
- Además, con `refetchOnWindowFocus: true` global, algunas pantallas complejas pueden refrescar al volver de foco y acentuar el parpadeo.

Plan de implementación
1) Persistir subpestañas en sesión (sessionStorage)
- Reemplazar `useState` por `usePersistedState` para estados de tabs/roles seleccionados en pantallas clave:
  - `src/pages/ecommerce/Settlements.tsx` (`activeTab`)
  - `src/pages/ThirdPartySettlements.tsx` (`activeTab`)
  - `src/pages/Payments.tsx` (`activeTab`)
  - `src/pages/Rates.tsx` (`activeTab`)
  - `src/pages/IntegrationSettings.tsx` (`activeTab`)
  - `src/pages/LiveMap.tsx` (`activeTab`)
  - `src/pages/Incidents.tsx` (`activeTab`)
  - `src/pages/RoutePlanner.tsx` (`activeTab`)
  - `src/pages/RolePermissions.tsx` (`selectedRole`)
- Usar keys específicas por pantalla (ej: `ui-tab-ecommerce-settlements`) para no mezclar estados.

2) Validar valores persistidos
- En cada pantalla, validar que el valor recuperado exista en los tabs permitidos.
- Si no es válido (por cambios futuros de tabs), fallback al default seguro.

3) Reducir parpadeo por refetch en módulos de edición/configuración
- Agregar `refetchOnWindowFocus: false` explícito en queries de pantallas con formularios/tabs sensibles que hoy no lo tienen y que se usan durante edición:
  - `src/pages/ecommerce/Settlements.tsx`
  - `src/pages/ThirdPartySettlements.tsx`
  - `src/pages/Rates.tsx`
  - `src/pages/IntegrationSettings.tsx`
- Mantener `refetchOnWindowFocus: true` global para listados operativos, pero proteger estas vistas de edición para que no “salten”.

4) Mantener UX estable durante background refresh
- Donde aplique, usar loading visual solo en carga inicial sin datos y no reemplazar contenido existente por skeleton en refetch de foco.
- Resultado: menos “flash” al volver a la pestaña.

Resultado esperado
- Si estabas en “Liquidaciones” de `/ecommerce/settlements`, al volver de otra pestaña sigue en “Liquidaciones”.
- El mismo comportamiento consistente en otras pantallas con tabs.
- Menos parpadeo perceptible al recuperar foco del navegador.

Detalles técnicos
- No requiere cambios de backend ni base de datos.
- Cambios solo frontend (estado UI + configuración de queries).
- Se reutiliza infraestructura existente (`usePersistedState`) para mantener consistencia con lo ya implementado en filtros/formularios.
