
# Sistema de Federacion entre Tenants

## Concepto

Permitir que dos empresas (tenants) establezcan una relacion de colaboracion donde una puede derivar envios a la otra y ambas pueden ver el estado de esos envios compartidos, sin mezclar sus datos internos.

## Arquitectura

El sistema se basa en 3 tablas nuevas y una Edge Function para comunicacion segura:

```text
+------------------+       +---------------------+       +---------------------+
| tenant_partners  | 1---N | partner_shipments   | N---1 | envios              |
| (relacion A<->B) |       | (envio compartido)  |       | (envio real)        |
+------------------+       +---------------------+       +---------------------+
| id               |       | id                  |       | id                  |
| tenant_a_id      |       | partnership_id      |       | tenant_id           |
| tenant_b_id      |       | envio_origen_id     |       | tracking_number     |
| estado           |       | tenant_origen_id    |       | estado              |
| api_key_a        |       | tenant_destino_id   |       | ...                 |
| api_key_b        |       | envio_destino_id    |       |                     |
| permisos         |       | estado_sync         |       |                     |
| created_at       |       | metadata            |       |                     |
+------------------+       +---------------------+       +---------------------+
                                                    
                           +---------------------+
                           | partner_events      |
                           | (log de cambios)    |
                           +---------------------+
                           | id                  |
                           | partner_shipment_id |
                           | evento              |
                           | datos               |
                           | created_at          |
                           +---------------------+
```

## Tablas de base de datos

### 1. `tenant_partners` - Relaciones entre empresas

Almacena la relacion bidireccional entre dos tenants. Incluye permisos granulares (que puede hacer cada uno con los envios del otro).

Campos principales:
- `tenant_a_id`, `tenant_b_id`: los dos tenants vinculados
- `estado`: 'pendiente', 'activa', 'suspendida', 'cancelada'
- `permisos`: JSONB con flags como `puede_derivar`, `puede_ver_precio`, `puede_ver_cliente`, `puede_cambiar_estado`
- `tarifa_acordada_id`: tarifa especial para envios entre partners (opcional)
- `notas`: condiciones comerciales

### 2. `partner_shipments` - Envios compartidos

Vincula un envio del tenant origen con un envio creado en el tenant destino. Esto mantiene la separacion total de datos: cada tenant tiene su propia copia del envio con su propio tracking.

Campos principales:
- `partnership_id`: la relacion de partnership
- `envio_origen_id`: el envio original (tenant que deriva)
- `tenant_origen_id`: tenant que origina
- `envio_destino_id`: el envio creado en el tenant receptor (nullable hasta que se acepta)
- `tenant_destino_id`: tenant que recibe
- `estado_sync`: 'pendiente', 'aceptado', 'rechazado', 'en_curso', 'completado'
- `metadata`: JSONB con datos compartidos (direccion, peso, etc.)

### 3. `partner_events` - Auditoria

Log inmutable de todos los eventos entre partners: derivacion, aceptacion, cambios de estado, etc.

## Edge Function: `partner-sync`

Una funcion backend que maneja la comunicacion segura entre tenants:

- **Derivar envio**: Tenant A envia los datos del envio a Tenant B. Se crea un `partner_shipment` en estado pendiente.
- **Aceptar/Rechazar**: Tenant B acepta y se crea automaticamente un envio nuevo en su sistema con los datos recibidos.
- **Sync de estado**: Cuando el estado cambia en cualquiera de los dos lados, se notifica al otro via el log de eventos.
- **Autenticacion**: Usa las API Keys ya existentes (`tenant_api_keys`) para validar la identidad del tenant que hace la solicitud.

## Flujo de uso

1. **Admin de Empresa A** va a Configuracion y busca "Empresa B" por slug o nombre
2. Envia una **solicitud de partnership** con los permisos que propone
3. **Admin de Empresa B** recibe la solicitud (via notificaciones) y la acepta/rechaza
4. Una vez activa, Empresa A puede **derivar envios** desde la pantalla de Envios (nuevo boton "Derivar a Partner")
5. Empresa B ve los envios derivados en una nueva pestana y puede aceptarlos (creando automaticamente un envio local)
6. Ambas empresas ven el estado actualizado del envio en su propio sistema

## Cambios en la UI

| Componente | Cambio |
|---|---|
| Nueva pagina `Partners.tsx` | Gestion de partnerships: buscar empresas, enviar solicitudes, ver partnerships activas, configurar permisos |
| `AppSidebar.tsx` | Nuevo item "Empresas Asociadas" en el grupo Administracion |
| `Shipments.tsx` | Boton "Derivar" en el dropdown de acciones por envio (visible si hay partnerships activas) |
| Nuevo componente `DeriveShipmentDialog.tsx` | Dialogo para seleccionar partner y confirmar derivacion |
| Nuevo componente `PartnerShipmentsTab.tsx` | Pestana en Envios para ver envios recibidos de partners |
| `NotificationPopover.tsx` | Notificaciones de solicitudes de partnership y envios derivados |

## Politicas de seguridad (RLS)

- `tenant_partners`: Cada tenant solo ve partnerships donde participa. Solo admins pueden crear/modificar.
- `partner_shipments`: Visible para ambos tenants de la partnership. Solo el tenant destino puede cambiar `estado_sync`.
- `partner_events`: Solo lectura para ambos tenants de la partnership.

## Integracion con sistema existente

- Se reutiliza la tabla `tenant_api_keys` para autenticacion entre partners
- Se reutiliza el sistema de notificaciones existente
- Los envios derivados son envios normales en el tenant destino (misma logica de rutas, estados, etc.)
- El `tracking_externo` del envio destino apunta al tracking original del partner

## Resumen de implementacion

| Paso | Descripcion |
|---|---|
| 1. Migracion DB | Crear tablas `tenant_partners`, `partner_shipments`, `partner_events` con RLS |
| 2. Edge Function | Crear `partner-sync` para derivacion, aceptacion y sync de estados |
| 3. Pagina Partners | UI para gestionar partnerships (solicitudes, permisos, listado) |
| 4. Derivar envio | Dialogo + mutacion para derivar envios a un partner |
| 5. Recibir envios | Pestana para ver y aceptar envios derivados |
| 6. Sync de estado | Trigger en `envios` que notifica cambios al partner |
| 7. Notificaciones | Integrar eventos de partnership en el sistema de notificaciones |

Este sistema mantiene la separacion total de datos entre tenants (cada uno tiene su propia copia del envio) mientras permite la colaboracion operativa. Es extensible para agregar liquidaciones entre partners, tarifas especiales y reportes cruzados en el futuro.
