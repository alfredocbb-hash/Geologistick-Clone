import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  Building2, 
  User, 
  Mail, 
  Phone,
  MessageSquare,
  Search
} from "lucide-react";

interface TrialRequest {
  id: string;
  nombre_empresa: string;
  nombre_contacto: string;
  email: string;
  telefono: string | null;
  mensaje: string | null;
  estado: string;
  created_at: string;
  reviewed_at: string | null;
  notas_revision: string | null;
}

export default function TrialRequests() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<TrialRequest | null>(null);
  const [actionDialog, setActionDialog] = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["trial-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trial_requests")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as TrialRequest[];
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, estado, notas }: { id: string; estado: string; notas: string }) => {
      const { error } = await supabase
        .from("trial_requests")
        .update({
          estado,
          reviewed_at: new Date().toISOString(),
          notas_revision: notas || null,
        })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: (_, { estado }) => {
      queryClient.invalidateQueries({ queryKey: ["trial-requests"] });
      toast.success(estado === "aprobada" ? "Solicitud aprobada" : "Solicitud rechazada");
      setActionDialog(null);
      setSelectedRequest(null);
      setNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar la solicitud");
    },
  });

  const handleApprove = () => {
    if (!selectedRequest) return;
    updateRequestMutation.mutate({
      id: selectedRequest.id,
      estado: "aprobada",
      notas: notes,
    });
  };

  const handleReject = () => {
    if (!selectedRequest) return;
    updateRequestMutation.mutate({
      id: selectedRequest.id,
      estado: "rechazada",
      notas: notes,
    });
  };

  const filteredRequests = requests?.filter(r => 
    r.nombre_empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.nombre_contacto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingRequests = filteredRequests?.filter(r => r.estado === "pendiente") || [];
  const processedRequests = filteredRequests?.filter(r => r.estado !== "pendiente") || [];

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case "pendiente":
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500"><Clock className="mr-1 h-3 w-3" />Pendiente</Badge>;
      case "aprobada":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" />Aprobada</Badge>;
      case "rechazada":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rechazada</Badge>;
      default:
        return <Badge variant="secondary">{estado}</Badge>;
    }
  };

  const RequestsTable = ({ data, showActions = false }: { data: TrialRequest[]; showActions?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Empresa</TableHead>
          <TableHead>Contacto</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Teléfono</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Estado</TableHead>
          {showActions && <TableHead className="text-right">Acciones</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showActions ? 7 : 6} className="text-center text-muted-foreground py-8">
              No hay solicitudes
            </TableCell>
          </TableRow>
        ) : (
          data.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="font-medium">{request.nombre_empresa}</TableCell>
              <TableCell>{request.nombre_contacto}</TableCell>
              <TableCell>{request.email}</TableCell>
              <TableCell>{request.telefono || "-"}</TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: es })}
              </TableCell>
              <TableCell>{getStatusBadge(request.estado)}</TableCell>
              {showActions && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedRequest(request);
                        setActionDialog("approve");
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setSelectedRequest(request);
                        setActionDialog("reject");
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Rechazar
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Solicitudes de Prueba</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona las solicitudes de prueba gratuita de nuevos clientes
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa, contacto o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                Pendientes
                {pendingRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{pendingRequests.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="processed">
                Procesadas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Solicitudes Pendientes</CardTitle>
                  <CardDescription>
                    Revisa y procesa las solicitudes de nuevos clientes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RequestsTable data={pendingRequests} showActions />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="processed" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Solicitudes Procesadas</CardTitle>
                  <CardDescription>
                    Historial de solicitudes aprobadas y rechazadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RequestsTable data={processedRequests} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Action Dialog */}
        <Dialog open={!!actionDialog} onOpenChange={() => {
          setActionDialog(null);
          setSelectedRequest(null);
          setNotes("");
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionDialog === "approve" ? "Aprobar Solicitud" : "Rechazar Solicitud"}
              </DialogTitle>
              <DialogDescription>
                {actionDialog === "approve" 
                  ? "Después de aprobar, deberás crear manualmente el tenant y usuario para este cliente."
                  : "La solicitud será marcada como rechazada."
                }
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{selectedRequest.nombre_empresa}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedRequest.nombre_contacto}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedRequest.email}</span>
                  </div>
                  {selectedRequest.telefono && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedRequest.telefono}</span>
                    </div>
                  )}
                  {selectedRequest.mensaje && (
                    <div className="flex items-start gap-2 mt-2 pt-2 border-t">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-sm text-muted-foreground">{selectedRequest.mensaje}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notas (opcional)</label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Agrega notas sobre esta solicitud..."
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(null)}>
                Cancelar
              </Button>
              <Button
                variant={actionDialog === "approve" ? "default" : "destructive"}
                onClick={actionDialog === "approve" ? handleApprove : handleReject}
                disabled={updateRequestMutation.isPending}
              >
                {updateRequestMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {actionDialog === "approve" ? "Aprobar" : "Rechazar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    
  );
}
