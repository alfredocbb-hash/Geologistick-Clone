import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, Building2, User, Mail, Phone, MessageSquare } from "lucide-react";

const trialRequestSchema = z.object({
  nombre_empresa: z.string().min(2, "El nombre de la empresa es requerido"),
  nombre_contacto: z.string().min(2, "Tu nombre es requerido"),
  email: z.string().email("Ingresa un email válido"),
  telefono: z.string().optional(),
  mensaje: z.string().optional(),
});

type TrialRequestFormData = z.infer<typeof trialRequestSchema>;

interface TrialRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName?: string;
}

export function TrialRequestDialog({ open, onOpenChange, planName }: TrialRequestDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TrialRequestFormData>({
    resolver: zodResolver(trialRequestSchema),
  });

  const onSubmit = async (data: TrialRequestFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("trial_requests").insert({
        nombre_empresa: data.nombre_empresa,
        nombre_contacto: data.nombre_contacto,
        email: data.email,
        telefono: data.telefono || null,
        mensaje: planName 
          ? `Plan interesado: ${planName}\n\n${data.mensaje || ""}`.trim()
          : data.mensaje || null,
      });

      if (error) throw error;

      setIsSuccess(true);
      toast.success("¡Solicitud enviada correctamente!");
    } catch (error: any) {
      console.error("Error submitting trial request:", error);
      toast.error(error.message || "Error al enviar la solicitud");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setIsSuccess(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white">
        {isSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl text-white">¡Solicitud Recibida!</DialogTitle>
              <DialogDescription className="text-slate-400">
                Nos pondremos en contacto contigo pronto para activar tu prueba gratuita de 14 días.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={handleClose} className="mt-4">
              Cerrar
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl text-white">Solicitar Prueba Gratuita</DialogTitle>
              <DialogDescription className="text-slate-400">
                Completa el formulario y te contactaremos para activar tu cuenta con 14 días de prueba sin costo.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="nombre_empresa" className="text-slate-300 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Nombre de la empresa *
                </Label>
                <Input
                  id="nombre_empresa"
                  {...register("nombre_empresa")}
                  placeholder="Tu empresa de logística"
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
                {errors.nombre_empresa && (
                  <p className="text-red-400 text-sm">{errors.nombre_empresa.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre_contacto" className="text-slate-300 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Tu nombre *
                </Label>
                <Input
                  id="nombre_contacto"
                  {...register("nombre_contacto")}
                  placeholder="Juan Pérez"
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
                {errors.nombre_contacto && (
                  <p className="text-red-400 text-sm">{errors.nombre_contacto.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="contacto@tuempresa.com"
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
                {errors.email && (
                  <p className="text-red-400 text-sm">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono" className="text-slate-300 flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Teléfono (opcional)
                </Label>
                <Input
                  id="telefono"
                  {...register("telefono")}
                  placeholder="+54 11 1234-5678"
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mensaje" className="text-slate-300 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Mensaje (opcional)
                </Label>
                <Textarea
                  id="mensaje"
                  {...register("mensaje")}
                  placeholder="Cuéntanos sobre tu operación logística..."
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 min-h-[80px]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Solicitar Prueba"
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
