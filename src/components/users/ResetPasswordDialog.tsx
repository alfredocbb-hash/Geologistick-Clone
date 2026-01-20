import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Key, Copy, RefreshCw, Check, Eye, EyeOff, Loader2 } from 'lucide-react';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    user_id: string;
    nombre: string;
    apellido: string | null;
    email: string;
  } | null;
}

export function ResetPasswordDialog({ open, onOpenChange, user }: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generatePassword = () => {
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const numbers = '23456789';
    const symbols = '!@#$%&*';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    for (let i = 0; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    const shuffled = password.split('').sort(() => Math.random() - 0.5).join('');
    setNewPassword(shuffled);
  };

  const handleReset = async () => {
    if (!user) return;
    
    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            user_id: user.user_id,
            new_password: newPassword,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al reiniciar contraseña');
      }

      setGeneratedPassword(result.new_password);
      toast.success('Contraseña reiniciada exitosamente');
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error(error instanceof Error ? error.message : 'Error al reiniciar contraseña');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    const passwordToCopy = generatedPassword || newPassword;
    await navigator.clipboard.writeText(passwordToCopy);
    setCopied(true);
    toast.success('Contraseña copiada al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setNewPassword('');
    setGeneratedPassword(null);
    setShowPassword(false);
    setCopied(false);
    onOpenChange(false);
  };

  const passwordStrength = () => {
    if (!newPassword) return { score: 0, label: '', color: '' };
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (newPassword.length >= 12) score++;
    if (/[a-z]/.test(newPassword)) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^a-zA-Z0-9]/.test(newPassword)) score++;

    if (score <= 2) return { score, label: 'Débil', color: 'bg-destructive' };
    if (score <= 4) return { score, label: 'Media', color: 'bg-warning' };
    return { score, label: 'Fuerte', color: 'bg-success' };
  };

  const strength = passwordStrength();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Reiniciar Contraseña
          </DialogTitle>
          <DialogDescription>
            {user && (
              <>
                Reiniciando contraseña para <strong>{user.nombre} {user.apellido}</strong> ({user.email})
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {generatedPassword ? (
          <div className="space-y-4">
            <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
              <p className="text-sm text-success font-medium mb-2">
                ¡Contraseña reiniciada exitosamente!
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Copia esta contraseña y compártela con el usuario de forma segura:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-background rounded border font-mono text-sm break-all">
                  {generatedPassword}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              El usuario podrá cambiar esta contraseña desde su perfil una vez que inicie sesión.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nueva Contraseña</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Ingresa o genera una contraseña"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={generatePassword}
                  className="shrink-0"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generar
                </Button>
              </div>
            </div>

            {newPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Fortaleza:</span>
                  <span className={`font-medium ${strength.color.replace('bg-', 'text-')}`}>
                    {strength.label}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${strength.color}`}
                    style={{ width: `${(strength.score / 6) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              La contraseña debe tener al menos 8 caracteres. Se recomienda incluir mayúsculas, minúsculas, números y símbolos.
            </p>
          </div>
        )}

        <DialogFooter>
          {generatedPassword ? (
            <Button onClick={handleClose} className="w-full">
              Cerrar
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleReset}
                disabled={isLoading || !newPassword || newPassword.length < 8}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reiniciando...
                  </>
                ) : (
                  'Reiniciar Contraseña'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
