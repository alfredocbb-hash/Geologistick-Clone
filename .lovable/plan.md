

# Zonas de Cobertura por Sucursal

## Como funciona la limitacion

La tarifa "General" define **cuanto cobrar** por un envio, pero no controla **a donde se puede enviar**. Para limitar los destinos, se usan las **Zonas de Cobertura** de cada sucursal, que ya tienen una tabla preparada en la base de datos (`sucursal_zonas`) pero actualmente esta vacia y sin interfaz.

El flujo seria:

```text
Sucursal "Blackbox Centro"
  -> Tarifa: General (define precios)
  -> Zonas de Cobertura (define a donde puede enviar):
     - Buenos Aires (provincia)
     - Cordoba, Cordoba
     - Rosario, Santa Fe
     - CP 1000-1499

Operador intenta crear envio a Mendoza:
  -> Sistema verifica zonas de cobertura
  -> Mendoza NO esta en la lista
  -> Bloquea el envio con mensaje: "Sin cobertura en Mendoza"
```

Si una sucursal **no tiene zonas configuradas**, puede enviar a cualquier destino (sin restriccion, comportamiento actual).

## Cambios a implementar

### 1. Boton "Zonas de Cobertura" en la pagina de Sucursales

En cada tarjeta de sucursal, agregar un boton con icono de mapa que abre un dialogo para gestionar las zonas.

### 2. Nuevo componente: BranchCoverageZonesDialog

Un dialogo donde el administrador puede:

- Ver las zonas de cobertura existentes para esa sucursal
- Agregar nuevas zonas por **Ciudad**, **Provincia**, o **rango de Codigo Postal**
- Activar/desactivar zonas individuales
- Eliminar zonas que ya no aplican
- Copiar zonas de otra sucursal (para configurar rapido varias sucursales)

### 3. Validacion al crear envios en NewShipment

Al momento de guardar un nuevo envio:

1. Consultar `sucursal_zonas` para la sucursal del operador
2. Si **no hay zonas** configuradas: permitir todo (sin restriccion)
3. Si **hay zonas** configuradas: verificar que la ciudad/CP del destinatario coincida con alguna zona activa
4. Si no coincide: mostrar alerta clara y bloquear el envio

La validacion se aplica:
- Para envios a **puerta**: verificar ciudad o CP del destinatario
- Para envios a **sucursal destino**: verificar la ciudad de la sucursal destino

### 4. Ajuste de seguridad (RLS)

La tabla ya tiene una politica de lectura por tenant que funciona correctamente. Solo se necesita ajustar las politicas de escritura para que administradores del mismo tenant puedan gestionar zonas (actualmente solo admins globales pueden).

## Detalle tecnico

### Archivos a crear

| Archivo | Descripcion |
|---------|-------------|
| `src/components/branches/BranchCoverageZonesDialog.tsx` | Dialogo para gestionar zonas de cobertura por sucursal |

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Branches.tsx` | Agregar boton "Zonas" en cada tarjeta de sucursal |
| `src/pages/NewShipment.tsx` | Agregar query de `sucursal_zonas` y validacion antes de guardar |

### Migracion SQL

Agregar politica para que administradores del tenant puedan insertar, actualizar y eliminar zonas de sus sucursales:

```text
-- Permitir a admins del tenant gestionar zonas de sus sucursales
CREATE POLICY "Admins manage coverage zones for their tenant"
  ON sucursal_zonas FOR ALL TO authenticated
  USING (
    sucursal_id IN (
      SELECT id FROM sucursales 
      WHERE tenant_id = current_user_tenant()
    )
    AND is_admin(auth.uid())
  )
  WITH CHECK (
    sucursal_id IN (
      SELECT id FROM sucursales 
      WHERE tenant_id = current_user_tenant()
    )
    AND is_admin(auth.uid())
  );
```

Tambien eliminar la politica anterior "Admins gestionan zonas" que usa `is_admin()` sin filtro de tenant.

### Logica de validacion en NewShipment

```text
Al enviar formulario:
  1. Buscar zonas activas de sucursal_zonas WHERE sucursal_id = sucursalOrigenId AND activa = true
  2. Si count = 0 -> sin restriccion, continuar normalmente
  3. Si count > 0 -> verificar destino:
     a. Comparar ciudad destino (case-insensitive, sin acentos) contra zonas.ciudad
     b. Comparar CP destino contra rangos [codigo_postal_desde, codigo_postal_hasta]
     c. Comparar provincia destino contra zonas.provincia
     d. Si alguna zona coincide -> permitir
     e. Si ninguna coincide -> mostrar error y bloquear
```

### Interfaz del dialogo de zonas

El dialogo tendra:
- Formulario rapido para agregar zona: campos de Ciudad, Provincia, CP desde, CP hasta
- Lista de zonas existentes con toggle activa/inactiva y boton eliminar
- Contador de zonas activas
- Selector para copiar zonas de otra sucursal

