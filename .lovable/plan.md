

# Agregar contador visible y boton "Colectar Todos" en Modo Flex

## Problema
En la pantalla de Modo Flex, despues de escanear paquetes:
1. La cantidad de paquetes escaneados no se ve claramente (el texto queda tapado por el header de la app)
2. No hay opcion de "Colectar todos los escaneados" — solo existe "Iniciar Reparto" y "Asignar", pero a veces el chofer necesita marcar los paquetes como recogidos sin iniciar un reparto

## Solucion

### Archivo: `src/components/mobile/FlexScanScreen.tsx`

**Cambio 1 — Contador prominente**
Agregar un badge/contador grande y visible entre el boton "ESCANEAR PAQUETE" y la lista de paquetes, que muestre claramente la cantidad de paquetes escaneados. Algo como un banner compacto:

```
[Package icon] 3 paquetes escaneados
```

Esto sera un banner con fondo semitransparente que no dependa del header (que puede quedar oculto detras del AppHeader de la app movil).

**Cambio 2 — Boton "Colectar Todos"**
Agregar un boton de colecta en la seccion de acciones (junto a "Ver Mapa" y "Asignar"), que al presionarlo actualice todos los envios escaneados a estado `recogido` con `estado_retiro: retirado`, reutilizando la misma logica que ya existe en `useCollectPackages.confirmCollection`.

La logica sera directa en el componente (sin necesidad de importar otro hook):
- Hacer un batch update de los envios a `estado: 'recogido'`, `estado_retiro: 'retirado'`, `fecha_recogida: now`, `chofer_id: user.id`
- Mostrar toast de exito y limpiar la lista

El boton se mostrara con un icono de check y texto "COLECTAR TODOS (N)" con estilo azul/cyan para diferenciarlo de "INICIAR REPARTO" (verde).

### Resumen visual del layout con paquetes

```text
+----------------------------------+
| Modo Flex          [Limpiar]     |
| 3 paquetes escaneados            |
+----------------------------------+
| [====  ESCANEAR PAQUETE  ====]   |
+----------------------------------+
| (!) 3 paquetes listos            |  <-- NUEVO: badge contador
+----------------------------------+
| 1  ML-46442988089                |
|    Calle 21 3207...              |
| 2  ML-46444090042                |
|    Calle 9 de Julio...           |
| 3  ML-46446277435                |
|    Pedro Bonifacio...            |
+----------------------------------+
| [Ver Mapa]  [Asignar]           |
| [== COLECTAR TODOS (3) ==]       |  <-- NUEVO
| [== INICIAR REPARTO ==]          |
| [== HOJA DE RUTA ==]             |
+----------------------------------+
```

### Sin cambios de base de datos
La logica de update ya es compatible con los permisos existentes del chofer sobre la tabla `envios`.
