
# Plan: Agregar Autocomplete de Clientes y Guardado en Envíos Terciarizados

## Problema Identificado

El formulario "Agregar Envío Terciarizado" en `ThirdPartyShipmentsTab.tsx` presenta dos deficiencias:

1. **No permite buscar clientes existentes**: A diferencia de `NewShipment.tsx`, no tiene el componente `ContactAutocomplete` para cargar datos de clientes ya registrados.

2. **No guarda el destinatario en la base de clientes**: Los datos del destinatario se insertan solo en la tabla `envios` pero nunca se persisten en la tabla `clientes`, perdiendo la oportunidad de reutilizarlos en futuras operaciones.

---

## Solucion Propuesta

### 1. Agregar ContactAutocomplete al Formulario

Importar y usar el componente `ContactAutocomplete` en la seccion de "Nombre del destinatario":

```tsx
import ContactAutocomplete from '@/components/shipments/ContactAutocomplete';

// Query para obtener todos los clientes
const { data: allClients = [] } = useQuery({
  queryKey: ['all_clients'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre');
    if (error) throw error;
    return data;
  },
});

// Handler para cargar cliente existente
const handleLoadClient = (client: Client) => {
  setFormData(prev => ({
    ...prev,
    nombre_destinatario: `${client.nombre} ${client.apellido || ''}`.trim(),
    direccion_entrega: client.direccion,
    ciudad_entrega: client.ciudad || '',
    provincia: '', // El cliente no tiene provincia, mantener manual
    cp_entrega: client.codigo_postal || '',
    whatsapp_destinatario: client.telefono,
    entrega_lat: client.lat || null,
    entrega_lng: client.lng || null,
  }));
  toast.success(`Datos de ${client.nombre} cargados`);
};
```

### 2. Implementar findOrCreateClient

Agregar la funcion para buscar o crear el cliente antes de insertar el envio:

```tsx
const findOrCreateClient = async (data: {
  nombre: string;
  telefono: string;
  direccion: string;
  ciudad?: string;
  codigo_postal?: string;
}) => {
  // Buscar por telefono primero
  if (data.telefono) {
    const { data: existing } = await supabase
      .from('clientes')
      .select('id')
      .eq('telefono', data.telefono)
      .maybeSingle();

    if (existing) {
      // Actualizar datos
      await supabase.from('clientes')
        .update({
          nombre: data.nombre,
          direccion: data.direccion,
          ciudad: data.ciudad,
          codigo_postal: data.codigo_postal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      return existing.id;
    }
  }

  // Crear nuevo cliente
  const { data: newClient, error } = await supabase
    .from('clientes')
    .insert({
      nombre: data.nombre.split(' ')[0],
      apellido: data.nombre.split(' ').slice(1).join(' ') || null,
      telefono: data.telefono,
      direccion: data.direccion,
      ciudad: data.ciudad,
      codigo_postal: data.codigo_postal,
      tenant_id: profile?.tenant_id,
      sucursal_id: profile?.sucursal_id,
    })
    .select('id')
    .single();

  if (error) throw error;
  return newClient.id;
};
```

### 3. Modificar createShipmentMutation

Antes de insertar el envio, llamar a `findOrCreateClient` y guardar el `destinatario_id`:

```tsx
// Dentro de mutationFn
const destinatarioId = await findOrCreateClient({
  nombre: shipment.nombre_destinatario,
  telefono: shipment.whatsapp_destinatario,
  direccion: shipment.direccion_entrega,
  ciudad: shipment.ciudad_entrega,
  codigo_postal: shipment.cp_entrega,
});

// Agregar al insert del envio
{
  ...
  destinatario_id: destinatarioId,
  ...
}
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/routes/ThirdPartyShipmentsTab.tsx` | Agregar ContactAutocomplete, query de clientes, findOrCreateClient, y modificar mutacion |

---

## Cambios en la UI

El formulario agregara:
1. Un selector "Cargar cliente existente" arriba del campo "Nombre del destinatario"
2. Al seleccionar un cliente, se precargan: nombre, direccion, ciudad, CP, telefono y coordenadas

---

## Notas Tecnicas

1. **Reutilizacion de logica**: La funcion `findOrCreateClient` replica la logica de `NewShipment.tsx` para mantener consistencia
2. **Deduplicacion**: Busca primero por telefono para evitar duplicados
3. **Coordenadas**: Si el cliente tiene lat/lng guardados, se cargan automaticamente
4. **Invalidacion de cache**: Se agrega `invalidateQueries(['all_clients'])` al exito para refrescar la lista

---

## Flujo Actualizado

```
Usuario abre "Agregar Envio Terciarizado"
        |
        v
Opcion 1: Click "Cargar cliente existente"
  -> Buscar en base de clientes
  -> Seleccionar cliente
  -> Precargar todos los datos
        |
        v
Opcion 2: Ingresar datos manualmente
        |
        v
Click "Crear Envio"
        |
        v
findOrCreateClient()
  -> Busca por telefono
  -> Si existe: actualiza y retorna ID
  -> Si no existe: crea nuevo cliente
        |
        v
Inserta envio con destinatario_id
        |
        v
Cliente disponible para futuros envios
```
