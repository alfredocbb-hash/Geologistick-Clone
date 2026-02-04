import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Truck, 
  Warehouse, 
  MapPin, 
  Navigation, 
  CheckCircle, 
  XCircle, 
  RotateCcw,
  ArrowRight,
  User,
  ScanLine,
  Building2,
  AlertTriangle
} from 'lucide-react';

const statusData = [
  {
    status: 'pendiente',
    label: 'Pendiente',
    description: 'El envío fue creado y está esperando ser recogido',
    color: 'bg-yellow-500',
    icon: Package,
    actions: ['Chofer escanea QR para recoger'],
    nextStatus: 'recogido',
  },
  {
    status: 'recogido',
    label: 'Recogido',
    description: 'El chofer recogió el paquete del remitente',
    color: 'bg-blue-500',
    icon: Truck,
    actions: ['Operador/Bodega escanea al ingresar a centro'],
    nextStatus: 'en_sucursal',
  },
  {
    status: 'en_sucursal',
    label: 'En Sucursal',
    description: 'El paquete está en la sucursal',
    color: 'bg-purple-500',
    icon: Warehouse,
    actions: ['Se asigna a ruta o se marca en tránsito a sucursal'],
    nextStatus: 'en_transito',
  },
  {
    status: 'en_transito',
    label: 'En Tránsito',
    description: 'El paquete está siendo transportado a la sucursal destino',
    color: 'bg-cyan-500',
    icon: MapPin,
    actions: ['Sucursal destino recibe el paquete', 'Se incluye en ruta planificada'],
    nextStatus: 'en_reparto',
  },
  {
    status: 'en_reparto',
    label: 'En Reparto',
    description: 'El chofer está en camino para entregar',
    color: 'bg-orange-500',
    icon: Navigation,
    actions: ['Chofer confirma entrega con foto y firma'],
    nextStatus: 'entregado',
  },
  {
    status: 'entregado',
    label: 'Entregado',
    description: 'El paquete fue entregado exitosamente al destinatario',
    color: 'bg-green-500',
    icon: CheckCircle,
    actions: ['Fin del ciclo'],
    nextStatus: null,
  },
];

const alternativeStatuses = [
  {
    status: 'devuelto',
    label: 'Devuelto',
    description: 'El paquete fue devuelto al remitente',
    color: 'bg-amber-500',
    icon: RotateCcw,
    fromStatuses: ['en_reparto', 'en_transito'],
  },
  {
    status: 'cancelado',
    label: 'Cancelado',
    description: 'El envío fue cancelado por el cliente o la empresa',
    color: 'bg-red-500',
    icon: XCircle,
    fromStatuses: ['pendiente', 'recogido', 'en_sucursal'],
  },
  {
    status: 'incidente',
    label: 'Con Incidente',
    description: 'Se reportó un problema durante el proceso',
    color: 'bg-destructive',
    icon: AlertTriangle,
    fromStatuses: ['cualquier estado'],
  },
];

const roleActions = [
  {
    role: 'Chofer',
    icon: Truck,
    color: 'text-chofer',
    actions: [
      { action: 'Recoger envío', from: 'pendiente', to: 'recogido', description: 'Escanea QR, confirma retiro' },
      { action: 'Entregar envío', from: 'en_reparto', to: 'entregado', description: 'Captura foto, firma, cobra si aplica' },
      { action: 'Reportar incidente', from: 'cualquiera', to: 'incidente', description: 'Daño, rechazo, dirección incorrecta' },
    ],
  },
  {
    role: 'Operador / Bodega',
    icon: Warehouse,
    color: 'text-purple-500',
    actions: [
      { action: 'Recibir en sucursal', from: 'recogido', to: 'en_sucursal', description: 'Escanea al ingresar a la sucursal' },
      { action: 'Enviar a sucursal', from: 'en_sucursal', to: 'en_transito', description: 'Despacha hacia destino' },
    ],
  },
  {
    role: 'Sucursal',
    icon: Building2,
    color: 'text-sucursales',
    actions: [
      { action: 'Recibir en sucursal', from: 'en_transito', to: 'en_transito', description: 'Confirma llegada a destino' },
      { action: 'Entregar en mostrador', from: 'en_transito', to: 'entregado', description: 'Cliente retira en sucursal' },
    ],
  },
  {
    role: 'Despachador',
    icon: ScanLine,
    color: 'text-cyan-500',
    actions: [
      { action: 'Asignar a ruta', from: 'en_sucursal/en_transito', to: 'en_reparto', description: 'Planifica ruta, al iniciar cambia a en_reparto' },
    ],
  },
];

export default function ShipmentStatusGuide() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Guía de Estados de Envíos</h1>
        <p className="text-muted-foreground">
          Referencia rápida del ciclo de vida de un envío y las acciones de cada rol
        </p>
      </div>

      {/* Main Flow Diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Flujo Principal de Estados
          </CardTitle>
          <CardDescription>
            Ciclo de vida normal de un envío desde su creación hasta la entrega
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-center gap-2 py-6">
            {statusData.map((status, index) => (
              <div key={status.status} className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <div className={`p-3 rounded-xl ${status.color} text-white shadow-lg`}>
                    <status.icon className="h-6 w-6" />
                  </div>
                  <span className="mt-2 text-sm font-medium">{status.label}</span>
                </div>
                {index < statusData.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-muted-foreground mx-2" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status Details Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statusData.map((status) => (
          <Card key={status.status} className="relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${status.color}`} />
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${status.color} text-white`}>
                  <status.icon className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg">{status.label}</CardTitle>
                  <Badge variant="outline" className="mt-1 font-mono text-xs">
                    {status.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">{status.description}</p>
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">Acciones para avanzar:</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {status.actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-primary">•</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
              {status.nextStatus && (
                <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Siguiente:</span>
                  <Badge variant="secondary">{status.nextStatus}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alternative Statuses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Estados Alternativos
          </CardTitle>
          <CardDescription>
            Estados que interrumpen el flujo normal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {alternativeStatuses.map((status) => (
              <div key={status.status} className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <div className={`p-2 rounded-lg ${status.color} text-white shrink-0`}>
                  <status.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">{status.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{status.description}</p>
                  <p className="text-xs mt-2">
                    <span className="text-muted-foreground">Desde: </span>
                    {status.fromStatuses.join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Role Actions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Acciones por Rol
          </CardTitle>
          <CardDescription>
            Qué puede hacer cada tipo de usuario con los envíos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {roleActions.map((role) => (
            <div key={role.role} className="space-y-3">
              <div className="flex items-center gap-2">
                <role.icon className={`h-5 w-5 ${role.color}`} />
                <h3 className="font-semibold">{role.role}</h3>
              </div>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {role.actions.map((action, i) => (
                  <div key={i} className="p-3 rounded-lg border bg-card">
                    <p className="font-medium text-sm">{action.action}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs">
                      <Badge variant="outline" className="text-[10px]">{action.from}</Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="outline" className="text-[10px]">{action.to}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{action.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
