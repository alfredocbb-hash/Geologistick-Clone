export const CONCEPTO_OPTIONS = [
  { value: 1, label: 'Productos' },
  { value: 2, label: 'Servicios' },
  { value: 3, label: 'Productos y Servicios' },
] as const;

export const TIPO_DOCUMENTO_OPTIONS = [
  { value: 80, label: 'CUIT' },
  { value: 86, label: 'CUIL' },
  { value: 87, label: 'CDI' },
  { value: 96, label: 'DNI' },
  { value: 99, label: 'Sin Identificar' },
] as const;

export const CONDICION_VENTA_OPTIONS = [
  'Contado',
  'Cuenta Corriente',
  'Cheque',
  'Transferencia Bancaria',
  'Otra',
] as const;

export const CONDICION_IVA_OPTIONS = [
  { value: 'responsable_inscripto' as const, label: 'Responsable Inscripto', requiresCuit: true },
  { value: 'monotributo' as const, label: 'Monotributista', requiresCuit: true },
  { value: 'exento' as const, label: 'Exento', requiresCuit: true },
  { value: 'consumidor_final' as const, label: 'Consumidor Final', requiresCuit: false },
];

export type CondicionIVA = typeof CONDICION_IVA_OPTIONS[number]['value'];
