import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Shield, Loader2, Eye, EyeOff, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function SecurityCard() {
  const { user } = useAuth();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const passwordStrength = () => {
    const { newPassword } = passwordData;
    if (!newPassword) return { level: 0, text: '', color: '' };
    
    let strength = 0;
    if (newPassword.length >= 8) strength++;
    if (/[A-Z]/.test(newPassword)) strength++;
    if (/[0-9]/.test(newPassword)) strength++;
    if (/[^A-Za-z0-9]/.test(newPassword)) strength++;

    const levels = [
      { level: 0, text: 'Muy débil', color: 'bg-destructive' },
      { level: 1, text: 'Débil', color: 'bg-orange-500' },
      { level: 2, text: 'Regular', color: 'bg-yellow-500' },
      { level: 3, text: 'Buena', color: 'bg-lime-500' },
      { level: 4, text: 'Fuerte', color: 'bg-green-500' },
    ];

    return levels[strength];
  };

  const handleChangePassword = async () => {
    // Validar contraseña actual
    if (!passwordData.currentPassword) {
      toast.error('Ingresa tu contraseña actual');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setIsSaving(true);
    setCurrentPasswordError(false);
    
    try {
      // Primero verificar la contraseña actual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: passwordData.currentPassword,
      });

      if (signInError) {
        setCurrentPasswordError(true);
        toast.error('La contraseña actual es incorrecta');
        return;
      }

      // Si es correcta, proceder con el cambio
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsChangingPassword(false);
      setCurrentPasswordError(false);
      toast.success('Contraseña actualizada correctamente');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Error al cambiar la contraseña');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setIsChangingPassword(false);
    setCurrentPasswordError(false);
  };

  const strength = passwordStrength();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Seguridad
        </CardTitle>
        <CardDescription>Gestiona la seguridad de tu cuenta</CardDescription>
      </CardHeader>
      <CardContent>
        {!isChangingPassword ? (
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="font-medium">Contraseña</p>
              <p className="text-sm text-muted-foreground">
                Última actualización: desconocida
              </p>
            </div>
            <Button variant="outline" onClick={() => setIsChangingPassword(true)}>
              Cambiar Contraseña
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current Password Field */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Contraseña Actual</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, currentPassword: e.target.value });
                    setCurrentPasswordError(false);
                  }}
                  placeholder="Ingresa tu contraseña actual"
                  className={currentPasswordError ? 'border-destructive' : ''}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPasswords(!showPasswords)}
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {currentPasswordError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  La contraseña actual es incorrecta
                </p>
              )}
            </div>

            {/* Help message */}
            <Alert variant="default" className="bg-muted/50">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                ¿No recuerdas tu contraseña? Contacta a tu administrador para que la restablezca desde el panel de usuarios.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Ingresa tu nueva contraseña"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPasswords(!showPasswords)}
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              
              {/* Password strength indicator */}
              {passwordData.newPassword && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          level <= strength.level ? strength.color : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fortaleza: {strength.text}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <Input
                id="confirmPassword"
                type={showPasswords ? 'text' : 'password'}
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="Confirma tu nueva contraseña"
              />
              {passwordData.confirmPassword && passwordData.newPassword === passwordData.confirmPassword && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Las contraseñas coinciden
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
                Cancelar
              </Button>
              <Button onClick={handleChangePassword} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Actualizar Contraseña
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
