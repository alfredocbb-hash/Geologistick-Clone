import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { User, Phone, Building2, Loader2, Check } from 'lucide-react';
import { PhoneInput } from '@/components/ui/phone-input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Profile } from '@/lib/auth';

interface PersonalInfoCardProps {
  profile: Profile;
  sucursalName?: string;
  onProfileUpdate: (updates: Partial<Profile>) => void;
}

export function PersonalInfoCard({ profile, sucursalName, onProfileUpdate }: PersonalInfoCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre: profile.nombre || '',
    apellido: profile.apellido || '',
    telefono: profile.telefono || '',
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nombre: formData.nombre,
          apellido: formData.apellido,
          telefono: formData.telefono,
        })
        .eq('user_id', profile.user_id);

      if (error) throw error;

      onProfileUpdate(formData);
      setIsEditing(false);
      toast.success('Perfil actualizado correctamente');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Error al actualizar el perfil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      nombre: profile.nombre || '',
      apellido: profile.apellido || '',
      telefono: profile.telefono || '',
    });
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Información Personal
          </CardTitle>
          <CardDescription>Tu información de contacto</CardDescription>
        </div>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Guardar
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            {isEditing ? (
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Tu nombre"
              />
            ) : (
              <p className="text-sm py-2 px-3 bg-muted rounded-md">{profile.nombre || '-'}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="apellido">Apellido</Label>
            {isEditing ? (
              <Input
                id="apellido"
                value={formData.apellido}
                onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                placeholder="Tu apellido"
              />
            ) : (
              <p className="text-sm py-2 px-3 bg-muted rounded-md">{profile.apellido || '-'}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Teléfono
            </Label>
            {isEditing ? (
              <PhoneInput
                id="telefono"
                value={formData.telefono}
                onChange={(value) => setFormData({ ...formData, telefono: value })}
                placeholder="Tu número de teléfono"
              />
            ) : (
              <p className="text-sm py-2 px-3 bg-muted rounded-md">{profile.telefono || '-'}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Sucursal Asignada
            </Label>
            <p className="text-sm py-2 px-3 bg-muted rounded-md text-muted-foreground">
              {sucursalName || 'Sin sucursal asignada'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Correo Electrónico</Label>
          <p className="text-sm py-2 px-3 bg-muted rounded-md text-muted-foreground">
            {profile.email}
            <span className="text-xs ml-2">(No editable)</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
