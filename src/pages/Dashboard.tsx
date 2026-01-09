import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, DollarSign, Users, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const { profile, roles } = useAuth();

  const stats = [
    {
      title: 'Envíos Hoy',
      value: '24',
      change: '+12%',
      changeType: 'positive' as const,
      icon: Package,
      color: 'bg-shipments',
    },
    {
      title: 'En Tránsito',
      value: '156',
      change: '+5%',
      changeType: 'positive' as const,
      icon: Truck,
      color: 'bg-drivers',
    },
    {
      title: 'Ingresos del Día',
      value: '$12,450',
      change: '+18%',
      changeType: 'positive' as const,
      icon: DollarSign,
      color: 'bg-cash',
    },
    {
      title: 'Choferes Activos',
      value: '8',
      change: '-2',
      changeType: 'neutral' as const,
      icon: Users,
      color: 'bg-commissions',
    },
  ];

  const recentShipments = [
    { id: 'ENV-20240115-A1B2C3', status: 'en_transito', destination: 'Buenos Aires', time: 'Hace 15 min' },
    { id: 'ENV-20240115-D4E5F6', status: 'entregado', destination: 'Córdoba', time: 'Hace 32 min' },
    { id: 'ENV-20240115-G7H8I9', status: 'pendiente', destination: 'Rosario', time: 'Hace 45 min' },
    { id: 'ENV-20240115-J0K1L2', status: 'en_reparto', destination: 'Mendoza', time: 'Hace 1 hora' },
  ];

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pendiente: { label: 'Pendiente', variant: 'secondary' },
      en_transito: { label: 'En Tránsito', variant: 'default' },
      en_reparto: { label: 'En Reparto', variant: 'outline' },
      entregado: { label: 'Entregado', variant: 'default' },
    };
    const { label, variant } = config[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          ¡Hola, {profile?.nombre || 'Usuario'}! 👋
        </h1>
        <p className="text-muted-foreground">
          Aquí está el resumen de tu operación logística de hoy.
        </p>
        <div className="flex gap-2 mt-2">
          {roles.map((role) => (
            <Badge key={role} variant="outline" className="capitalize">
              {role.replace('_', ' ')}
            </Badge>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="card-hover overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{stat.value}</span>
                <span className={`text-sm font-medium ${
                  stat.changeType === 'positive' ? 'text-success' : 'text-muted-foreground'
                }`}>
                  {stat.change}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Shipments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-shipments" />
              Envíos Recientes
            </CardTitle>
            <CardDescription>Los últimos movimientos del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentShipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-sm font-medium">{shipment.id}</span>
                    <span className="text-xs text-muted-foreground">{shipment.destination}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(shipment.status)}
                    <span className="text-xs text-muted-foreground">{shipment.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions / Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              Resumen del Día
            </CardTitle>
            <CardDescription>Estado general de la operación</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-success/10 border border-success/20">
                <CheckCircle className="h-8 w-8 text-success" />
                <div>
                  <p className="font-semibold text-success">45 Entregas Completadas</p>
                  <p className="text-sm text-muted-foreground">95% de éxito en entregas</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 rounded-lg bg-warning/10 border border-warning/20">
                <Clock className="h-8 w-8 text-warning" />
                <div>
                  <p className="font-semibold text-warning">12 Envíos Pendientes</p>
                  <p className="text-sm text-muted-foreground">Esperando asignación</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">3 Incidencias</p>
                  <p className="text-sm text-muted-foreground">Requieren atención</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
