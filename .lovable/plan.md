

# Plan: Actualizar Guía de Usuario con Nuevas Funciones

## Objetivo
Actualizar la guía de usuario principal para:
1. Completar el rebranding de "LogiTrack" a "Geologistick"
2. Agregar documentación de las nuevas funciones del sistema

---

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/lib/generateUserGuidePDF.ts` | Rebranding completo + agregar nuevas secciones |

---

## Cambios de Rebranding

| Ubicación | Antes | Después |
|-----------|-------|---------|
| Línea 4 (título) | `'Guía de Usuario - LogiTrack'` | `'Guía de Usuario - Geologistick'` |
| Línea 384 (portada) | `'LogiTrack'` | `'Geologistick'` |
| Línea 489 (archivo) | `'guia-usuario-logitrack.pdf'` | `'guia-usuario-geologistick.pdf'` |

---

## Nuevas Secciones a Agregar

### 16. RUTAS FRECUENTES
```
Que son las Rutas Frecuentes
Plantillas de rutas guardadas que agilizan la planificacion diaria.
El sistema identifica automaticamente envios pendientes de los clientes habituales.

Como Guardar una Ruta Frecuente
1. Crear ruta en el Planificador
2. Una vez optimizada, clic en "Guardar como Frecuente"
3. Asignar nombre descriptivo
4. Confirmar paradas y clientes

Usar Ruta Frecuente
1. Ir a Planificador de Rutas > tab "Rutas Frecuentes"
2. Seleccionar la ruta deseada
3. El sistema busca envios pendientes de esos clientes
4. Clic "Usar Ruta" para pre-cargar los envios encontrados
5. Ajustar si es necesario y crear la ruta

Beneficios
- Acelera la planificacion diaria
- Mantiene consistencia en zonas de reparto
- Reduce errores de asignacion
```

### 17. EMPRESAS TERCIARIZADAS (3PL)
```
Que son las Empresas Terciarizadas
Proveedores logisticos externos (ej: Correo Argentino, OCA) para envios fuera de la zona de cobertura.

Gestion de Empresas (/third-party-companies)
- Crear empresas con datos de contacto
- Configurar tipos de servicio disponibles
- Habilitar cuenta corriente para cada empresa
- Ver historial de envios asignados

Cuenta Corriente de Terciarizados
Si la empresa tiene cuenta corriente habilitada:
- Cada envio genera un cargo automatico
- Se pueden registrar pagos parciales o totales
- Ver saldo y movimientos en tiempo real

Crear Envios Terciarizados
Desde el Planificador > tab "Envios Terciarizados":
1. Seleccionar empresa terciarizada
2. Ingresar datos del destinatario
3. Agregar tracking externo (opcional)
4. El sistema registra el cargo en cuenta corriente

Liquidaciones de Terciarizados (/third-party-settlements)
- Ver saldos por empresa
- Registrar pagos con referencia
- Consultar historial de movimientos
```

### 18. WIDGET DE TRACKING EMBEBIBLE
```
Que es el Widget de Tracking
Pagina minimalista para integrar en sitios web de clientes via iframe.
Permite a los compradores rastrear sus envios sin salir del sitio del vendedor.

URL del Widget
/tracking-embed

Parametros URL
- tracking: Codigo de envio pre-cargado
- tenant_slug: Identificador del tenant para branding

Ejemplo de Integracion
<iframe 
  src="https://geologistick.app/tracking-embed?tenant_slug=miempresa"
  width="100%" 
  height="600"
/>

Caracteristicas
- Sin header ni navegacion (ideal para iframe)
- Muestra branding del tenant (logo, colores)
- Barra de progreso visual
- Historial completo de movimientos
- Busqueda por codigo de tracking
```

### 19. MODULO E-COMMERCE (Referencia)
```
Acceso
El modulo completo se encuentra en e-Commerce en el menu lateral.

Funciones Principales
- Sellers: Gestionar tiendas online conectadas
- Pedidos: Ver ordenes sincronizadas de Tiendanube
- Liquidaciones: Cierre periodico de cuentas de sellers

Integracion con Tiendanube
- Sincronizacion automatica de pedidos
- Cotizacion de envios en el checkout
- Actualizacion de estados de fulfillment

Portal de Sellers
Los vendedores acceden en /seller con dashboard, pedidos, envios y cuenta.

Documentacion Completa
Descargar la "Guia de e-Commerce" desde Configuracion del Sistema para el manual detallado.
```

---

## Secciones Existentes a Actualizar

### Seccion 6: PLANIFICADOR DE RUTAS
Agregar al final:
```
Rutas Frecuentes
El planificador incluye un tab de "Rutas Frecuentes" donde puedes:
- Ver plantillas guardadas
- Usar una ruta para pre-cargar envios pendientes
- Crear nuevas plantillas desde rutas exitosas
```

### Seccion 8: NAVEGACION ACTIVA
Actualizar la seccion de "Confirmar Entrega":
```
Confirmar Entrega (EPOD)
1. Presionar en la parada actual
2. Tomar foto del paquete entregado o comprobante
3. Capturar firma digital del receptor
4. Agregar nombre de quien recibe (opcional)
5. Incluir notas adicionales si es necesario
6. Confirmar - se genera el EPOD automaticamente

El EPOD (Electronic Proof of Delivery) incluye:
- Foto del comprobante
- Firma digital
- Fecha y hora exacta
- Coordenadas GPS de entrega
- Nombre del receptor
```

### Seccion 10: FINANZAS
Agregar subseccion:
```
Terciarizados (/third-party-settlements):
- Gestionar cuentas con proveedores externos
- Registrar pagos a Correo Argentino, OCA, etc.
- Ver historial de movimientos por empresa
```

---

## Estructura Final del Indice

1. INICIO DE SESION
2. DASHBOARD
3. GESTION DE ENVIOS
4. ESCANEO QR
5. HOJAS DE RUTA
6. PLANIFICADOR DE RUTAS (actualizado)
7. MIS RUTAS
8. NAVEGACION ACTIVA (actualizado con EPOD)
9. MAPA EN VIVO
10. FINANZAS (actualizado con 3PL)
11. ADMINISTRACION
12. CLIENTES
13. FLUJO COMPLETO DE UN ENVIO
14. ATAJOS Y TIPS
15. SOLUCION DE PROBLEMAS
16. **RUTAS FRECUENTES** (nuevo)
17. **EMPRESAS TERCIARIZADAS** (nuevo)
18. **WIDGET DE TRACKING** (nuevo)
19. **MODULO E-COMMERCE** (nuevo - referencia)

---

## Pagina Principal (Landing)

La pagina principal (`Index.tsx`) ya esta correctamente configurada:
- **Hero.tsx**: Sin nombre de marca hardcodeado
- **Features.tsx**: Lista de caracteristicas generica
- **Pricing.tsx**: Planes dinamicos desde base de datos
- **Footer.tsx**: Usa branding dinamico con fallback a "Geologistick"

No requiere cambios adicionales.

---

## Resultado Esperado

1. PDF descargable como `guia-usuario-geologistick.pdf`
2. Portada con nombre "Geologistick"
3. 19 secciones completas (4 nuevas)
4. Documentacion actualizada de EPOD, rutas frecuentes, 3PL y tracking embebible
5. Referencia cruzada al manual de e-Commerce

