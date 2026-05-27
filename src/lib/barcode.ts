export function normalizeBarcode(value: string): string {
  return value.replace(/[\s-]/g, '');
}

export function isValidBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(normalizeBarcode(value));
}
