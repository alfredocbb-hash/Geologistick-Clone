import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Link, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LogoUploaderProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  tenantId: string;
  fileType: 'logo-light' | 'logo-dark' | 'favicon';
  accept?: string;
  helpText?: string;
}

export function LogoUploader({
  label,
  value,
  onChange,
  tenantId,
  fileType,
  accept = 'image/png,image/jpeg,image/svg+xml,image/webp',
  helpText,
}: LogoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('El archivo es muy grande. Máximo 2MB.');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenantId}/${fileType}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(fileName, file, {
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('branding')
        .getPublicUrl(fileName);

      // Add timestamp to bust cache
      const urlWithTimestamp = `${urlData.publicUrl}?t=${Date.now()}`;
      onChange(urlWithTimestamp);
      toast.success('Imagen subida correctamente');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Error al subir la imagen: ' + error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!value) return;

    try {
      // Try to delete from storage if it's our URL
      if (value.includes('branding')) {
        const path = `${tenantId}/${fileType}`;
        await supabase.storage.from('branding').remove([path]);
      }
      onChange('');
      toast.success('Imagen eliminada');
    } catch (error) {
      console.error('Error removing:', error);
      onChange('');
    }
  };

  const handleUrlSubmit = () => {
    if (urlValue.trim()) {
      onChange(urlValue.trim());
      setShowUrlInput(false);
      setUrlValue('');
    }
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      
      {value ? (
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-32 bg-muted rounded-md overflow-hidden border flex items-center justify-center">
            <img
              src={value}
              alt={label}
              className="max-h-full max-w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder.svg';
              }}
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleRemove}
          >
            <X className="h-4 w-4 mr-1" />
            Eliminar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Subir archivo
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowUrlInput(!showUrlInput)}
            >
              <Link className="h-4 w-4 mr-2" />
              URL externa
            </Button>
          </div>
          
          {showUrlInput && (
            <div className="flex gap-2">
              <Input
                placeholder="https://ejemplo.com/logo.png"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
              />
              <Button type="button" onClick={handleUrlSubmit}>
                Aplicar
              </Button>
            </div>
          )}
        </div>
      )}
      
      {helpText && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
