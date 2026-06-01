Voy a ajustar el comprobante para que Agencia y Cliente entren en una sola hoja A4 sin superponerse y con una presentación profesional.

Plan:
1. Reestructurar `generateShipmentReceiptPDF.ts` para que cada media hoja tenga una grilla fija de 148.5 mm, con alturas controladas y márgenes seguros.
2. Reducir y compactar bloques críticos: header, origen/destino, remitente/destinatario, condición, descripción/conceptos, QR/total, firmas y observaciones.
3. Agregar protección de overflow: textos largos truncados o envueltos dentro de cada caja, conceptos limitados con resumen si hay demasiados, y total con tamaño ajustado para no pisar otros elementos.
4. Separar visualmente la línea de corte para que nunca cruce firmas ni cabeceras de la copia inferior.
5. Verificar también el flujo combinado desde `PrintLabel.tsx`, para que etiqueta + comprobante mantengan páginas A4 uniformes.
6. Validar visualmente el resultado generando/inspeccionando el PDF con el caso actual, revisando que no haya solapamientos, cortes, texto fuera de caja ni logos deformados.