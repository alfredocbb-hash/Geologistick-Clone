import { useCallback } from 'react';
import { useNativePlatform } from './useNativePlatform';

interface CameraResult {
  dataUrl: string;
}

export function useNativeCamera() {
  const { isNative } = useNativePlatform();

  const takePhoto = useCallback(async (): Promise<CameraResult | null> => {
    if (!isNative) return null; // Caller should fallback to file input

    try {
      const { Camera, CameraResultType, CameraSource, CameraDirection } = await import('@capacitor/camera');
      const result = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        direction: CameraDirection.Rear,
        width: 1280,
        correctOrientation: true,
      });

      if (result.dataUrl) {
        return { dataUrl: result.dataUrl };
      }
      return null;
    } catch (error: any) {
      // User cancelled or permission denied
      if (error?.message?.includes('cancelled') || error?.message?.includes('denied')) {
        console.log('Camera cancelled or denied:', error.message);
        return null;
      }
      console.error('Native camera error:', error);
      return null;
    }
  }, [isNative]);

  const pickFromGallery = useCallback(async (): Promise<CameraResult | null> => {
    if (!isNative) return null;

    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const result = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        width: 1280,
        correctOrientation: true,
      });

      if (result.dataUrl) {
        return { dataUrl: result.dataUrl };
      }
      return null;
    } catch (error: any) {
      if (error?.message?.includes('cancelled') || error?.message?.includes('denied')) {
        console.log('Gallery cancelled or denied:', error.message);
        return null;
      }
      console.error('Native gallery error:', error);
      return null;
    }
  }, [isNative]);

  return { isNative, takePhoto, pickFromGallery };
}
