import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geologic.choferapp',
  appName: 'GeologistickAPK',
  webDir: 'dist',
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
