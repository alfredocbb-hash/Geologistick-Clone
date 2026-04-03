import { useCallback, useEffect, useState } from 'react';
import { useNativePlatform } from './useNativePlatform';

interface CameraResult {
  dataUrl?: string;
  webPath?: string;
}

let cameraModulePromise: Promise<any> | null = null;
let cameraModule: any = null;

function getCameraModule() {
  if (cameraModule) return Promise.resolve(cameraModule);
  if (!cameraModulePromise) {
    cameraModulePromise = import('@capacitor/camera').then((mod) => {
      cameraModule = mod;
      return mod;
    });
  }
  return cameraModulePromise;
}

export function useNativeCamera() {
  const { isNative } = useNativePlatform();
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isNative) {
      setCameraAvailable(false);
      return;
    }
    getCameraModule().then((mod) => setCameraAvailable(!!mod));
  }, [isNative]);

  const takePhoto = useCallback(async (): Promise<CameraResult | null> => {
    const mod = await getCameraModule();
    if (!mod) return null;

    try {
      const { Camera, CameraResultType, CameraSource, CameraDirection } = mod;

      // OPTIMIZACIÓN EXTREMA PARA ANDROID
      const result = await Camera.getPhoto({
        quality: 40, // Muy baja para evitar reinicios, suficiente para OCR
        allowEditing: false,
        resultType: CameraResultType.Uri, // USAR URI ES VITAL
        source: CameraSource.Camera,
        direction: CameraDirection.Rear, // FORZAR TRASERA
        width: 800, // Tamaño ideal para OCR y memoria
        correctOrientation: true,
        saveToGallery: false
      });

      return {
        webPath: result.webPath,
        dataUrl: result.dataUrl // Podría ser undefined con Uri
      };
    } catch (error: any) {
      console.error('[useNativeCamera] Camera Error:', error);
      return null;
    }
  }, []);

  const pickFromGallery = useCallback(async (): Promise<CameraResult | null> => {
    const mod = await getCameraModule();
    if (!mod) return null;
    try {
      const { Camera, CameraResultType, CameraSource } = mod;
      const result = await Camera.getPhoto({
        quality: 50,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
        width: 1000,
      });
      return { webPath: result.webPath };
    } catch (e) { return null; }
  }, []);

  return { isNative, cameraAvailable: cameraAvailable === true, takePhoto, pickFromGallery };
}
