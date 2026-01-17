import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.53354d35df094ff79101b454344485d4',
  appName: 'geologic',
  webDir: 'dist',
  server: {
    url: 'https://geologic.lovable.app?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      overlaysWebView: false
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1e293b',
      showSpinner: true,
      spinnerColor: '#3b82f6'
    },
    BarcodeScanner: {
      enableGoogleBarcodeScanning: true
    }
  }
};

export default config;
