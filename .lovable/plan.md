

# Plan: Poblar Remitente con Empresa Terciarizada

## Problema Identificado

Cuando se crea un envío terciarizado, los campos del remitente quedan vacíos. El usuario espera que la empresa terciarizada aparezca como remitente del envío.

## Solución

Modificar el código de creación de envíos en `ThirdPartyShipmentsTab.tsx` para poblar automáticamente los campos del remitente usando los datos de la empresa terciarizada seleccionada.

---

## Cambios a Realizar

### Archivo: `src/components/routes/ThirdPartyShipmentsTab.tsx`

**Paso 1**: Ampliar la consulta de empresas para traer más datos

Actualmente se consulta:
```typescript
.select("id, codigo, nombre, tiene_cuenta_corriente, saldo_cuenta_corriente")
```

Cambiar a:
```typescript
.select("id, codigo, nombre, direccion, ciudad, provincia, telefono, tiene_cuenta_corriente, saldo_cuenta_corriente")
```

**Paso 2**: Actualizar la interfaz `EmpresaTerciarizada`

Agregar los nuevos campos:
```typescript
interface EmpresaTerciarizada {
  id: string;
  codigo: string;
  nombre: string;
  direccion?: string;
  ciudad?: string;
  provincia?: string;
  telefono?: string;
  tiene_cuenta_corriente: boolean;
  saldo_cuenta_corriente: number;
}
```

**Paso 3**: Poblar datos del remitente al crear el envío

En la mutación de creación (líneas 265-293), agregar los campos del remitente:

```typescript
const { data, error } = await supabase
  .from("envios")
  .insert({
    // ... campos existentes ...
    
    // NUEVOS: Datos del remitente (empresa terciarizada)
    nombre_remitente: selectedEmpresa?.nombre,
    direccion_retiro: selectedEmpresa?.direccion || null,
    ciudad_retiro: selectedEmpresa?.ciudad || null,
    // El teléfono del remitente podría guardarse en whatsapp_remitente si existe ese campo
  })
```

---

## Flujo Resultante

```text
Usuario selecciona empresa terciarizada: "Andreani (AND)"
                    ↓
Sistema crea envío con:
  - nombre_remitente: "Andreani"
  - direccion_retiro: "Av. Callao 1234"
  - ciudad_retiro: "CABA"
  - provincia: (de la empresa)
                    ↓
El envío muestra correctamente quién es el remitente
```

---

## Campos Mapeados

| Campo Empresa Terciarizada | Campo Envío (Remitente) |
|---------------------------|-------------------------|
| `nombre` | `nombre_remitente` |
| `direccion` | `direccion_retiro` |
| `ciudad` | `ciudad_retiro` |
| `telefono` | *(opcional)* |

---

## Resumen de Cambios

| Archivo | Cambio |
|---------|--------|
| `src/components/routes/ThirdPartyShipmentsTab.tsx` | Ampliar query de empresas, actualizar interfaz, poblar campos remitente |

