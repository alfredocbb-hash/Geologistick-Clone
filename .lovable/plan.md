

# Plan: Corregir Etiquetas para Sellers y Agregar Opcion de Reimpresion

## Problemas Identificados

### 1. La etiqueta muestra datos incorrectos para envios e-commerce

La captura muestra:
- **DESTINATARIO:** "SIN DESTINATARIO"
- **ENTREGAR EN:** "[D] Sin direccion"
- **REMITENTE:** "Sin remitente"

**Causa raiz:** El sistema usa un enfoque dual para los datos de contacto:
- **Campos de texto directos:** `nombre_remitente`, `nombre_destinatario`, `direccion_entrega` (se llenan correctamente en la creacion del envio)
- **Relaciones FK:** `remitente_id`, `destinatario_id` que apuntan a la tabla `clientes` (NO se llenan para envios e-commerce)

El componente `PrintLabel.tsx` prioriza las relaciones FK sobre los campos de texto:

```typescript
// Linea 204-206: Solo usa envio.destinatario (relacion FK)
${envio.destinatario 
  ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`
  : 'Sin destinatario'}
```

Como `remitente_id` y `destinatario_id` son `null` para envios e-commerce, muestra "Sin destinatario" y "Sin remitente".

### 2. No hay opcion de imprimir etiqueta despues de crear el envio

Actualmente el `onSuccess` solo muestra un toast y cierra el dialogo. No ofrece opcion de imprimir la etiqueta inmediatamente ni un acceso rapido para reimprimirla.

---

## Solucion Propuesta

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/PrintLabel.tsx` | Usar campos de texto como fallback para remitente/destinatario |
| `src/components/ecommerce/CreateShipmentFromOrderDialog.tsx` | Agregar opcion de imprimir etiqueta despues de crear el envio |
| `src/pages/ecommerce/Orders.tsx` | Agregar boton de imprimir en columna de envio |

---

## Cambios Tecnicos Detallados

### 1. PrintLabel.tsx - Agregar `nombre_remitente` y `nombre_destinatario` al interface

Agregar los campos faltantes al interface `Envio` (lineas 78-131):

```typescript
interface Envio {
  // ... campos existentes ...
  nombre_remitente: string | null;  // AGREGAR
  nombre_destinatario: string | null;  // AGREGAR
  // ...
}
```

### 2. PrintLabel.tsx - Usar fallback en `generateLabelHTML` (lineas 200-210)

**Antes:**
```typescript
<div class="recipient-name">
  ${envio.destinatario 
    ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`
    : 'Sin destinatario'}
</div>
```

**Despues:**
```typescript
<div class="recipient-name">
  ${envio.destinatario 
    ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`
    : (envio.nombre_destinatario || 'Sin destinatario')}
</div>
```

Aplicar el mismo patron para el telefono del destinatario:
```typescript
${envio.destinatario?.telefono 
  ? `<div class="recipient-phone">Tel: ${envio.destinatario.telefono}</div>` 
  : (envio.whatsapp_destinatario ? `<div class="recipient-phone">Tel: ${envio.whatsapp_destinatario}</div>` : '')}
```

### 3. PrintLabel.tsx - Usar fallback para remitente (lineas 263-272)

**Antes:**
```typescript
<div class="sender-name">
  ${envio.remitente 
    ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}`.trim()
    : 'Sin remitente'}
</div>
```

**Despues:**
```typescript
<div class="sender-name">
  ${envio.remitente 
    ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}`.trim()
    : (envio.nombre_remitente || 'Sin remitente')}
</div>
```

### 4. PrintLabel.tsx - Corregir direccion de entrega para `domicilio_domicilio`

En la funcion `getDeliveryAddress` (lineas 610-638), agregar manejo para `domicilio_domicilio`:

```typescript
const getDeliveryAddress = () => {
  // Incluir domicilio_domicilio en la condicion
  if (['sucursal_puerta', 'puerta_puerta', 'domicilio_domicilio'].includes(tipoServicio)) {
    if (envio.direccion_entrega) {
      return {
        type: 'domicilio',
        direccion: envio.direccion_entrega,
        ciudad: envio.ciudad_entrega,
        cp: envio.cp_entrega,
      };
    }
    // ...
  }
  // ...
};
```

### 5. PrintLabel.tsx - Actualizar vista previa (lineas 830-844)

Aplicar los mismos fallbacks en la seccion de vista previa del componente React:

```typescript
<p className="font-bold text-sm uppercase">
  {envio.destinatario 
    ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`
    : (envio.nombre_destinatario || 'Sin destinatario')}
</p>
```

Y para el remitente:
```typescript
<p className="font-medium">
  {envio.remitente 
    ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}`.trim()
    : (envio.nombre_remitente || 'Sin remitente')}
</p>
```

### 6. CreateShipmentFromOrderDialog.tsx - Agregar opcion de imprimir etiqueta

Modificar el estado del dialogo para mostrar opciones post-creacion:

```typescript
const [createdEnvio, setCreatedEnvio] = useState<any>(null);
const navigate = useNavigate();

// En onSuccess:
onSuccess: (envio) => {
  setCreatedEnvio(envio);
  toast({ 
    title: 'Envio creado correctamente',
    description: `Tracking: ${envio.tracking_number}`,
  });
},
```

Y agregar un estado de "exito" en el DialogContent:

```typescript
{createdEnvio ? (
  <div className="text-center py-6 space-y-4">
    <div className="text-green-500 text-5xl">✓</div>
    <div>
      <h3 className="font-semibold text-lg">Envio Creado</h3>
      <p className="text-muted-foreground">{createdEnvio.tracking_number}</p>
    </div>
    <div className="flex gap-2 justify-center">
      <Button 
        variant="outline" 
        onClick={() => {
          setCreatedEnvio(null);
          onOpenChange(false);
          onSuccess();
        }}
      >
        Cerrar
      </Button>
      <Button 
        onClick={() => navigate(`/print-label?id=${createdEnvio.id}`)}
      >
        <Printer className="mr-2 h-4 w-4" />
        Imprimir Etiqueta
      </Button>
    </div>
  </div>
) : (
  // Formulario actual
)}
```

### 7. Orders.tsx - Agregar boton de imprimir en tabla

En la columna de "Envio", cuando ya existe el envio, agregar opcion de imprimir:

```typescript
<TableCell>
  {order.envio_id ? (
    <div className="flex items-center gap-2">
      <Badge variant="default">Creado</Badge>
      <Button 
        variant="ghost" 
        size="icon"
        className="h-6 w-6"
        onClick={() => navigate(`/print-label?id=${order.envio_id}`)}
      >
        <Printer className="h-3 w-3" />
      </Button>
    </div>
  ) : order.order_status !== 'cancelled' ? (
    <Button variant="outline" size="sm" onClick={() => setCreateShipmentOrder(order)}>
      <Truck className="mr-1 h-3 w-3" />
      Crear
    </Button>
  ) : (
    <Badge variant="secondary">-</Badge>
  )}
</TableCell>
```

---

## Flujo Final

```text
┌─────────────────────────────────────────────────────────────────┐
│ Pedidos e-Commerce                                              │
├─────────────────────────────────────────────────────────────────┤
│ #100 | Brysha Siempre | ... | [Creado] [🖨]  ← Imprimir rapido  │
└─────────────────────────────────────────────────────────────────┘

Al crear envio:
┌─────────────────────────────────────┐
│         ✓ Envio Creado              │
│     SUC01-ENV-20260126-5161AA       │
│                                     │
│   [Cerrar]   [🖨 Imprimir Etiqueta] │
└─────────────────────────────────────┘

Etiqueta corregida:
┌─────────────────────────────────────┐
│ DESTINATARIO                        │
│ BRYSHA SIEMPRE                      │ ← Ahora usa nombre_destinatario
│ Tel: +54...                         │ ← Ahora usa whatsapp_destinatario
├─────────────────────────────────────┤
│ ENTREGAR EN                         │
│ [D] Platanos 3232...                │ ← Ahora usa direccion_entrega
├─────────────────────────────────────┤
│ REMITENTE                           │
│ Test TiendaNube                     │ ← Ahora usa nombre_remitente
└─────────────────────────────────────┘
```

---

## Resultado Esperado

1. Las etiquetas muestran correctamente el nombre del destinatario (`nombre_destinatario` como fallback)
2. Las etiquetas muestran correctamente el remitente (`nombre_remitente` como fallback)
3. La direccion de entrega aparece correctamente para envios `domicilio_domicilio`
4. Al crear un envio desde e-commerce, aparece opcion para imprimir etiqueta inmediatamente
5. En la tabla de pedidos, hay un icono de impresora para reimprimir etiquetas de envios ya creados

