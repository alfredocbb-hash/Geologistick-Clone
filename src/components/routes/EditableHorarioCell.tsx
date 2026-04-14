import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { toast } from "sonner";

const PRESETS: Record<string, { label: string; icon: string; desde: string; hasta: string }> = {
  manana: { label: "Mañana", icon: "🌅", desde: "08:00", hasta: "13:00" },
  tarde: { label: "Tarde", icon: "☀️", desde: "13:00", hasta: "20:00" },
  noche: { label: "Noche", icon: "🌙", desde: "20:00", hasta: "23:00" },
  comercial: { label: "Comercial", icon: "🏢", desde: "09:00", hasta: "18:00" },
};

interface Props {
  envioId: string;
  horarioDesde: string | null;
  horarioHasta: string | null;
  horarioPreferido: string | null;
}

export function EditableHorarioCell({ envioId, horarioDesde, horarioHasta, horarioPreferido }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(horarioPreferido || "");
  const [desde, setDesde] = useState(horarioDesde || "");
  const [hasta, setHasta] = useState(horarioHasta || "");
  const [saving, setSaving] = useState(false);

  const handlePresetChange = (value: string) => {
    setPreset(value);
    if (value !== "personalizado" && PRESETS[value]) {
      setDesde(PRESETS[value].desde);
      setHasta(PRESETS[value].hasta);
    }
  };

  const handleSave = async () => {
    if (!desde || !hasta) {
      toast.error("Ingresá horario desde y hasta");
      return;
    }
    setSaving(true);
    const preferencia = preset || "comercial";
    const { error } = await supabase.from("envios").update({
      horario_preferido_entrega: preferencia,
      horario_entrega_desde: desde,
      horario_entrega_hasta: hasta,
    }).eq("id", envioId);

    if (error) {
      toast.error("Error al guardar horario");
    } else {
      toast.success("Horario actualizado");
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      setOpen(false);
    }
    setSaving(false);
  };

  const hasSchedule = horarioDesde && horarioHasta;
  const presetInfo = horarioPreferido && PRESETS[horarioPreferido];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="text-left w-full group cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1">
          {hasSchedule ? (
            <div className="text-xs font-medium">{horarioDesde} - {horarioHasta}</div>
          ) : null}
          {presetInfo ? (
            <Badge variant="outline" className="text-[10px]">
              {presetInfo.icon} {presetInfo.label}
            </Badge>
          ) : !hasSchedule ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1 opacity-60 group-hover:opacity-100">
              <Clock className="h-3 w-3" /> Asignar
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <Select value={preset} onValueChange={handlePresetChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Seleccionar horario" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRESETS).map(([key, val]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {val.icon} {val.label} ({val.desde}-{val.hasta})
                </SelectItem>
              ))}
              <SelectItem value="personalizado" className="text-xs">⚙️ Personalizado</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input type="time" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-8 text-xs" />
            <Input type="time" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-8 text-xs" />
          </div>
          <Button size="sm" className="w-full h-7 text-xs" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
