export function normalizePhilippinePhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (!compact) return null;
  let normalized = compact;
  if (normalized.startsWith("09")) normalized = `+63${normalized.slice(1)}`;
  if (normalized.startsWith("63")) normalized = `+${normalized}`;
  if (!/^\+\d{8,15}$/.test(normalized)) return null;
  return normalized;
}

export function maskPhoneNumber(value: string | null): string {
  if (!value) return "No phone added";
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "Phone saved";
}
