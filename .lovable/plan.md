
# Plan: Guía de Usuario - Modulo e-Commerce para Clientes

## Objetivo
Crear un PDF descargable con la guía completa del modulo de e-Commerce, explicando como funcionan los sellers, la integracion con Tiendanube, la relacion con las sucursales, y el sistema de liquidaciones. Esta guia esta orientada a los **administradores de empresas logisticas** que usan el sistema.

---

## Archivos a Crear

| Archivo | Descripcion |
|---------|-------------|
| `src/lib/generateEcommerceGuidePDF.ts` | Nuevo archivo con la funcion para generar el PDF |

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/SystemSettings.tsx` | Agregar boton para descargar la guia de e-Commerce |

---

## Contenido de la Guia (Secciones)

### 1. INTRODUCCION AL MODULO E-COMMERCE
- Que es el modulo e-Commerce y para que sirve
- Publico objetivo: tiendas online que necesitan logistica
- Beneficios: automatizacion, visibilidad, liquidaciones

### 2. GESTION DE SELLERS
- Que es un Seller (tienda online conectada)
- Como crear un seller manualmente
- Campos importantes:
  - Sucursal de Pickup (donde se retiran los paquetes)
  - Tarifa asignada (para calcular costos)
  - Cuenta Corriente (para liquidaciones)
- Vincular usuario para acceso al Portal de Sellers

### 3. INTEGRACION CON TIENDANUBE
- Como funciona la conexion OAuth
- Enviar link de conexion por WhatsApp o Email
- Sincronizacion automatica de pedidos
- Webhooks: recepcion automatica de nuevos pedidos
- Cotizacion de envios en el checkout de Tiendanube

### 4. RELACION CON SUCURSALES
- Sucursal de Pickup: donde el operador retira paquetes
- Como asignar una sucursal por seller
- Flujo operativo:
  1. Seller despacha desde sucursal X
  2. Pedidos llegan con sucursal de origen pre-asignada
  3. Se crean envios desde esa sucursal
  4. Las hojas de ruta se generan desde esa sucursal

```text
FLUJO DE TRABAJO CON SUCURSALES

Seller "Mi Tienda" → Sucursal Pickup: "Casa Central"
                              ↓
   Pedido llega de Tiendanube → ecommerce_orders
                              ↓
   Operador en "Casa Central" ve pedido pendiente
                              ↓
   Crea envio → sucursal_origen = "Casa Central"
                              ↓
   Envio se incluye en hoja de ruta o ruta de reparto
```

### 5. GESTION DE PEDIDOS
- Ver lista de pedidos sincronizados
- Estados de pedido: Pendiente, Pagado, Enviado, Entregado
- Estados de fulfillment: Sin Preparar, En Preparacion, Enviado
- Crear envio desde pedido
- Impresion de etiquetas

### 6. CREACION DE ENVIOS DESDE PEDIDOS
- Seleccionar pedidos pendientes
- Datos pre-cargados del comprador
- Calculo automatico de precio por tarifa
- Registro automatico en cuenta corriente del seller
- Impresion inmediata de etiqueta

### 7. CUENTA CORRIENTE DE SELLERS
- Como funciona la cuenta corriente
- Tipos de movimientos:
  - Cargo: por envio creado
  - Pago: cuando el seller paga
  - Ajuste: correcciones manuales
- Saldo a favor vs deuda
- Limite de credito

### 8. LIQUIDACIONES DE SELLERS
- Que es una liquidacion (cierre periodico)
- Calcular movimientos de un periodo
- Estados: Generada, Aprobada, Pagada
- Registrar pago con metodo y referencia
- Cancelar liquidaciones no pagadas
- Descargar PDF oficial

### 9. PORTAL DE SELLERS (Para tiendas online)
- Acceso separado en /seller
- Dashboard con metricas
- Mis Pedidos: ver ordenes de la tienda
- Mis Envios: rastrear paquetes
- Mi Cuenta: ver estado financiero y solicitar retiros

### 10. TARIFAS PARA E-COMMERCE
- Asignar tarifa especifica por seller
- Como se calcula el precio:
  - Flete base
  - Conceptos basicos (ej: Entrega a Domicilio)
  - Adicionales por peso
- La tarifa se usa en checkout de Tiendanube

### 11. FLUJO COMPLETO DE UN PEDIDO

```text
CICLO DE VIDA DE UN PEDIDO E-COMMERCE

1. Comprador paga en Tiendanube
         ↓
2. Webhook recibe el pedido → ecommerce_orders (estado: paid)
         ↓
3. Operador ve pedido en Sistema → Pedidos e-Commerce
         ↓
4. Crea Envio → Se asigna tracking, sucursal origen
         ↓
5. Si seller tiene cta. cte. → Se registra cargo
         ↓
6. Imprime etiqueta → Pega en paquete
         ↓
7. Envio entra en operatoria normal (hojas de ruta, rutas)
         ↓
8. Entrega completada → Estado: entregado
         ↓
9. Fin de mes → Liquidacion de seller
```

### 12. CONSEJOS OPERATIVOS
- Configurar sucursal de pickup correctamente
- Asignar tarifa antes de conectar Tiendanube
- Revisar pedidos pagados diariamente
- Generar liquidaciones semanales o quincenales
- Usar el portal para que sellers vean sus envios

### 13. PREGUNTAS FRECUENTES
- El pedido no llega: verificar conexion OAuth y webhooks
- Precio incorrecto: revisar tarifa asignada al seller
- Seller no puede acceder: verificar vinculacion de usuario
- No aparece en Tiendanube: verificar scopes de la app

---

## Implementacion Tecnica

### Nueva funcion `generateEcommerceGuidePDF()`

Se creara siguiendo el mismo patron de `generateUserGuidePDF.ts`:

```typescript
// Estructura similar pero con contenido especifico de e-Commerce
export const generateEcommerceGuidePDF = (): void => {
  const doc = new jsPDF();
  // ... generar portada con titulo "Guia de e-Commerce"
  // ... indice de contenidos
  // ... secciones con el contenido definido arriba
  doc.save('guia-ecommerce-geologistick.pdf');
};
```

### Modificacion en SystemSettings.tsx

Agregar segunda tarjeta con boton para descargar la guia de e-Commerce:

```typescript
<Card>
  <CardHeader>
    <CardTitle>Guia de e-Commerce</CardTitle>
    <CardDescription>Manual para el modulo de tiendas online</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Descripcion del contenido */}
    <Button onClick={handleDownloadEcommerceGuide}>
      <Download className="mr-2 h-4 w-4" />
      Descargar Guia e-Commerce
    </Button>
  </CardContent>
</Card>
```

---

## Resultado Esperado

1. Nuevo boton en Configuracion del Sistema
2. PDF de ~15 paginas con guia completa
3. Portada profesional con branding
4. Indice de contenidos navegable
5. Secciones claras con:
   - Titulos destacados
   - Bullets para pasos
   - Diagramas de flujo en texto
6. Enfocado en el cliente operador, no tecnico
