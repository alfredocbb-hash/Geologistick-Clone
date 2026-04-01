
Diagnóstico: Sí, muy probablemente tengas que actualizar la APK.

Qué veo en el proyecto:
- `capacitor.config.ts` usa `webDir: 'dist'`
- No tiene `server.url` configurado
- Eso significa que la APK carga una copia local del frontend embebida dentro de la app, no la preview en vivo

Consecuencia:
- Los cambios que vemos en la preview/web no se reflejan solos en la APK ya instalada
- Para que el cambio del escáner aparezca en Android, hace falta reconstruir y resincronizar la app nativa

Cómo confirmarlo rápido:
1. Probá el flujo en la preview/web
2. Si en la preview aparece el botón inferior `LISTO · N paquetes ✓` y en la APK no, entonces el problema es que la APK está desactualizada
3. Si tampoco aparece en la preview, entonces no es un problema de APK y habría que revisar el flujo específico donde se abre `QRScanner`

Siguiente paso recomendado:
1. Hacé `git pull` del proyecto actualizado
2. Ejecutá `npm run build`
3. Ejecutá `npx cap sync android`
4. Volvé a generar/instalar la APK
5. Si sigue mostrando la versión vieja, desinstalá la app anterior del celular antes de reinstalar

Nota importante:
- Publicar o actualizar la web no actualiza una APK ya instalada
- En este proyecto, cada cambio frontend para mobile requiere nueva build + sync + nueva APK
