## Objetivo

Permitir marcar un envío como **Devuelto al remitente** desde la pestaña **Canceladas / Devoluciones** de Incidencias, sin depender de crear una incidencia previa. Choferes, operadores y admins habilitados.

## Cambios

### 1. Botón "Devolver al remitente" en la tabla de Canceladas — `src/pages/Incidents.tsx`

En la columna **Acciones** de cada fila de la pestaña Canceladas:

- Si `estado === 'cancelado'`: mostrar botón **Devolver al remitente** (ícono `Undo2`, variante destructive-outline).
- Si `estado === 'devuelto'`: no mostrar el botón (ya está devuelto). Mantener acceso a detalle e historial.

Al hacer clic abre un nuevo diálogo `ReturnToSenderDialog` con:
- Tracking + destinatario (readonly, contexto).
- Textarea **Motivo de devolución** (obligatorio, mínimo 5 caracteres).
- Botones **Cancelar** / **Confirmar devolución**.

### 2. Nuevo componente `src/components/incidents/ReturnToSenderDialog.tsx`

Al confirmar:
1. `UPDATE envios SET estado = 'devuelto' WHERE id = :envioId` — el trigger `log_envio_estado_change` ya inserta el historial con el nombre de la sucursal.
2. `INSERT INTO envio_historial` con `estado_anterior = estado actual`, `estado_nuevo = 'devuelto'`, `notas = 'Devolución al remitente. Motivo: ' || motivo`, `created_by = auth.uid()`. Esta entrada complementa la del trigger con el motivo escrito.
3. Invalida las queries `['canceladas-devoluciones']`, `['envios']`, `['envio-historial', envioId]` y muestra `toast.success`.

No se anulan pagos ni movimientos de caja (a diferencia de cancelación); una devolución no revierte cobros ya rendidos.

### 3. Alcance de permisos

- El botón se muestra siempre en la pestaña; las RLS existentes de `envios` ya permiten a admins/operadores/choferes de la sucursal actualizar el estado. Si el `UPDATE` devuelve `0 filas`, mostrar toast de error con "Sin permisos para modificar este envío".
- Choferes: la pestaña Incidencias ya es accesible para su rol operativo; el mismo botón queda disponible sin cambios adicionales de ruteo.

### 4. Tracking público

Sin cambios: el banner de "Devuelto al remitente" con motivo y fecha ya se renderiza (implementado en la iteración anterior); la nueva entrada de historial con motivo alimenta ese banner automáticamente.

## Fuera de alcance

- No se crea incidencia previa ni se toca `IncidentActionDialog`.
- No se modifican RLS ni el esquema de la base de datos.
- No se agrega la acción en la lista general de Envíos ni en el detalle — el usuario eligió centralizarlo en la pestaña Canceladas.
- No se altera la lógica financiera (pagos/caja).
