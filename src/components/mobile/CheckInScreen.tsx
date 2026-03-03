import { useState } from 'react';
import { MapPin, Loader2, LogIn } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import geologistickLogo from '@/assets/geologistick-logo.png';

interface CheckInScreenProps {
  onCheckInComplete: () => void;
}

export function CheckInScreen({ onCheckInComplete }: CheckInScreenProps) {
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();

  const handleCheckIn = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      let lat: number | null = null;
      let lng: number | null = null;
      let accuracy: number | null = null;

      // Get GPS position
      try {
        if (Capacitor.isNativePlatform()) {
          const perm = await Geolocation.requestPermissions();
          if (perm.location === 'granted') {
            const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            accuracy = pos.coords.accuracy;
          }
        } else if (navigator.geolocation) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            })
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          accuracy = pos.coords.accuracy;
        }
      } catch (gpsErr) {
        console.warn('GPS error during check-in, proceeding without location:', gpsErr);
      }

      const today = new Date().toLocaleDateString('en-CA');
      const deviceInfo = `${navigator.userAgent.substring(0, 100)}`;

      // Insert check-in
      const { error: checkInError } = await supabase
        .from('driver_checkins')
        .insert({
          chofer_id: user.id,
          tenant_id: profile?.tenant_id,
          fecha: today,
          lat,
          lng,
          accuracy,
          device_info: deviceInfo,
        });

      if (checkInError) {
        if (checkInError.code === '23505') {
          // Already checked in (unique constraint)
          onCheckInComplete();
          return;
        }
        throw checkInError;
      }

      // Sync current location to driver_locations
      if (lat !== null && lng !== null) {
        await supabase
          .from('driver_locations')
          .upsert({
            chofer_id: user.id,
            lat,
            lng,
            accuracy,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'chofer_id' });
      }

      toast.success('¡Jornada iniciada!');
      onCheckInComplete();
    } catch (err: any) {
      console.error('Check-in error:', err);
      toast.error('Error al iniciar jornada: ' + (err.message || 'Intenta de nuevo'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-xl animate-pulse" />
        <img
          src={geologistickLogo}
          alt="Geologistick"
          className="relative w-24 h-24 rounded-3xl object-contain"
        />
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">Iniciar Jornada</h1>
      <p className="text-slate-400 text-sm text-center mb-8 max-w-xs">
        Confirma tu disponibilidad y sincroniza tu ubicación para comenzar a trabajar hoy.
      </p>

      <Button
        onClick={handleCheckIn}
        disabled={loading}
        size="lg"
        className="w-full max-w-xs h-14 text-lg font-semibold rounded-2xl gap-3"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Obteniendo ubicación...
          </>
        ) : (
          <>
            <LogIn className="h-5 w-5" />
            Iniciar Jornada
          </>
        )}
      </Button>

      <div className="flex items-center gap-2 mt-6 text-slate-500 text-xs">
        <MapPin className="h-3.5 w-3.5" />
        <span>Se registrará tu ubicación GPS</span>
      </div>
    </div>
  );
}
