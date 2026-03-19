import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DemandPrediction {
  zona: string;
  promedio_historico: number;
  dia1: number;
  dia2: number;
  dia3: number;
  tendencia: 'creciendo' | 'estable' | 'bajando';
  confianza: number;
}

export interface DemandPredictionResult {
  predicciones: DemandPrediction[];
  resumen: string;
  dias: { name: string; date: string }[];
  generado_at: string;
}

export function useDemandPrediction() {
  const [data, setData] = useState<DemandPredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('predict-demand');

      if (fnError) {
        throw new Error(fnError.message || 'Error al obtener predicción');
      }

      if (result?.error) {
        if (result.error.includes('Límite')) {
          toast.error('Límite de solicitudes excedido. Intenta en unos minutos.');
        } else if (result.error.includes('Créditos')) {
          toast.error('Créditos de IA agotados.');
        } else {
          toast.error(result.error);
        }
        setError(result.error);
        return;
      }

      setData(result as DemandPredictionResult);
      toast.success('Predicción generada correctamente');
    } catch (e: any) {
      const msg = e?.message || 'Error desconocido';
      setError(msg);
      toast.error('Error al generar predicción: ' + msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, fetchPrediction };
}
