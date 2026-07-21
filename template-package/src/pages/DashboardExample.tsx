import { LayoutDashboard, Users, Settings, BarChart3 } from "lucide-react";
import { DashboardLayout, NavItem } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Usuarios", to: "/usuarios", icon: Users },
  { label: "Reportes", to: "/reportes", icon: BarChart3 },
  { label: "Configuración", to: "/configuracion", icon: Settings },
];

const kpis = [
  { label: "Ingresos", value: "$12.480", trend: "+12%" },
  { label: "Usuarios activos", value: "1.284", trend: "+4%" },
  { label: "Conversión", value: "3,8%", trend: "-0,4%" },
  { label: "Pendientes", value: "27", trend: "+2" },
];

export default function DashboardExample() {
  return (
    <DashboardLayout title="App Template" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Panel principal</h2>
            <p className="text-sm text-muted-foreground">
              Ejemplo de dashboard con la plantilla unificada.
            </p>
          </div>
          <Button>Nueva acción</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {k.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{k.value}</div>
                <p className="text-xs text-muted-foreground">{k.trend} vs. mes anterior</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Últimos registros</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { id: "0001", name: "Ana García", status: "Activo", total: "$320" },
                  { id: "0002", name: "Luis Pérez", status: "Pendiente", total: "$180" },
                  { id: "0003", name: "María Ruiz", status: "Activo", total: "$540" },
                ].map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.id}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "Activo" ? "default" : "secondary"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
